#!/usr/bin/env python3
import argparse
from pathlib import Path

import cv2
from ultralytics import YOLO

def find_latest_weights(runs_dir: Path) -> Path:
    candidates = list(runs_dir.rglob("best.pt"))
    if not candidates:
        candidates = list(runs_dir.rglob("last.pt"))
    if not candidates:
        raise FileNotFoundError(
            f"No weights found under {runs_dir}. Pass --weights explicitly."
        )
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run YOLOv11 on a live camera feed to visualize fire/smoke."
    )
    parser.add_argument(
        "--weights",
        type=str,
        default="",
        help="Path to a trained weights file (best.pt/last.pt).",
    )
    parser.add_argument(
        "--runs-dir",
        type=str,
        default=str(Path(__file__).resolve().parent / "runs"),
        help="Where to look for latest weights if --weights is not set.",
    )
    parser.add_argument(
        "--camera",
        type=int,
        default=0,
        help="Camera index for OpenCV VideoCapture.",
    )
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold.")
    parser.add_argument("--iou", type=float, default=0.45, help="NMS IoU threshold.")
    parser.add_argument(
        "--device",
        type=str,
        default="",
        help="Device for inference (e.g. 'cpu', '0'). Empty=auto.",
    )
    return parser.parse_args()

def main() -> None:
    args = parse_args()
    weights = Path(args.weights) if args.weights else find_latest_weights(Path(args.runs_dir))
    device = args.device if args.device else None

    model = YOLO(str(weights))
    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        raise SystemExit(f"Unable to open camera index {args.camera}.")

    window_name = "FireAware - YOLOv11"
    while True:
        ok, frame = cap.read()
        if not ok:
            break

        results = model.predict(
            source=frame,
            conf=args.conf,
            iou=args.iou,
            device=device,
            verbose=False,
        )
        annotated = results[0].plot()
        cv2.imshow(window_name, annotated)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
