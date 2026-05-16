from pydantic import BaseModel, Field


class Detection(BaseModel):
    class_name: str
    confidence: float
    # Normalised [x1, y1, x2, y2] in image-space, each value in [0, 1] so the
    # client can scale to the rendered photo size without knowing the source
    # dimensions. Origin is top-left.
    bbox: tuple[float, float, float, float] | None = Field(default=None)


class AnalysisResult(BaseModel):
    detections: list[Detection]
    max_fire_confidence: float
    max_smoke_confidence: float
    threshold: float
    valid: bool
    message: str
