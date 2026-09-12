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
    Regression test for TWO stacked production bugs, both confirmed by
    reading tauri-plugin-updater's own Rust source (and, for the second
    one, by a live client's console literally throwing the error this
    test asserts against):

    1. The {{target}} URL placeholder (what arrives as `target` here)
       resolves to a BARE os name via updater_os() - "windows"/"linux"/
       "darwin" - never "windows-x86_64". Arch is a separate {{arch}}
       placeholder our endpoint URL template never uses. A first fix
       attempt handled this by echoing the response back keyed by
       whatever bare name arrived...

    2. ...but that's wrong too: get_urls() in the plugin - called AFTER a
       successful check(), to actually pick the download URL/signature -
       ignores the request's target entirely and searches the RESPONSE
       BODY's platforms object for ["{os}-{arch}-{installer}", "{os}-{arch}"]
       (e.g. "windows-x86_64-nsis" then "windows-x86_64") directly. Echoing
       "windows" in the response satisfied neither of those, and threw
       "None of the fallback platforms... were found in the response
       platforms object" - visible directly in a live app's DevTools
       console once check() was fixed to stop returning null.

    The only response shape that satisfies both is the manifest's own,
    untouched "{os}-{arch}[-installer]" keys - never remapped to the bare
    name from the URL.
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
    # Must be the manifest's canonical key, NOT "windows" (the request's
    # bare target) - that's exactly what get_urls() searches for.
    assert result["platforms"]["windows-x86_64"]["signature"] == "winsig"
    assert "windows" not in result["platforms"]


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
    # Returned key is the manifest's own "darwin-universal", not the
    # request's "darwin-aarch64" - get_urls() looks for "{os}-{arch}..."
    # keys in the response body itself, so the real manifest key must be
    # preserved rather than remapped to whatever the request asked for.
    assert result["platforms"]["darwin-universal"]["signature"] == "macsig"


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
