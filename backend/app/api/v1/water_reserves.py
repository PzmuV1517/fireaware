from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.shape import to_shape
from shapely.geometry import Point
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_fireman
from app.core.db import get_db
from app.models.user import User
from app.models.water_reserve import WaterReserve
from app.schemas.water_reserve import WaterReserveCreate, WaterReserveOut

router = APIRouter()


def _reserve_to_out(r: WaterReserve) -> WaterReserveOut:
    pt: Point = to_shape(r.location)  # type: ignore[arg-type]
    return WaterReserveOut(
        id=r.id,
        lat=pt.y,
        lon=pt.x,
        name=r.name,
        capacity_l=r.capacity_l,
        is_active=r.is_active,
        created_at=r.created_at,
    )


@router.get("", response_model=list[WaterReserveOut])
def list_water_reserves(db: Session = Depends(get_db)) -> list[WaterReserveOut]:
    rows = db.scalars(
        select(WaterReserve)
        .where(WaterReserve.is_active.is_(True))
        .order_by(WaterReserve.created_at.desc())
    ).all()
    return [_reserve_to_out(r) for r in rows]


@router.post("", response_model=WaterReserveOut, status_code=201)
def create_water_reserve(
    body: WaterReserveCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_fireman),
) -> WaterReserveOut:
    reserve = WaterReserve(
        location=f"SRID=4326;POINT({body.lon} {body.lat})",
        name=body.name.strip(),
        capacity_l=body.capacity_l,
    )
    db.add(reserve)
    db.commit()
    db.refresh(reserve)
    return _reserve_to_out(reserve)


@router.delete("/{reserve_id}", status_code=204)
def delete_water_reserve(
    reserve_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_fireman),
) -> None:
    reserve = db.get(WaterReserve, reserve_id)
    if not reserve:
        raise HTTPException(status_code=404, detail="Water reserve not found")
    reserve.is_active = False
    db.commit()
