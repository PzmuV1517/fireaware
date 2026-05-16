from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import LineString
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.api.deps import require_fireman
from app.models.cutting_line import CuttingLine
from app.models.user import User
from app.schemas.cutting_line import CuttingLineCreate, CuttingLineOut

router = APIRouter()

def _line_to_out(l: CuttingLine) -> CuttingLineOut:
    ls: LineString = to_shape(l.path)
    coords = [[lon, lat] for lon, lat in ls.coords]
    return CuttingLineOut(id=l.id, created_by=l.created_by, coordinates=coords,
                          label=l.label, length_m=l.length_m,
                          is_active=l.is_active, created_at=l.created_at)

@router.get("", response_model=list[CuttingLineOut])
def list_cutting_lines(db: Session = Depends(get_db)) -> list[CuttingLineOut]:
    lines = db.scalars(
        select(CuttingLine).where(CuttingLine.is_active.is_(True)).order_by(CuttingLine.created_at.desc())
    ).all()
    return [_line_to_out(l) for l in lines]

@router.post("", response_model=CuttingLineOut, status_code=201)
def create_cutting_line(
    body: CuttingLineCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_fireman),
) -> CuttingLineOut:
    coords = [(c[0], c[1]) for c in body.coordinates]
    if len(coords) < 2:
        raise HTTPException(status_code=422, detail="Line needs at least 2 points")
    ls = LineString(coords)
    ls_wkb = from_shape(ls, srid=4326)
    # Same gotcha as fire-zone area — ST_Length on raw WKB picks the
    # geometry overload (degrees); cast to geography for metres.
    length_m = abs(
        float(
            db.scalar(
                select(func.ST_Length(func.ST_GeogFromText(f"SRID=4326;{ls.wkt}")))
            )
            or 0
        )
    )
    line = CuttingLine(created_by=user.id, path=ls_wkb, label=body.label, length_m=length_m)
    db.add(line)
    db.commit()
    db.refresh(line)
    return _line_to_out(line)

@router.delete("/{line_id}", status_code=204)
def delete_cutting_line(
    line_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_fireman),
) -> None:
    line = db.get(CuttingLine, line_id)
    if not line:
        raise HTTPException(status_code=404, detail="Cutting line not found")
    line.is_active = False
    db.commit()
