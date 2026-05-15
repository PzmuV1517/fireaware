"""Provision fireman accounts from environment variables.

Looks for sequentially-numbered env vars FIREMAN_EMAIL_1/FIREMAN_PASSWORD_1,
FIREMAN_EMAIL_2/FIREMAN_PASSWORD_2, ... and ensures each pair corresponds to a
user with role='fireman'. The env is treated as the source of truth: passwords
are rehashed on every startup, and any account whose email is listed will be
upgraded to fireman if it isn't already.

This is the *only* path that grants the fireman role. The public /auth/register
endpoint always creates civilians.
"""

import logging
import os
from collections.abc import Iterator

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User

log = logging.getLogger(__name__)


def _iter_fireman_creds() -> Iterator[tuple[str, str]]:
    i = 1
    while True:
        email = os.environ.get(f"FIREMAN_EMAIL_{i}")
        password = os.environ.get(f"FIREMAN_PASSWORD_{i}")
        if not email or not password:
            return
        yield email.strip().lower(), password
        i += 1


def seed_firemen(db: Session) -> int:
    """Ensure every FIREMAN_EMAIL_N user exists with role='fireman'. Returns
    the count of accounts touched."""
    touched = 0
    for email, password in _iter_fireman_creds():
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                email=email,
                password_hash=hash_password(password),
                display_name=email.split("@")[0] or "Fireman",
                role="fireman",
                is_verified=True,
            )
            db.add(user)
            log.info("Provisioned new fireman account: %s", email)
        else:
            user.password_hash = hash_password(password)
            user.role = "fireman"
            user.is_verified = True
            log.info("Refreshed fireman account from env: %s", email)
        touched += 1
    if touched:
        db.commit()
    return touched
