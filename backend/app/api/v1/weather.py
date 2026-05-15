from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

import httpx

router = APIRouter()

_DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def _deg_to_cardinal(deg: float) -> str:
    return _DIRS[round(deg / 45) % 8]


class WeatherOut(BaseModel):
    temperature: float
    wind_speed: float
    wind_direction_deg: float
    wind_direction: str


@router.get("", response_model=WeatherOut)
def get_weather(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
) -> WeatherOut:
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "hourly": "temperature_2m,wind_speed_10m,wind_direction_10m",
                    "models": "ecmwf_aifs025_single",
                    "timezone": "auto",
                    "forecast_days": 1,
                },
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Weather API error: {e.response.status_code}") from e
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Weather API unreachable")

    body = resp.json()
    hourly = body.get("hourly", {})
    times: list[str] = hourly.get("time", [])

    # find the index matching the current local hour at the requested coordinates
    utc_offset = int(body.get("utc_offset_seconds", 0))
    local_now = datetime.now(timezone.utc) + timedelta(seconds=utc_offset)
    current_hour = local_now.strftime("%Y-%m-%dT%H:00")

    try:
        idx = times.index(current_hour)
    except ValueError:
        idx = 0

    temp = float((hourly.get("temperature_2m") or [0])[idx] or 0)
    speed = float((hourly.get("wind_speed_10m") or [0])[idx] or 0)
    direction = float((hourly.get("wind_direction_10m") or [0])[idx] or 0)

    return WeatherOut(
        temperature=temp,
        wind_speed=speed,
        wind_direction_deg=direction,
        wind_direction=_deg_to_cardinal(direction),
    )
