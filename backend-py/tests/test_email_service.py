"""SMTP invite email helpers."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.services import email_service


def test_is_smtp_configured_false_by_default(monkeypatch):
    class FakeSettings:
        smtp_host = ""
        smtp_from = ""
        smtp_user = ""

    monkeypatch.setattr(
        "app.services.email_service.get_settings", lambda: FakeSettings()
    )
    assert email_service.is_smtp_configured() is False


@pytest.mark.asyncio
async def test_send_workspace_invite_calls_smtp(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_FROM", "test@example.com")
    monkeypatch.setenv("SMTP_USER", "test@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")

    sent: list[str] = []

    def fake_send(**kwargs):
        sent.append(kwargs["to"])

    monkeypatch.setattr(email_service, "_send_sync", fake_send)

    await email_service.send_workspace_invite_email(
        to="invitee@example.com",
        workspace_name="Acme",
        inviter_name="Owner",
        invite_url="http://localhost:3001/invite/accept?token=abc",
        role="MEMBER",
        expires_at=datetime(2026, 1, 8, tzinfo=timezone.utc),
    )
    assert sent == ["invitee@example.com"]


@pytest.mark.asyncio
async def test_send_workspace_invite_prefers_resend(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setenv("RESEND_FROM", "invites@example.com")

    calls: list[dict] = []

    async def fake_send_via_resend(**kwargs):
        calls.append(kwargs)

    def fail_send_sync(**kwargs):
        raise AssertionError("SMTP should not be used when Resend is configured")

    monkeypatch.setattr(email_service, "_send_via_resend", fake_send_via_resend)
    monkeypatch.setattr(email_service, "_send_sync", fail_send_sync)

    await email_service.send_workspace_invite_email(
        to="invitee@example.com",
        workspace_name="Acme",
        inviter_name="Owner",
        invite_url="http://localhost:3001/invite/accept?token=abc",
        role="MEMBER",
        expires_at=datetime(2026, 1, 8, tzinfo=timezone.utc),
    )
    assert calls[0]["to"] == "invitee@example.com"


@pytest.mark.asyncio
async def test_send_via_resend_calls_api(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setenv("RESEND_FROM", "invites@example.com")

    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            pass

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, headers=None, json=None):
            captured["url"] = url
            captured["headers"] = headers
            captured["json"] = json
            return FakeResponse()

    monkeypatch.setattr(email_service.httpx, "AsyncClient", FakeAsyncClient)

    await email_service._send_via_resend(
        to="a@b.com",
        subject="Hi",
        text_body="text",
        html_body="<p>html</p>",
    )

    assert captured["url"] == email_service.RESEND_API_URL
    assert captured["headers"]["Authorization"] == "Bearer re_test_key"
    assert captured["json"]["from"] == "invites@example.com"
    assert captured["json"]["to"] == ["a@b.com"]


def test_send_sync_uses_starttls(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_FROM", "from@example.com")
    monkeypatch.setenv("SMTP_USER", "user@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "pass")
    monkeypatch.setenv("SMTP_USE_TLS", "true")
    monkeypatch.setenv("SMTP_USE_SSL", "false")

    mock_server = MagicMock()
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = mock_server

    with patch("app.services.email_service.smtplib.SMTP", return_value=mock_ctx):
        email_service._send_sync(
            to="a@b.com",
            subject="Hi",
            text_body="text",
            html_body="<p>html</p>",
        )

    mock_server.starttls.assert_called_once()
    mock_server.login.assert_called_once_with("user@example.com", "pass")
    mock_server.sendmail.assert_called_once()
