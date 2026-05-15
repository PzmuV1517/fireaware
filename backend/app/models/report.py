import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    location = mapped_column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    bearing_deg: Mapped[float] = mapped_column(Float, nullable=False)
    bearing_acc_deg: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)
    gps_acc_m: Mapped[float] = mapped_column(Float, nullable=False, default=20.0)

    photo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    taken_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    device_meta: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    fire_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fires.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
