"""Smoke-test Google OAuth wiring (no browser)."""
from __future__ import annotations

import os
import sys
from urllib.parse import parse_qs, urlparse

import httpx
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

API = os.environ.get("API_PUBLIC_URL", "http://127.0.0.1:4000").rstrip("/")
FRONTEND = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def main() -> int:
    print("=== Google OAuth smoke test ===\n")
    failures: list[str] = []

    try:
        health = httpx.get(f"{API}/health", timeout=10)
        health.raise_for_status()
        oauth = health.json().get("googleOAuth", {})
        print(f"API: {API}")
        print(f"configured: {oauth.get('configured')}")
        print(f"redirectUri: {oauth.get('redirectUri')}")
        print(f"frontend: {FRONTEND}\n")
        if not oauth.get("configured"):
            failures.append("Google OAuth not configured on server")
        expected_redirect = f"{API}/api/v1/auth/google/callback"
        if oauth.get("redirectUri") != expected_redirect:
            failures.append(
                f"redirectUri mismatch: {oauth.get('redirectUri')} != {expected_redirect}"
            )
    except Exception as exc:
        print(f"Health check failed: {exc}")
        return 1

    try:
        res = httpx.get(
            f"{API}/api/v1/auth/google/start",
            params={"next": "/home/inbox"},
            follow_redirects=False,
            timeout=15,
        )
        if res.status_code not in (302, 307):
            failures.append(f"start returned {res.status_code}, expected 302")
        else:
            loc = res.headers.get("location", "")
            parsed = urlparse(loc)
            qs = parse_qs(parsed.query)
            if parsed.netloc != "accounts.google.com":
                failures.append(f"start did not redirect to Google: {loc[:120]}")
            elif "client_id" not in qs:
                failures.append("Google URL missing client_id")
            elif qs.get("redirect_uri", [""])[0] != expected_redirect:
                failures.append(
                    f"redirect_uri sent to Google: {qs.get('redirect_uri')} "
                    f"(add this exact URI in Google Cloud Console)"
                )
            else:
                print("PASS: /auth/google/start -> Google with correct redirect_uri")
    except Exception as exc:
        failures.append(f"start request failed: {exc}")

    try:
        res = httpx.get(f"{FRONTEND}/auth/login", timeout=10, follow_redirects=True)
        if res.status_code != 200:
            failures.append(f"frontend login page {res.status_code} at {FRONTEND}")
        else:
            print(f"PASS: frontend reachable at {FRONTEND}")
    except Exception as exc:
        failures.append(f"frontend not reachable at {FRONTEND}: {exc}")

    print()
    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        print(
            "\nGoogle Cloud Console -> APIs & Services -> Credentials -> OAuth client:\n"
            f"  Authorized redirect URIs: {expected_redirect}\n"
            f"  Authorized JavaScript origins: {FRONTEND}\n"
        )
        return 1

    print("All checks passed. Try 'Continue with Google' in the browser.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
