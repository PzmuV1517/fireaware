"""Bearing-ray triangulation + clustering.

For each new report, pull recent nearby reports, intersect bearing rays pairwise,
DBSCAN the intersection points, and upsert one Fire per cluster.
"""

import math
from datetime import UTC, datetime, timedelta
from uuid import UUID

import numpy as np
from geoalchemy2.shape import to_shape
from shapely.geometry import Point
from sklearn.cluster import DBSCAN
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.fire import Fire
from app.models.report import Report

settings = get_settings()

EARTH_R = 6_371_000.0  # meters


def _to_rad(d: float) -> float:
    return d * math.pi / 180.0


def _to_deg(r: float) -> float:
    return r * 180.0 / math.pi


def _great_circle_intersection(
    lat1: float, lon1: float, brg1: float, lat2: float, lon2: float, brg2: float
) -> tuple[float, float] | None:
    """Intersection of two great-circle paths defined by start point + initial bearing.

    Returns (lat, lon) of the forward intersection (in front of both origins), or None
    if rays are parallel or intersection is behind one of the origins.

    Reference: Ed Williams' aviation formulary, "intersection of two paths".
    """
    phi1, lam1 = _to_rad(lat1), _to_rad(lon1)
    phi2, lam2 = _to_rad(lat2), _to_rad(lon2)
    theta13 = _to_rad(brg1 % 360.0)
    theta23 = _to_rad(brg2 % 360.0)

    d_phi = phi2 - phi1
    d_lam = lam2 - lam1

    # angular distance between p1 and p2
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    delta12 = 2 * math.asin(min(1.0, math.sqrt(a)))
    if delta12 == 0:
        return None

    # initial / final bearings between p1 and p2
    cos_theta_a = (math.sin(phi2) - math.sin(phi1) * math.cos(delta12)) / (
        math.sin(delta12) * math.cos(phi1)
    )
    cos_theta_b = (math.sin(phi1) - math.sin(phi2) * math.cos(delta12)) / (
        math.sin(delta12) * math.cos(phi2)
    )
    cos_theta_a = max(-1.0, min(1.0, cos_theta_a))
    cos_theta_b = max(-1.0, min(1.0, cos_theta_b))
    theta_a = math.acos(cos_theta_a)
    theta_b = math.acos(cos_theta_b)
    if math.sin(d_lam) > 0:
        theta12 = theta_a
        theta21 = 2 * math.pi - theta_b
    else:
        theta12 = 2 * math.pi - theta_a
        theta21 = theta_b

    alpha1 = theta13 - theta12
    alpha2 = theta21 - theta23
    if math.sin(alpha1) == 0 and math.sin(alpha2) == 0:
        return None  # infinite intersections
    if math.sin(alpha1) * math.sin(alpha2) < 0:
        return None  # ambiguous / behind

    cos_alpha3 = -math.cos(alpha1) * math.cos(alpha2) + math.sin(alpha1) * math.sin(alpha2) * math.cos(
        delta12
    )
    delta13 = math.atan2(
        math.sin(delta12) * math.sin(alpha1) * math.sin(alpha2),
        math.cos(alpha2) + math.cos(alpha1) * cos_alpha3,
    )
    if delta13 < 0:
        return None  # behind p1

    phi3 = math.asin(
        math.sin(phi1) * math.cos(delta13) + math.cos(phi1) * math.sin(delta13) * math.cos(theta13)
    )
    d_lam13 = math.atan2(
        math.sin(theta13) * math.sin(delta13) * math.cos(phi1),
        math.cos(delta13) - math.sin(phi1) * math.sin(phi3),
    )
    lam3 = lam1 + d_lam13
    return _to_deg(phi3), ((_to_deg(lam3) + 540) % 360) - 180


def _bearing_from(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = _to_rad(lat1), _to_rad(lat2)
    d_lam = _to_rad(lon2 - lon1)
    y = math.sin(d_lam) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(d_lam)
    return (_to_deg(math.atan2(y, x)) + 360) % 360


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = _to_rad(lat1), _to_rad(lat2)
    d_phi = _to_rad(lat2 - lat1)
    d_lam = _to_rad(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return 2 * EARTH_R * math.asin(min(1.0, math.sqrt(a)))


def _within_wedge(report: Report, lat: float, lon: float) -> bool:
    """Is (lat, lon) inside the bearing wedge of this report?"""
    origin: Point = to_shape(report.location)  # type: ignore[arg-type]
    actual_brg = _bearing_from(origin.y, origin.x, lat, lon)
    diff = abs(((actual_brg - report.bearing_deg + 540) % 360) - 180)
    return diff <= report.bearing_acc_deg


def recompute_for_region(db: Session, center_lat: float, center_lon: float) -> UUID | None:
    """Recompute fires in a region around (center_lat, center_lon).

    Two clustering passes run in order:
      1. Proximity — any group of >= proximity_min_samples reports whose origins
         lie within proximity_eps_m of each other becomes a fire at their centroid,
         regardless of bearing. Models the case of multiple eyewitnesses
         physically gathered near the fire.
      2. Bearing triangulation — pairwise great-circle intersection of remaining
         reports' bearing rays, then DBSCAN-clustered. Models the case of distant
         observers triangulating a fire from afar.

    Returns the fire id matched to the most recent report, if any.
    """
    now = datetime.now(UTC)
    cutoff = now - timedelta(minutes=settings.triangulation_time_window_min)
    radius_m = settings.triangulation_radius_km * 1000.0

    center_geog = func.ST_GeogFromText(f"SRID=4326;POINT({center_lon} {center_lat})")
    reports = db.scalars(
        select(Report)
        .where(
            Report.taken_at >= cutoff,
            Report.location.ST_DWithin(center_geog, radius_m * 2),  # type: ignore[attr-defined]
        )
        .order_by(Report.taken_at.desc())
        .limit(500)
    ).all()

    # always reset assignments in the working set; we'll repopulate below
    for r in reports:
        r.status = "pending"
        r.fire_id = None

    # clear existing fires in the working region
    existing = db.scalars(
        select(Fire).where(Fire.centroid.ST_DWithin(center_geog, radius_m * 2))  # type: ignore[attr-defined]
    ).all()
    for f in existing:
        db.delete(f)
    db.flush()

    if not reports:
        db.commit()
        return None

    # local equirectangular projection anchored at the region centre
    cos_lat0 = math.cos(_to_rad(center_lat))

    def project(lat: float, lon: float) -> tuple[float, float]:
        x = _to_rad(lon - center_lon) * EARTH_R * cos_lat0
        y = _to_rad(lat - center_lat) * EARTH_R
        return x, y

    def unproject(x: float, y: float) -> tuple[float, float]:
        lat = center_lat + _to_deg(y / EARTH_R)
        lon = center_lon + _to_deg(x / (EARTH_R * cos_lat0))
        return lat, lon

    report_points: list[tuple[float, float]] = []
    for r in reports:
        p: Point = to_shape(r.location)  # type: ignore[arg-type]
        report_points.append(project(p.y, p.x))

    claimed_report_ids: set = set()
    last_fire_id: UUID | None = None

    # --- pass 1: proximity clustering on report origins
    if len(reports) >= settings.proximity_min_samples:
        prox_labels = DBSCAN(
            eps=settings.proximity_eps_m,
            min_samples=settings.proximity_min_samples,
        ).fit_predict(np.array(report_points))

        prox_clusters: dict[int, list[int]] = {}
        for idx, label in enumerate(prox_labels):
            if label == -1:
                continue
            prox_clusters.setdefault(label, []).append(idx)

        for indices in prox_clusters.values():
            xs = np.array([report_points[i] for i in indices])
            cx, cy = xs.mean(axis=0)
            clat, clon = unproject(cx, cy)
            spread = float(np.mean(np.linalg.norm(xs - xs.mean(axis=0), axis=1)))
            contributing = [reports[i] for i in indices]
            n = len(contributing)
            # proximity is a strong signal: more witnesses + tighter cluster = higher
            confidence = max(0.0, min(1.0, (n / 4.0) * math.exp(-spread / 200.0)))
            fire = Fire(
                centroid=f"SRID=4326;POINT({clon} {clat})",
                confidence=confidence,
                report_count=n,
                first_seen_at=min(r.taken_at for r in contributing),
                last_seen_at=max(r.taken_at for r in contributing),
                is_active=True,
            )
            db.add(fire)
            db.flush()
            for r in contributing:
                r.fire_id = fire.id
                r.status = "matched"
                claimed_report_ids.add(r.id)
            last_fire_id = fire.id

    # --- pass 2: bearing triangulation on still-unclaimed reports
    remaining = [r for r in reports if r.id not in claimed_report_ids]
    if len(remaining) >= 2:
        intersections: list[tuple[float, float, list[Report]]] = []
        for i in range(len(remaining)):
            for j in range(i + 1, len(remaining)):
                a, b = remaining[i], remaining[j]
                pa: Point = to_shape(a.location)  # type: ignore[arg-type]
                pb: Point = to_shape(b.location)  # type: ignore[arg-type]
                pt = _great_circle_intersection(
                    pa.y, pa.x, a.bearing_deg, pb.y, pb.x, b.bearing_deg
                )
                if pt is None:
                    continue
                lat, lon = pt
                if not _within_wedge(a, lat, lon) or not _within_wedge(b, lat, lon):
                    continue
                d_a = _haversine_m(pa.y, pa.x, lat, lon)
                d_b = _haversine_m(pb.y, pb.x, lat, lon)
                if max(d_a, d_b) > radius_m:
                    continue
                intersections.append((lat, lon, [a, b]))

        if intersections:
            xy = np.array([project(p[0], p[1]) for p in intersections])
            labels = DBSCAN(eps=settings.cluster_eps_m, min_samples=2).fit_predict(xy)

            tri_clusters: dict[int, dict] = {}
            for idx, label in enumerate(labels):
                if label == -1:
                    continue
                c = tri_clusters.setdefault(label, {"pts": [], "reports": set()})
                c["pts"].append(xy[idx])
                for r in intersections[idx][2]:
                    c["reports"].add(r.id)

            report_by_id = {r.id: r for r in remaining}
            for cluster in tri_clusters.values():
                pts = np.array(cluster["pts"])
                cx, cy = pts.mean(axis=0)
                clat, clon = unproject(cx, cy)
                spread = float(np.mean(np.linalg.norm(pts - pts.mean(axis=0), axis=1)))
                n = len(cluster["reports"])
                confidence = max(0.0, min(1.0, (n / 5.0) * math.exp(-spread / 500.0)))
                contributing = [report_by_id[rid] for rid in cluster["reports"]]
                fire = Fire(
                    centroid=f"SRID=4326;POINT({clon} {clat})",
                    confidence=confidence,
                    report_count=n,
                    first_seen_at=min(r.taken_at for r in contributing),
                    last_seen_at=max(r.taken_at for r in contributing),
                    is_active=True,
                )
                db.add(fire)
                db.flush()
                for r in contributing:
                    r.fire_id = fire.id
                    r.status = "matched"
                last_fire_id = fire.id

    db.commit()
    return last_fire_id
