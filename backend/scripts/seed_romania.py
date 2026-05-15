"""Seed several active fires across Romania with synthetic observer reports.

Usage:
    python scripts/seed_romania.py            # adds fires (keeps existing data)
    python scripts/seed_romania.py --wipe     # truncates reports + fires first
"""

import argparse
import random
import sys
from datetime import UTC, datetime, timedelta

sys.path.insert(0, ".")

from sqlalchemy import text  # noqa: E402

from app.core.db import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.report import Report  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.synth import synth_observers  # noqa: E402
from app.services.triangulation import recompute_for_region  # noqa: E402

ROMANIA_FIRES = [
    ("Făgăraș Mountains", 45.6000, 24.7300),
    ("Apuseni foothills",  46.5000, 22.9000),
    ("Dobrogea plateau",   44.5000, 28.0000),
    ("Bucegi range",       45.4200, 25.4500),
    ("Maramureș forest",   47.7000, 24.2000),
]


def ensure_demo_user(db):
    user = db.query(User).filter_by(email="demo@fireaware.dev").first()
    if user:
        return user
    user = User(
        email="demo@fireaware.dev",
        password_hash=hash_password("demo-password-123"),
        display_name="Demo Reporter",
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wipe", action="store_true", help="truncate reports + fires first")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for repeatability")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    db = SessionLocal()
    try:
        if args.wipe:
            db.execute(text("TRUNCATE reports, fires RESTART IDENTITY CASCADE"))
            db.commit()
            print("wiped reports + fires")

        user = ensure_demo_user(db)
        now = datetime.now(UTC)

        for label, lat, lon in ROMANIA_FIRES:
            observers = synth_observers(lat, lon, n=rng.randint(3, 5), rng=rng)
            for i, o in enumerate(observers):
                db.add(
                    Report(
                        user_id=user.id,
                        location=f"SRID=4326;POINT({o.lon} {o.lat})",
                        bearing_deg=o.bearing_deg,
                        bearing_acc_deg=o.bearing_acc_deg,
                        gps_acc_m=o.gps_acc_m,
                        photo_url=None,
                        taken_at=now - timedelta(minutes=i * 4 + rng.randint(0, 30)),
                        device_meta={"seed": True, "label": label},
                    )
                )
            db.commit()
            recompute_for_region(db, lat, lon)
            print(f"  ✓ {label:25s} {len(observers)} reports → triangulated near ({lat:.4f},{lon:.4f})")

        print(f"\nDone. Demo user: demo@fireaware.dev / demo-password-123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
