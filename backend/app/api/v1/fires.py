from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from geoalchemy2.shape import to_shape
from shapely.geometry import Point
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_fireman
from app.core.db import get_db
from app.models.fire import Fire
from app.models.report import Report
from app.models.user import User
from app.schemas.fire import FireDetail, FireOut
from app.services.storage import request_base, to_proxied_url

router = APIRouter()


def _fire_to_out(f: Fire) -> FireOut:
    pt: Point = to_shape(f.centroid)  # type: ignore[arg-type]
    return FireOut(
        id=f.id,
        lat=pt.y,
        lon=pt.x,
        confidence=f.confidence,
        report_count=f.report_count,
        first_seen_at=f.first_seen_at,
        last_seen_at=f.last_seen_at,
        is_active=f.is_active,
    )


@router.get("", response_model=list[FireOut])
def list_fires(
    db: Session = Depends(get_db),
    min_lat: float | None = Query(default=None),
    max_lat: float | None = Query(default=None),
    min_lon: float | None = Query(default=None),
    max_lon: float | None = Query(default=None),
    active_only: bool = True,
    limit: int = 500,
) -> list[FireOut]:
    stmt = select(Fire)
    if active_only:
        stmt = stmt.where(Fire.is_active.is_(True))
    if None not in (min_lat, max_lat, min_lon, max_lon):
        bbox_wkt = (
            f"SRID=4326;POLYGON(({min_lon} {min_lat},{max_lon} {min_lat},"
            f"{max_lon} {max_lat},{min_lon} {max_lat},{min_lon} {min_lat}))"
        )
        bbox_geog = func.ST_GeogFromText(bbox_wkt)
        stmt = stmt.where(Fire.centroid.ST_Intersects(bbox_geog))  # type: ignore[attr-defined]
    stmt = stmt.order_by(Fire.last_seen_at.desc()).limit(limit)
    return [_fire_to_out(f) for f in db.scalars(stmt).all()]


@router.get("/{fire_id}", response_model=FireDetail)
def fire_detail(
    fire_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> FireDetail:
    f = db.get(Fire, fire_id)
    if not f:
        raise HTTPException(status_code=404, detail="Fire not found")
    photos = db.scalars(
        select(Report.photo_url)
        .where(Report.fire_id == fire_id, Report.photo_url.is_not(None))
        .order_by(Report.taken_at.desc())
        .limit(20)
    ).all()
    # rewrite stored MinIO URLs so they're reachable from any client that
    # already speaks to this backend
    base_url = request_base(request.url.scheme, request.headers.get("host", request.url.netloc))
    proxied: list[str] = [u for u in (to_proxied_url(base_url, p) for p in photos) if u]
    base = _fire_to_out(f)
    return FireDetail(**base.model_dump(), photo_urls=proxied)


@router.delete("/{fire_id}", status_code=204)
def resolve_fire(
    fire_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_fireman),
) -> None:
    """Mark a fire as resolved. Soft-delete via is_active=false; the row stays
    so its history (linked reports) is preserved."""
    f = db.get(Fire, fire_id)
    if not f:
        raise HTTPException(status_code=404, detail="Fire not found")
    f.is_active = False
    db.commit()
