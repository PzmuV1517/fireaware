"""Drop a single new triangulated fire onto the map for live demos.

The phone/web map polls every 30 s, so within ~30 s of running this script
a new fire marker will appear.

Usage:
    python scripts/demo_new_fire.py                        # random spot in Romania
    python scripts/demo_new_fire.py --lat 45.6 --lon 25.6  # exact location
    python scripts/demo_new_fire.py --n 5                  # 5 observers (default 4)
    python scripts/demo_new_fire.py --staggered            # add observers one
                                                           # at a time with a pause
                                                           # so you can watch the
                                                           # fire emerge as the
                                                           # cluster forms.
"""

import argparse
import random
import sys
import time
from datetime import UTC, datetime, timedelta

sys.path.insert(0, ".")

from app.core.db import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.report import Report  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.synth import synth_observers  # noqa: E402
from app.services.triangulation import recompute_for_region  # noqa: E402

# Bounding box for "somewhere in Romania" random placement
ROMANIA_BBOX = (44.0, 27.0, 47.5, 23.5)  # min_lat, min_lon, max_lat, max_lon


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
    parser.add_argument("--lat", type=float, help="fire latitude (random if omitted)")
    parser.add_argument("--lon", type=float, help="fire longitude (random if omitted)")
    parser.add_argument("--n", type=int, default=4, help="number of observer reports")
    parser.add_argument(
        "--staggered",
        action="store_true",
        help="add observers one at a time with a 6 s pause between them",
    )
    parser.add_argument("--gap", type=float, default=6.0, help="seconds between observers when --staggered")
    args = parser.parse_args()

    rng = random.Random()
    if args.lat is None or args.lon is None:
        min_lat, min_lon, max_lat, max_lon = ROMANIA_BBOX
        lat = rng.uniform(min_lat, max_lat)
        lon = rng.uniform(min(min_lon, max_lon), max(min_lon, max_lon))
    else:
        lat, lon = args.lat, args.lon

    print(f"Injecting fire at ({lat:.5f}, {lon:.5f}) with {args.n} observers")
    observers = synth_observers(lat, lon, n=args.n, rng=rng)

    db = SessionLocal()
    try:
        user = ensure_demo_user(db)
        now = datetime.now(UTC)

        for i, o in enumerate(observers):
            db.add(
                Report(
                    user_id=user.id,
                    location=f"SRID=4326;POINT({o.lon} {o.lat})",
                    bearing_deg=o.bearing_deg,
                    bearing_acc_deg=o.bearing_acc_deg,
                    gps_acc_m=o.gps_acc_m,
                    photo_url=None,
                    taken_at=now - timedelta(seconds=(args.n - i) * 5),
                    device_meta={"demo": True},
                )
            )
            db.commit()
            recompute_for_region(db, lat, lon)
            print(
                f"  observer {i + 1}/{args.n} added from "
                f"({o.lat:.5f},{o.lon:.5f}) bearing {o.bearing_deg:.1f}°"
            )
            if args.staggered and i < len(observers) - 1:
                time.sleep(args.gap)

        print("\nDone. Watch the map — within ~30 s the new fire should appear.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
