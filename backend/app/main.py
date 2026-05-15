import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

# Load .env into os.environ before anything else reads from it.
# pydantic-settings reads .env into the Settings model but does NOT export it
# back to os.environ, so helpers like seed_firemen (which use os.environ.get)
# wouldn't see FIREMAN_EMAIL_N otherwise.
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.api.v1 import api_router  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.db import SessionLocal  # noqa: E402
from app.services.fireman_seed import seed_firemen  # noqa: E402

settings = get_settings()
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # provision fireman accounts from env on startup — this is the only path
    # that grants the fireman role
    with SessionLocal() as db:
        n = seed_firemen(db)
        log.info("Fireman sync: %d account(s) from env", n)
    yield


app = FastAPI(title="FireAware API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
