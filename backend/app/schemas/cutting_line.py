from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field

class CuttingLineCreate(BaseModel):
    coordinates: list[list[float]] = Field(..., description="Ordered [lon, lat] pairs, at least 2")
    label: str | None = None

class CuttingLineOut(BaseModel):
    id: UUID
    created_by: UUID
    coordinates: list[list[float]]
    label: str | None
    length_m: float
    is_active: bool
    created_at: datetime
