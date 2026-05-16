"""YOLO-based fire/smoke detection for incoming report photos.

The model is loaded lazily on first request so the API boots fast. Inference
runs inside FastAPI's default thread pool (sync endpoints) so multiple
analyses can run in parallel without blocking the event loop.
"""

from __future__ import annotations

import io
import logging
import threading
from typing import TYPE_CHECKING

from PIL import Image

from app.core.config import get_settings
from app.schemas.analysis import AnalysisResult, Detection

if TYPE_CHECKING:
    from ultralytics import YOLO

log = logging.getLogger(__name__)

_model: "YOLO | None" = None
_lock = threading.Lock()


def _get_model() -> "YOLO":
    global _model
    if _model is not None:
        return _model
    with _lock:
        if _model is not None:
            return _model
        from ultralytics import YOLO

        path = get_settings().model_weights_path
        log.info("Loading YOLO weights from %s", path)
        _model = YOLO(path)
    return _model


def analyze_image(content: bytes) -> AnalysisResult:
    img = Image.open(io.BytesIO(content)).convert("RGB")
    img_w, img_h = img.size
    threshold = get_settings().min_fire_confidence

    model = _get_model()
    # conf=0.1 keeps low-confidence detections so we can report them back to
    # the user instead of silently dropping a near-miss.
    results = model.predict(img, conf=0.1, verbose=False)
    if not results:
        return _empty(threshold)

    r = results[0]
    boxes = getattr(r, "boxes", None)
    names = getattr(r, "names", {}) or {}

    detections: list[Detection] = []
    max_fire = 0.0
    max_smoke = 0.0

    if boxes is not None and len(boxes) > 0:
        cls_tensor = boxes.cls.tolist()
        conf_tensor = boxes.conf.tolist()
        xyxy_tensor = boxes.xyxy.tolist()  # [x1, y1, x2, y2] in source-image pixels
        for cls_idx, conf, xyxy in zip(cls_tensor, conf_tensor, xyxy_tensor, strict=False):
            label = str(names.get(int(cls_idx), str(int(cls_idx))))
            c = float(conf)
            x1, y1, x2, y2 = (float(v) for v in xyxy)
            bbox = (
                max(0.0, x1 / img_w),
                max(0.0, y1 / img_h),
                min(1.0, x2 / img_w),
                min(1.0, y2 / img_h),
            )
            detections.append(Detection(class_name=label, confidence=c, bbox=bbox))
            if label.lower() == "fire" and c > max_fire:
                max_fire = c
            elif label.lower() == "smoke" and c > max_smoke:
                max_smoke = c

    # Photo clears the check when either fire or smoke is detected with at
    # least `threshold` confidence — smoke is a valid fire-incident signal.
    valid = max_fire >= threshold or max_smoke >= threshold

    if valid:
        if max_fire >= max_smoke:
            msg = f"Fire detected at {max_fire * 100:.0f}% confidence."
        else:
            msg = f"Smoke detected at {max_smoke * 100:.0f}% confidence."
    else:
        # Don't surface the threshold to the user — just tell them the photo
        # isn't clear enough.
        msg = "Photo isn't clear enough — please retake from a closer or clearer angle."

    return AnalysisResult(
        detections=detections,
        max_fire_confidence=max_fire,
        max_smoke_confidence=max_smoke,
        threshold=threshold,
        valid=valid,
        message=msg,
    )


def _empty(threshold: float) -> AnalysisResult:
    return AnalysisResult(
        detections=[],
        max_fire_confidence=0.0,
        max_smoke_confidence=0.0,
        threshold=threshold,
        valid=False,
        message="Photo isn't clear enough — please retake from a closer or clearer angle.",
    )
