import time
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Response, status

from app.config import get_settings

router = APIRouter(prefix="/desktop", tags=["desktop"])

# In-process cache of the parsed latest.json from the most recent published
# (non-draft) GitHub release. Avoids hitting the GitHub API on every desktop
# client's update check (the updater checks on every app launch) and keeps
# this endpoint resilient to brief GitHub API outages by serving the last
# good manifest until the TTL forces a refresh.
_cache: dict[str, Any] = {"manifest": None, "fetched_at": 0.0}


def _parse_version(v_str: str) -> tuple[int, ...]:
    clean = v_str.lstrip("v").strip()
    parts = []
    for p in clean.split("."):
        try:
            parts.append(int(p))
        except ValueError:
            parts.append(0)
    return tuple(parts)


async def _fetch_latest_manifest() -> Optional[dict[str, Any]]:
    """
    Finds the most recent published (non-draft) GitHub release that has a
    latest.json updater manifest attached (uploaded automatically by
    tauri-action when release-desktop.yml runs), and returns that manifest
    as-is. Draft releases are never surfaced here - publishing the draft on
    GitHub IS the rollout gate for this endpoint, matching how releases are
    already reviewed before going out.
    """
    settings = get_settings()
    now = time.monotonic()
    if _cache["manifest"] is not None and (now - _cache["fetched_at"]) < settings.desktop_update_cache_seconds:
        return _cache["manifest"]

    headers = {"Accept": "application/vnd.github+json"}
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            releases_res = await client.get(
                f"https://api.github.com/repos/{settings.github_repo}/releases",
                headers=headers,
                params={"per_page": 10},
            )
            releases_res.raise_for_status()
            releases = releases_res.json()

            published = next(
                (r for r in releases if not r.get("draft") and not r.get("prerelease")),
                None,
            )
            if not published:
                return _cache["manifest"]

            manifest_asset = next(
                (a for a in published.get("assets", []) if a.get("name") == "latest.json"),
                None,
            )
            if not manifest_asset:
                return _cache["manifest"]

            manifest_res = await client.get(
                manifest_asset["browser_download_url"],
                headers=headers,
                follow_redirects=True,
            )
            manifest_res.raise_for_status()
            manifest = manifest_res.json()
    except (httpx.HTTPError, ValueError):
        # Serve the last known-good manifest rather than breaking every
        # desktop client's update check over a transient GitHub hiccup.
        return _cache["manifest"]

    _cache["manifest"] = manifest
    _cache["fetched_at"] = now
    return manifest


# Maps Tauri's {{target}} URL placeholder (its own platform identifiers) to
# the target keys tauri-action writes into latest.json's "platforms" object.
_TARGET_ALIASES: dict[str, list[str]] = {
    "windows-x86_64": ["windows-x86_64"],
    "darwin-x86_64": ["darwin-x86_64", "darwin-universal"],
    "darwin-aarch64": ["darwin-aarch64", "darwin-universal"],
    "linux-x86_64": ["linux-x86_64"],
}


@router.get("/update/{target}/{current_version}")
@router.get("/update")
async def check_desktop_update(
    target: Optional[str] = None,
    current_version: Optional[str] = None,
):
    """
    Tauri v2 native binary update endpoint. Proxies the latest.json
    manifest from the most recently PUBLISHED (non-draft) GitHub release,
    rather than hardcoded values - publishing a release on GitHub is what
    makes it live to desktop clients.
    Returns HTTP 204 if current_version is already up to date, or if no
    manifest/matching platform entry is available yet.
    Returns HTTP 200 with the update JSON manifest otherwise.
    """
    manifest = await _fetch_latest_manifest()
    if not manifest:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    latest_version = manifest.get("version", "")
    if current_version and latest_version:
        if _parse_version(current_version) >= _parse_version(latest_version):
            return Response(status_code=status.HTTP_204_NO_CONTENT)

    platforms = manifest.get("platforms", {})
    target_key = target or "windows-x86_64"
    for candidate in _TARGET_ALIASES.get(target_key, [target_key]):
        if candidate in platforms:
            return {
                "version": latest_version,
                "notes": manifest.get("notes", ""),
                "pub_date": manifest.get("pub_date", ""),
                "platforms": {target_key: platforms[candidate]},
            }

    return Response(status_code=status.HTTP_204_NO_CONTENT)
