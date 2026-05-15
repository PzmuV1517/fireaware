from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field

class FireZoneCreate(BaseModel):
    coordinates: list[list[float]] = Field(..., description="Ring of [lon, lat] pairs, not closed")
    label: str | None = None
    color: str = "#C9532A"

class FireZoneOut(BaseModel):
    id: UUID
    created_by: UUID
    coordinates: list[list[float]]
    label: str | None
    color: str
    area_m2: float
    is_active: bool
    created_at: datetime
