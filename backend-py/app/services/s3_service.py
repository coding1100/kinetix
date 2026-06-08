from functools import lru_cache

import boto3
from botocore.config import Config

from app.config import get_settings


@lru_cache
def _s3_client():
    settings = get_settings()
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        config=Config(signature_version="s3v4"),
    )


def presign_put(storage_key: str, content_type: str) -> str:
    settings = get_settings()
    return _s3_client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.s3_attachments_bucket,
            "Key": storage_key,
            "ContentType": content_type,
        },
        ExpiresIn=settings.s3_presign_expires_seconds,
    )


def presign_get(storage_key: str, file_name: str) -> str:
    settings = get_settings()
    return _s3_client().generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.s3_attachments_bucket,
            "Key": storage_key,
            "ResponseContentDisposition": f'inline; filename="{file_name}"',
        },
        ExpiresIn=settings.s3_presign_expires_seconds,
    )


def put_object(storage_key: str, body: bytes, content_type: str) -> None:
    settings = get_settings()
    _s3_client().put_object(
        Bucket=settings.s3_attachments_bucket,
        Key=storage_key,
        Body=body,
        ContentType=content_type,
    )


def object_exists(storage_key: str) -> bool:
    settings = get_settings()
    try:
        _s3_client().head_object(
            Bucket=settings.s3_attachments_bucket,
            Key=storage_key,
        )
        return True
    except Exception:
        return False


def delete_objects(storage_keys: list[str]) -> None:
    if not storage_keys:
        return
    settings = get_settings()
    client = _s3_client()
    for i in range(0, len(storage_keys), 1000):
        batch = storage_keys[i : i + 1000]
        client.delete_objects(
            Bucket=settings.s3_attachments_bucket,
            Delete={"Objects": [{"Key": key} for key in batch]},
        )
