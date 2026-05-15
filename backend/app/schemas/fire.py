from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FireOut(BaseModel):
    id: UUID
    lat: float
    lon: float
    confidence: float
    report_count: int
    first_seen_at: datetime
    last_seen_at: datetime
    is_active: bool


class FireDetail(FireOut):
    photo_urls: list[str]
