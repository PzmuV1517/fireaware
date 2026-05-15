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
