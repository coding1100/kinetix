from typing import Optional
from fastapi import APIRouter, Response, status

router = APIRouter(prefix="/desktop", tags=["desktop"])

LATEST_NATIVE_VERSION = "0.1.4"
LATEST_RELEASE_NOTES = "Native Windows browser permissions & desktop capability update"
LATEST_RELEASE_URL = "https://kinetix.mindrind.com/downloads/Kinetix_0.1.4_x64-setup.nsis.zip"
LATEST_RELEASE_PUB_DATE = "2026-08-18T20:00:00Z"
LATEST_RELEASE_SIGNATURE = ""


def _parse_version(v_str: str) -> tuple[int, ...]:
    clean = v_str.lstrip("v").strip()
    parts = []
    for p in clean.split("."):
        try:
            parts.append(int(p))
        except ValueError:
            parts.append(0)
    return tuple(parts)


@router.get("/update/{target}/{current_version}")
@router.get("/update")
async def check_desktop_update(
    target: Optional[str] = None,
    current_version: Optional[str] = None,
):
    """
    Tauri v2 Native Binary Update Endpoint.
    Returns HTTP 204 No Content if current_version >= LATEST_NATIVE_VERSION.
    Returns HTTP 200 with update JSON manifest if current_version < LATEST_NATIVE_VERSION.
    """
    if current_version:
        cur_v = _parse_version(current_version)
        latest_v = _parse_version(LATEST_NATIVE_VERSION)
        if cur_v >= latest_v:
            return Response(status_code=status.HTTP_204_NO_CONTENT)

    target_key = target or "windows-x86_64"
    return {
        "version": LATEST_NATIVE_VERSION,
        "notes": LATEST_RELEASE_NOTES,
        "pub_date": LATEST_RELEASE_PUB_DATE,
        "platforms": {
            target_key: {
                "signature": LATEST_RELEASE_SIGNATURE,
                "url": LATEST_RELEASE_URL,
            }
        },
    }
