"""Proxy report photos through the backend.

Photos are uploaded straight to MinIO/S3, but the public URLs we generated
back when we stored them (`http://localhost:9000/...`) aren't reachable from
a phone on the same LAN as the laptop. Streaming them through this endpoint
means the only host the client ever needs to know about is the backend.
"""

from typing import cast

import boto3
from botocore.client import Config
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.core.config import get_settings

settings = get_settings()
router = APIRouter()


def _s3():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


@router.get("/{key:path}")
def get_photo(key: str):
    try:
        obj = _s3().get_object(Bucket=settings.s3_bucket, Key=key)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Photo not found: {e}") from e
    body = cast(object, obj["Body"])
    content_type = obj.get("ContentType", "application/octet-stream")
    return StreamingResponse(body.iter_chunks(), media_type=content_type)  # type: ignore[attr-defined]
