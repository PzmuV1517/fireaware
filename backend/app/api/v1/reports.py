import json
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from geoalchemy2.shape import to_shape
from pydantic import ValidationError
from shapely.geometry import Point
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportOut, ReportPublicOut, ReportSubmitResponse
from app.services.storage import upload_photo
from app.services.triangulation import recompute_for_region

router = APIRouter()


def _report_to_out(r: Report) -> ReportOut:
    pt: Point = to_shape(r.location)  # type: ignore[arg-type]
    return ReportOut(
        id=r.id,
        user_id=r.user_id,
        lat=pt.y,
        lon=pt.x,
        bearing_deg=r.bearing_deg,
        bearing_acc_deg=r.bearing_acc_deg,
        gps_acc_m=r.gps_acc_m,
        photo_url=r.photo_url,
        taken_at=r.taken_at,
        fire_id=r.fire_id,
        status=r.status,
    )


@router.post("", response_model=ReportSubmitResponse, status_code=201)
def create_report(
    payload: str = Form(..., description="JSON-encoded ReportCreate"),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReportSubmitResponse:
    try:
        data = ReportCreate(**json.loads(payload))
    except (ValidationError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=422, detail=f"Invalid payload: {e}") from e

    ext = (photo.filename or "photo.jpg").rsplit(".", 1)[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "heic"}:
        ext = "jpg"
    photo_url = upload_photo(photo.file, photo.content_type or "image/jpeg", ext=ext)

    report = Report(
        user_id=user.id,
        location=f"SRID=4326;POINT({data.lon} {data.lat})",
        bearing_deg=data.bearing_deg,
        bearing_acc_deg=data.bearing_acc_deg,
        gps_acc_m=data.gps_acc_m,
        photo_url=photo_url,
        taken_at=data.taken_at,
        device_meta=data.device_meta,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    fire_id = recompute_for_region(db, center_lat=data.lat, center_lon=data.lon)
    db.refresh(report)
    return ReportSubmitResponse(
        report=_report_to_out(report),
        fire_id=report.fire_id,
        matched=report.fire_id is not None,
    )


def _report_to_public(r: Report) -> ReportPublicOut:
    pt: Point = to_shape(r.location)  # type: ignore[arg-type]
    return ReportPublicOut(
        id=r.id,
        lat=pt.y,
        lon=pt.x,
        bearing_deg=r.bearing_deg,
        bearing_acc_deg=r.bearing_acc_deg,
        taken_at=r.taken_at,
        fire_id=r.fire_id,
        status=r.status,
    )


@router.get("", response_model=list[ReportPublicOut])
def list_reports(
    db: Session = Depends(get_db),
    min_lat: float | None = Query(default=None),
    max_lat: float | None = Query(default=None),
    min_lon: float | None = Query(default=None),
    max_lon: float | None = Query(default=None),
    since_min: int = Query(default=240, ge=1, le=10080, description="reports newer than N minutes"),
    limit: int = Query(default=1000, le=2000),
) -> list[ReportPublicOut]:
    cutoff = datetime.now(UTC) - timedelta(minutes=since_min)
    stmt = select(Report).where(Report.taken_at >= cutoff)
    if None not in (min_lat, max_lat, min_lon, max_lon):
        bbox_wkt = (
            f"SRID=4326;POLYGON(({min_lon} {min_lat},{max_lon} {min_lat},"
            f"{max_lon} {max_lat},{min_lon} {max_lat},{min_lon} {min_lat}))"
        )
        stmt = stmt.where(Report.location.ST_Intersects(func.ST_GeogFromText(bbox_wkt)))  # type: ignore[attr-defined]
    stmt = stmt.order_by(Report.taken_at.desc()).limit(limit)
    return [_report_to_public(r) for r in db.scalars(stmt).all()]


@router.get("/mine", response_model=list[ReportOut])
def my_reports(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
) -> list[ReportOut]:
    rows = db.scalars(
        select(Report).where(Report.user_id == user.id).order_by(Report.created_at.desc()).limit(limit)
    ).all()
    return [_report_to_out(r) for r in rows]
