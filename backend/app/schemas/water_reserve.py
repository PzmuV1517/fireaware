from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class WaterReserveCreate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    name: str = Field(min_length=1, max_length=120)
    capacity_l: int | None = None


class WaterReserveOut(BaseModel):
    id: UUID
    lat: float
    lon: float
    name: str
    capacity_l: int | None
    is_active: bool
    created_at: datetime
