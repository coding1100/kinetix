from fastapi import UploadFile

from app.config import get_settings
from app.core.errors import AppError

_CHUNK_SIZE = 1024 * 1024


async def read_upload_limited(file: UploadFile, *, max_bytes: int | None = None) -> bytes:
    limit = max_bytes if max_bytes is not None else get_settings().attachment_max_bytes
    chunks: list[bytes] = []
    total = 0

    while True:
        chunk = await file.read(min(_CHUNK_SIZE, limit - total + 1))
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise AppError(
                413,
                "FILE_TOO_LARGE",
                f"File exceeds maximum size of {limit} bytes",
            )
        chunks.append(chunk)

    return b"".join(chunks)
