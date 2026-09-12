import pytest

from app.api.v1 import desktop


@pytest.fixture(autouse=True)
def reset_cache():
    desktop._cache["manifest"] = None
    desktop._cache["assets"] = None
    desktop._cache["fetched_at"] = 0.0
    yield
    desktop._cache["manifest"] = None
    desktop._cache["assets"] = None
    desktop._cache["fetched_at"] = 0.0


def test_parse_version():
    assert desktop._parse_version("v1.2.3") == (1, 2, 3)
    assert desktop._parse_version("1.2.3") == (1, 2, 3)
    assert desktop._parse_version("0.1.4") < desktop._parse_version("0.1.10")


@pytest.mark.asyncio
async def test_resolves_bare_os_name_from_real_updater_plugin(monkeypatch):
    """
    Regression test for the actual production bug: tauri-plugin-updater's
    {{target}} placeholder resolves to a BARE os name ("windows", "linux",
    "darwin") via its own updater_os() - never "windows-x86_64" - since
    arch is a separate {{arch}} placeholder our endpoint URL never uses.
    Before this fix, every real desktop client's check() request looked up
    "windows" against _TARGET_ALIASES/platforms keyed by "windows-x86_64",
    missed, and got 204 - so updates were NEVER offered to any real client,
    while manual curl testing with an explicit "windows-x86_64" in the URL
    looked completely fine and masked the bug for a long time.
    """
    async def fake_fetch():
        return {
            "version": "0.1.6",
            "notes": "",
            "pub_date": "2026-01-01T00:00:00Z",
            "platforms": {
                "windows-x86_64": {"signature": "winsig", "url": "https://example.com/win.msi.zip"},
            },
        }

    monkeypatch.setattr(desktop, "_fetch_latest_manifest", fake_fetch)

    # This is the literal request shape a real Windows client sends.
    result = await desktop.check_desktop_update(target="windows", current_version="0.1.5")
    assert result["version"] == "0.1.6"
    assert result["platforms"]["windows"]["signature"] == "winsig"


@pytest.mark.asyncio
async def test_returns_204_when_no_manifest_available(monkeypatch):
    async def fake_fetch():
        return None

    monkeypatch.setattr(desktop, "_fetch_latest_manifest", fake_fetch)
    result = await desktop.check_desktop_update(target="windows-x86_64", current_version="0.1.0")
    assert result.status_code == 204


@pytest.mark.asyncio
async def test_returns_204_when_already_up_to_date(monkeypatch):
    async def fake_fetch():
        return {
            "version": "0.1.4",
            "notes": "",
            "pub_date": "2026-01-01T00:00:00Z",
            "platforms": {"windows-x86_64": {"signature": "sig", "url": "https://example.com/x.msi"}},
        }

    monkeypatch.setattr(desktop, "_fetch_latest_manifest", fake_fetch)
    result = await desktop.check_desktop_update(target="windows-x86_64", current_version="0.1.4")
    assert result.status_code == 204

    result_newer = await desktop.check_desktop_update(target="windows-x86_64", current_version="0.2.0")
    assert result_newer.status_code == 204


@pytest.mark.asyncio
async def test_returns_manifest_for_matching_target(monkeypatch):
    async def fake_fetch():
        return {
            "version": "0.1.4",
            "notes": "Bug fixes",
            "pub_date": "2026-01-01T00:00:00Z",
            "platforms": {
                "windows-x86_64": {"signature": "winsig", "url": "https://example.com/win.msi"},
                "darwin-universal": {"signature": "macsig", "url": "https://example.com/mac.app.tar.gz"},
            },
        }

    monkeypatch.setattr(desktop, "_fetch_latest_manifest", fake_fetch)

    result = await desktop.check_desktop_update(target="windows-x86_64", current_version="0.1.0")
    assert result["version"] == "0.1.4"
    assert result["platforms"]["windows-x86_64"]["signature"] == "winsig"


@pytest.mark.asyncio
async def test_resolves_darwin_alias_to_universal_build(monkeypatch):
    async def fake_fetch():
        return {
            "version": "0.1.4",
            "notes": "",
            "pub_date": "2026-01-01T00:00:00Z",
            "platforms": {
                "darwin-universal": {"signature": "macsig", "url": "https://example.com/mac.app.tar.gz"},
            },
        }

    monkeypatch.setattr(desktop, "_fetch_latest_manifest", fake_fetch)

    result = await desktop.check_desktop_update(target="darwin-aarch64", current_version="0.1.0")
    assert result["platforms"]["darwin-aarch64"]["signature"] == "macsig"


@pytest.mark.asyncio
async def test_returns_204_when_target_not_in_manifest(monkeypatch):
    async def fake_fetch():
        return {
            "version": "0.1.4",
            "notes": "",
            "pub_date": "2026-01-01T00:00:00Z",
            "platforms": {"windows-x86_64": {"signature": "winsig", "url": "https://example.com/win.msi"}},
        }

    monkeypatch.setattr(desktop, "_fetch_latest_manifest", fake_fetch)

    result = await desktop.check_desktop_update(target="linux-x86_64", current_version="0.1.0")
    assert result.status_code == 204


@pytest.mark.asyncio
async def test_fetch_skips_draft_and_prerelease_releases(monkeypatch):
    """The draft-release gate is the actual rollout control - never surface a draft/prerelease as latest."""

    class FakeResponse:
        def __init__(self, json_data):
            self._json = json_data

        def raise_for_status(self):
            pass

        def json(self):
            return self._json

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, **kwargs):
            if "releases" in url and "latest.json" not in url:
                return FakeResponse(
                    [
                        {"draft": True, "prerelease": False, "assets": []},
                        {"draft": False, "prerelease": True, "assets": []},
                        {
                            "draft": False,
                            "prerelease": False,
                            "assets": [
                                {
                                    "name": "latest.json",
                                    "browser_download_url": "https://example.com/latest.json",
                                }
                            ],
                        },
                    ]
                )
            return FakeResponse(
                {
                    "version": "0.1.4",
                    "notes": "",
                    "pub_date": "2026-01-01T00:00:00Z",
                    "platforms": {"windows-x86_64": {"signature": "sig", "url": "https://x"}},
                }
            )

    monkeypatch.setattr(desktop.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(
        desktop.get_settings(),
        "github_token",
        "",
        raising=False,
    )

    manifest = await desktop._fetch_latest_manifest()
    assert manifest is not None
    assert manifest["version"] == "0.1.4"


def _set_release_assets(names: list[str]):
    desktop._cache["assets"] = [
        {"name": name, "browser_download_url": f"https://example.com/{name}"}
        for name in names
    ]
    desktop._cache["manifest"] = {"version": "0.1.4"}
    desktop._cache["fetched_at"] = desktop.time.monotonic()


@pytest.mark.asyncio
async def test_download_redirects_to_windows_installer(monkeypatch):
    _set_release_assets(
        ["Kinetix_0.1.4_x64-setup.exe", "Kinetix_0.1.4_x64-setup.exe.sig", "Kinetix_0.1.4_x64_en-US.msi.zip"]
    )

    async def noop_fetch():
        return None

    monkeypatch.setattr(desktop, "_fetch_latest_release", noop_fetch)

    result = await desktop.download_desktop_installer("windows-x86_64")
    assert result.status_code == 307
    assert result.headers["location"] == "https://example.com/Kinetix_0.1.4_x64-setup.exe"


@pytest.mark.asyncio
async def test_download_redirects_to_mac_dmg(monkeypatch):
    _set_release_assets(["Kinetix_0.1.4_universal.dmg", "Kinetix_universal.app.tar.gz"])

    async def noop_fetch():
        return None

    monkeypatch.setattr(desktop, "_fetch_latest_release", noop_fetch)

    result = await desktop.download_desktop_installer("darwin-aarch64")
    assert result.status_code == 307
    assert result.headers["location"] == "https://example.com/Kinetix_0.1.4_universal.dmg"


@pytest.mark.asyncio
async def test_download_returns_404_when_no_matching_asset(monkeypatch):
    _set_release_assets(["Kinetix_0.1.4_x64-setup.exe"])

    async def noop_fetch():
        return None

    monkeypatch.setattr(desktop, "_fetch_latest_release", noop_fetch)

    result = await desktop.download_desktop_installer("linux-x86_64")
    assert result.status_code == 404
