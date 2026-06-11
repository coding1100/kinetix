import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def api_base() -> str:
    return os.environ.get("API_TEST_BASE", "http://127.0.0.1:4001").rstrip("/")


API_BASE = api_base()


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.fixture(scope="session")
def dedicated_api_server():
    """Fresh uvicorn on a free port so live tests avoid stale :4001 processes."""
    port = _free_port()
    base = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            f"--port",
            str(port),
        ],
        cwd=str(BACKEND_ROOT),
        env=os.environ.copy(),
    )
    try:
        ready = False
        for _ in range(60):
            if proc.poll() is not None:
                break
            try:
                res = httpx.get(f"{base}/health", timeout=2)
                if res.status_code == 200 and res.json().get("googleOAuth", {}).get(
                    "routesRegistered"
                ):
                    ready = True
                    break
            except Exception:
                pass
            time.sleep(0.5)
        if not ready:
            pytest.fail("Could not start dedicated API server for live Google OAuth tests")
        os.environ["API_TEST_BASE"] = base
        global API_BASE
        API_BASE = base
        yield base
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def api_client():
    """Shared in-process client; session loop matches global SQLAlchemy async engine."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


def require_py4_server() -> None:
    try:
        res = httpx.get(f"{API_BASE}/health", timeout=10)
        res.raise_for_status()
        phase = res.json().get("phase", "")
        if "PY-4" not in phase and "PY-5" not in phase:
            pytest.skip(f"Server at {API_BASE} is not PY-4+ (phase={phase})")
    except Exception as exc:
        pytest.skip(f"API server not reachable at {API_BASE}: {exc}")


@pytest.fixture(scope="module")
def auth_context():
    require_py4_server()
    login = httpx.post(
        f"{API_BASE}/api/v1/auth/login",
        json={"email": "owner@demo.com", "password": "password123"},
        timeout=60,
    )
    assert login.status_code == 200, login.text
    token = login.json()["accessToken"]
    me = httpx.get(
        f"{API_BASE}/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    assert me.status_code == 200, me.text
    workspace_id = me.json()["workspaces"][0]["id"]
    return {"token": token, "workspace_id": workspace_id}
