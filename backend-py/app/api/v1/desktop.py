import time
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Response, status
from fastapi.responses import RedirectResponse

from app.config import get_settings

router = APIRouter(prefix="/desktop", tags=["desktop"])

# In-process cache of the parsed latest.json AND raw asset list from the
# most recent published (non-draft) GitHub release. Avoids hitting the
# GitHub API on every desktop client's update check (the updater checks on
# every app launch) and keeps this endpoint resilient to brief GitHub API
# outages by serving the last good manifest until the TTL forces a refresh.
_cache: dict[str, Any] = {"manifest": None, "assets": None, "fetched_at": 0.0}


def _parse_version(v_str: str) -> tuple[int, ...]:
    clean = v_str.lstrip("v").strip()
    parts = []
    for p in clean.split("."):
        try:
            parts.append(int(p))
        except ValueError:
            parts.append(0)
    return tuple(parts)


async def _fetch_latest_release() -> None:
    """
    Refreshes the module cache from the most recent published (non-draft)
    GitHub release: its latest.json updater manifest (uploaded automatically
    by tauri-action when release-desktop.yml runs) and its raw asset list
    (used to resolve a human-installable download link, not just the
    updater's own .zip-wrapped artifacts). Draft releases are never
    surfaced here - publishing the draft on GitHub IS the rollout gate for
    this endpoint, matching how releases are already reviewed before going out.
    """
    settings = get_settings()
    now = time.monotonic()
    if _cache["manifest"] is not None and (now - _cache["fetched_at"]) < settings.desktop_update_cache_seconds:
        return

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
                return

            assets = published.get("assets", [])
            manifest_asset = next(
                (a for a in assets if a.get("name") == "latest.json"),
                None,
            )
            if not manifest_asset:
                return

            manifest_res = await client.get(
                manifest_asset["browser_download_url"],
                headers=headers,
                follow_redirects=True,
            )
            manifest_res.raise_for_status()
            manifest = manifest_res.json()
    except (httpx.HTTPError, ValueError):
        # Keep serving the last known-good state rather than breaking every
        # desktop client's update check over a transient GitHub hiccup.
        return

    _cache["manifest"] = manifest
    _cache["assets"] = assets
    _cache["fetched_at"] = now


async def _fetch_latest_manifest() -> Optional[dict[str, Any]]:
    await _fetch_latest_release()
    return _cache["manifest"]


# Maps Tauri's {{target}} URL placeholder to the target keys tauri-action
# writes into latest.json's "platforms" object.
#
# IMPORTANT: the updater plugin's {{target}} placeholder resolves to a bare
# OS name ONLY - "windows", "linux", or "darwin" (see updater_os() in
# tauri-plugin-updater's source). Arch is a SEPARATE {{arch}} placeholder
# ("x86_64", "aarch64", etc.) that this endpoint's URL template in
# tauri.conf.json never includes. This was the actual root cause of updates
# silently never being offered: the endpoint was only ever called as
# /update/windows/<version>, never /update/windows-x86_64/<version> - every
# lookup against these "-x86_64"-suffixed keys missed, every response was
# 204, and the plugin's check() correctly (from its perspective) reported
# "no update available" with zero indication anything was wrong.
# Handles both the bare OS name (what actually arrives) and the fuller
# "<os>-<arch>" form (in case the endpoint URL is ever updated to include
# {{arch}}), so this keeps working either way.
_TARGET_ALIASES: dict[str, list[str]] = {
    "windows": ["windows-x86_64"],
    "windows-x86_64": ["windows-x86_64"],
    "darwin": ["darwin-x86_64", "darwin-aarch64", "darwin-universal"],
    "darwin-x86_64": ["darwin-x86_64", "darwin-universal"],
    "darwin-aarch64": ["darwin-aarch64", "darwin-universal"],
    "linux": ["linux-x86_64"],
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


# Maps a platform key to the substrings that identify its human-installable
# asset (the plain installer a user double-clicks - NOT the .zip-wrapped
# copy the updater manifest points at, which isn't meant to be run directly).
_DOWNLOAD_ASSET_PATTERNS: dict[str, list[str]] = {
    "windows-x86_64": ["-setup.exe"],
    "darwin-aarch64": [".dmg"],
    "darwin-x86_64": [".dmg"],
    "darwin-universal": [".dmg"],
    "linux-x86_64": [".AppImage"],
    "linux-x86_64-deb": [".deb"],
    "linux-x86_64-rpm": [".rpm"],
}


@router.get("/download/{target}")
async def download_desktop_installer(target: str):
    """
    Resolves to the actual (human-installable, not updater-wrapped) asset
    for the given platform on the most recently published release, and
    redirects there. Used as a manual-install fallback for anyone whose
    installed app predates the current signing key and can therefore never
    self-update via the plugin - see the in-app notice that links here.
    """
    await _fetch_latest_release()
    assets = _cache["assets"] or []
    patterns = _DOWNLOAD_ASSET_PATTERNS.get(target, _DOWNLOAD_ASSET_PATTERNS["windows-x86_64"])

    for pattern in patterns:
        match = next(
            (a for a in assets if pattern.lower() in a.get("name", "").lower()),
            None,
        )
        if match:
            return RedirectResponse(match["browser_download_url"])

    return Response(
        content="No installer available for this platform yet.",
        status_code=status.HTTP_404_NOT_FOUND,
    )
