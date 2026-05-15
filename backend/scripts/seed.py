"""Seed synthetic reports converging on a fictional fire near Lisbon."""

import math
import sys
from datetime import UTC, datetime, timedelta

sys.path.insert(0, ".")

from app.core.db import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.report import Report  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.triangulation import recompute_for_region  # noqa: E402

EARTH_R = 6_371_000.0
FIRE_LAT, FIRE_LON = 38.7223, -9.1393  # Lisbon


def _offset_point(lat, lon, bearing_deg, distance_m):
    brg = math.radians(bearing_deg)
    d = distance_m / EARTH_R
    phi1 = math.radians(lat)
    lam1 = math.radians(lon)
    phi2 = math.asin(math.sin(phi1) * math.cos(d) + math.cos(phi1) * math.sin(d) * math.cos(brg))
    lam2 = lam1 + math.atan2(
        math.sin(brg) * math.sin(d) * math.cos(phi1),
        math.cos(d) - math.sin(phi1) * math.sin(phi2),
    )
    return math.degrees(phi2), math.degrees(lam2)


def _bearing_to(lat1, lon1, lat2, lon2):
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_lam = math.radians(lon2 - lon1)
    y = math.sin(d_lam) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(d_lam)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def main() -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(email="demo@fireaware.dev").first()
        if not user:
            user = User(
                email="demo@fireaware.dev",
                password_hash=hash_password("demo-password-123"),
                display_name="Demo Reporter",
                is_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        now = datetime.now(UTC)
        observers = [
            (45.0, 8000.0),
            (135.0, 9500.0),
            (260.0, 7200.0),
            (320.0, 10500.0),
        ]
        for i, (brg_from_fire, dist) in enumerate(observers):
            olat, olon = _offset_point(FIRE_LAT, FIRE_LON, brg_from_fire, dist)
            brg = _bearing_to(olat, olon, FIRE_LAT, FIRE_LON)
            db.add(
                Report(
                    user_id=user.id,
                    location=f"SRID=4326;POINT({olon} {olat})",
                    bearing_deg=brg + (i - 1) * 0.5,  # slight noise
                    bearing_acc_deg=5.0,
                    gps_acc_m=8.0,
                    photo_url=None,
                    taken_at=now - timedelta(minutes=i * 3),
                    device_meta={"seed": True},
                )
            )
        db.commit()

        recompute_for_region(db, FIRE_LAT, FIRE_LON)
        print("Seeded 4 reports + ran triangulation. Demo user: demo@fireaware.dev / demo-password-123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
