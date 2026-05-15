from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Polygon
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.api.deps import require_fireman
from app.models.fire_zone import FireZone
from app.models.user import User
from app.schemas.fire_zone import FireZoneCreate, FireZoneOut

router = APIRouter()

def _zone_to_out(z: FireZone) -> FireZoneOut:
    poly: Polygon = to_shape(z.polygon)
    coords = [[lon, lat] for lon, lat in poly.exterior.coords[:-1]]
    return FireZoneOut(id=z.id, created_by=z.created_by, coordinates=coords,
                       label=z.label, color=z.color, is_active=z.is_active, created_at=z.created_at)

@router.get("", response_model=list[FireZoneOut])
def list_fire_zones(db: Session = Depends(get_db)) -> list[FireZoneOut]:
    zones = db.scalars(select(FireZone).where(FireZone.is_active.is_(True)).order_by(FireZone.created_at.desc())).all()
    return [_zone_to_out(z) for z in zones]

@router.post("", response_model=FireZoneOut, status_code=201)
def create_fire_zone(body: FireZoneCreate, db: Session = Depends(get_db), user: User = Depends(require_fireman)) -> FireZoneOut:
    coords = [(c[0], c[1]) for c in body.coordinates]
    if len(coords) < 3:
        raise HTTPException(status_code=422, detail="Polygon needs at least 3 points")
    poly = Polygon(coords)
    if not poly.is_valid:
        raise HTTPException(status_code=422, detail="Invalid polygon geometry")
    zone = FireZone(created_by=user.id, polygon=from_shape(poly, srid=4326), label=body.label, color=body.color)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return _zone_to_out(zone)

@router.delete("/{zone_id}", status_code=204)
def delete_fire_zone(zone_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_fireman)) -> None:
    zone = db.get(FireZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Fire zone not found")
    zone.is_active = False
    db.commit()
