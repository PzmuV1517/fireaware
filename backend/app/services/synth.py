"""Helpers for generating synthetic reports that triangulate to a chosen point."""

import math
import random
from dataclasses import dataclass

EARTH_R = 6_371_000.0


def offset_point(lat: float, lon: float, bearing_deg: float, distance_m: float) -> tuple[float, float]:
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


def bearing_to(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_lam = math.radians(lon2 - lon1)
    y = math.sin(d_lam) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(d_lam)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


@dataclass
class SynthReport:
    lat: float
    lon: float
    bearing_deg: float
    bearing_acc_deg: float
    gps_acc_m: float


def synth_observers(
    fire_lat: float,
    fire_lon: float,
    n: int = 4,
    min_dist_m: float = 4_000,
    max_dist_m: float = 14_000,
    bearing_noise_deg: float = 0.6,
    rng: random.Random | None = None,
) -> list[SynthReport]:
    """Synthesise `n` observers spread around a fire, each pointing back at it
    with a small amount of compass noise."""
    rng = rng or random.Random()
    out: list[SynthReport] = []
    # spread observers around the fire at roughly even angles, with jitter
    base = rng.uniform(0, 360)
    for i in range(n):
        angle_from_fire = (base + i * (360.0 / n) + rng.uniform(-15, 15)) % 360
        dist = rng.uniform(min_dist_m, max_dist_m)
        olat, olon = offset_point(fire_lat, fire_lon, angle_from_fire, dist)
        true_brg = bearing_to(olat, olon, fire_lat, fire_lon)
        noisy_brg = (true_brg + rng.gauss(0, bearing_noise_deg)) % 360
        out.append(
            SynthReport(
                lat=olat,
                lon=olon,
                bearing_deg=noisy_brg,
                bearing_acc_deg=max(2.0, bearing_noise_deg * 4),
                gps_acc_m=rng.uniform(5, 12),
            )
        )
    return out
