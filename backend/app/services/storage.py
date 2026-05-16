import uuid
from typing import BinaryIO

import boto3
from botocore.client import Config

from app.core.config import get_settings

settings = get_settings()


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def upload_photo(fileobj: BinaryIO, content_type: str, ext: str = "jpg") -> str:
    """Upload a photo, return its public URL."""
    key = f"reports/{uuid.uuid4().hex}.{ext}"
    _client().upload_fileobj(
        fileobj,
        settings.s3_bucket,
        key,
        ExtraArgs={"ContentType": content_type, "ACL": "public-read"},
    )
    return f"{settings.s3_public_base_url}/{key}"


def to_proxied_url(request_base: str, stored: str | None) -> str | None:
    """Rewrite a stored S3 photo URL so it points at the backend's photo
    proxy (`/api/v1/photos/<key>`) at the host the client used to reach us.

    Mobile clients can't necessarily resolve the configured MinIO host
    (e.g. `localhost`), but they can always reach the backend they're already
    talking to. Returning a URL relative to `request_base` makes photos work
    on any device regardless of MinIO/network config.
    """
    if not stored:
        return stored
    prefix = settings.s3_public_base_url.rstrip("/") + "/"
    if stored.startswith(prefix):
        key = stored[len(prefix) :]
        return f"{request_base.rstrip('/')}/api/v1/photos/{key}"
    # already absolute external URL — leave it alone
    return stored


def request_base(scheme: str, netloc: str) -> str:
    return f"{scheme}://{netloc}"
