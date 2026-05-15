from fastapi import APIRouter

from app.api.v1 import auth, fire_zones, fires, reports, users, weather

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(fires.router, prefix="/fires", tags=["fires"])
api_router.include_router(weather.router, prefix="/weather", tags=["weather"])
api_router.include_router(fire_zones.router, prefix="/fire-zones", tags=["fire-zones"])
