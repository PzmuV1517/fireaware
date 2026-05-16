"""Seed several active fires across Romania with synthetic observer reports,
plus a handful of water reserves nearby for the mission-control view.

Usage:
    python scripts/seed_romania.py            # adds fires (keeps existing data)
    python scripts/seed_romania.py --wipe     # truncates reports + fires first
"""

import argparse
import os
import random
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value

load_env_file(Path(__file__).resolve().parents[1] / ".env")

sys.path.insert(0, ".")

from sqlalchemy import text  # noqa: E402

from app.core.db import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.report import Report  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.water_reserve import WaterReserve  # noqa: E402
from app.services.synth import offset_point, synth_observers  # noqa: E402
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


def seed_water_reserves(db, rng: random.Random) -> int:
    """Place 2 water reserves near each seeded fire location, plus a handful of
    scattered ones across Romania."""
    n = 0
    reserve_names = [
        "Hydrant", "Reservoir", "Pond", "Stream tap", "Lake outflow",
        "Cistern", "Water tower", "Wellpoint",
    ]
    for label, lat, lon in ROMANIA_FIRES:
        for i in range(2):
            brg = rng.uniform(0, 360)
            dist = rng.uniform(800, 3500)  # 0.8 – 3.5 km from the fire
            r_lat, r_lon = offset_point(lat, lon, brg, dist)
            name = f"{rng.choice(reserve_names)} — near {label}"
            db.add(
                WaterReserve(
                    location=f"SRID=4326;POINT({r_lon} {r_lat})",
                    name=name,
                    capacity_l=rng.choice([5_000, 10_000, 25_000, 50_000, None]),
                )
            )
            n += 1
    # a few random extras inside the Romania bbox so mission-control feels populated
    for _ in range(6):
        r_lat = rng.uniform(44.0, 47.5)
        r_lon = rng.uniform(22.5, 28.5)
        db.add(
            WaterReserve(
                location=f"SRID=4326;POINT({r_lon} {r_lat})",
                name=f"{rng.choice(reserve_names)} #{rng.randint(100, 999)}",
                capacity_l=rng.choice([5_000, 15_000, 30_000]),
            )
        )
        n += 1
    db.commit()
    return n


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wipe", action="store_true", help="truncate reports, fires + water reserves first")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for repeatability")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    db = SessionLocal()
    try:
        if args.wipe:
            db.execute(text("TRUNCATE reports, fires, water_reserves RESTART IDENTITY CASCADE"))
            db.commit()
            print("wiped reports + fires + water_reserves")

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

        n_res = seed_water_reserves(db, rng)
        print(f"  ✓ Seeded {n_res} water reserves")

        print(f"\nDone. Demo user: demo@fireaware.dev / demo-password-123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
