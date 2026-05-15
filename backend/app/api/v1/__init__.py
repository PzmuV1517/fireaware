from fastapi import APIRouter

from app.api.v1 import auth, cutting_lines, fire_zones, fires, reports, users, water_reserves, weather

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(fires.router, prefix="/fires", tags=["fires"])
api_router.include_router(weather.router, prefix="/weather", tags=["weather"])
api_router.include_router(fire_zones.router, prefix="/fire-zones", tags=["fire-zones"])
api_router.include_router(water_reserves.router, prefix="/water-reserves", tags=["water-reserves"])
api_router.include_router(cutting_lines.router, prefix="/cutting-lines", tags=["cutting-lines"])
