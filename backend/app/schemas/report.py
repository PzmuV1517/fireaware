from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    bearing_deg: float = Field(ge=0, lt=360)
    bearing_acc_deg: float = Field(gt=0, le=180, default=10.0)
    gps_acc_m: float = Field(gt=0, default=20.0)
    taken_at: datetime
    device_meta: dict[str, Any] = Field(default_factory=dict)


class ReportOut(BaseModel):
    id: UUID
    user_id: UUID
    lat: float
    lon: float
    bearing_deg: float
    bearing_acc_deg: float
    gps_acc_m: float
    photo_url: str | None
    taken_at: datetime
    fire_id: UUID | None
    status: str


class ReportSubmitResponse(BaseModel):
    report: ReportOut
    fire_id: UUID | None
    matched: bool


class ReportPublicOut(BaseModel):
    """Public-facing view of a report — no user info."""

    id: UUID
    lat: float
    lon: float
    bearing_deg: float
    bearing_acc_deg: float
    taken_at: datetime
    fire_id: UUID | None
    status: str


class DemoReportCreate(BaseModel):
    """Body for the unauth web-demo report endpoint. No photo."""

    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    bearing_deg: float = Field(ge=0, lt=360)
    bearing_acc_deg: float = Field(gt=0, le=180, default=1.5)
    gps_acc_m: float = Field(gt=0, default=1.0)
