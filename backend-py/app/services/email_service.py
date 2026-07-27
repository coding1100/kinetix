"""Email delivery for workspace invites (Resend primary, SMTP fallback)."""

from __future__ import annotations

import asyncio
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.config import get_settings

RESEND_API_URL = "https://api.resend.com/emails"

ROLE_LABELS = {
    "OWNER": "Owner",
    "SUPER_ADMIN": "Super admin",
    "ADMIN": "Admin",
    "MEMBER": "Member",
    "GUEST": "Guest",
    "LIMITED_MEMBER": "Limited member",
}


class EmailNotConfiguredError(Exception):
    """SMTP settings are missing."""


def is_smtp_configured() -> bool:
    settings = get_settings()
    return bool(
        settings.smtp_host.strip()
        and (settings.smtp_from.strip() or settings.smtp_user.strip())
    )


def is_resend_configured() -> bool:
    return get_settings().resend_configured


def is_email_configured() -> bool:
    return is_resend_configured() or is_smtp_configured()


def _from_address() -> str:
    settings = get_settings()
    return settings.smtp_from.strip() or settings.smtp_user.strip()


def _resend_from_address() -> str:
    settings = get_settings()
    return settings.resend_from.strip() or settings.smtp_from.strip()


async def _send_via_resend(*, to: str, subject: str, text_body: str, html_body: str) -> None:
    settings = get_settings()
    if not is_resend_configured():
        raise EmailNotConfiguredError("Resend is not configured")

    async with httpx.AsyncClient(timeout=settings.smtp_timeout_seconds) as client:
        response = await client.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": _resend_from_address(),
                "to": [to],
                "subject": subject,
                "text": text_body,
                "html": html_body,
            },
        )
        response.raise_for_status()


def _send_sync(*, to: str, subject: str, text_body: str, html_body: str) -> None:
    settings = get_settings()
    if not is_smtp_configured():
        raise EmailNotConfiguredError("SMTP is not configured")

    from_addr = _from_address()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    if settings.smtp_use_ssl:
        with smtplib.SMTP_SSL(
            settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds
        ) as server:
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(from_addr, [to], msg.as_string())
    else:
        with smtplib.SMTP(
            settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds
        ) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(from_addr, [to], msg.as_string())


def _invite_bodies(
    *,
    workspace_name: str,
    inviter_name: str,
    invite_url: str,
    role: str,
    expires_at: datetime,
) -> tuple[str, str]:
    role_label = ROLE_LABELS.get(role, role.replace("_", " ").title())
    expires_label = f"{expires_at.strftime('%b')} {expires_at.day}, {expires_at.year} at {expires_at.strftime('%H:%M')} UTC"
    text = (
        f"{inviter_name} invited you to join {workspace_name} on Kinetix as {role_label}.\n\n"
        f"Accept your invite:\n{invite_url}\n\n"
        f"This link expires on {expires_label}. If you did not expect this email, you can ignore it."
    )
    html = f"""<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <p><strong>{inviter_name}</strong> invited you to join
     <strong>{workspace_name}</strong> on Kinetix as <strong>{role_label}</strong>.</p>
  <p><a href="{invite_url}" style="display:inline-block;padding:10px 18px;background:#5a43d6;color:#fff;text-decoration:none;border-radius:6px">Accept invite</a></p>
  <p style="font-size:13px;color:#555">Or copy this link:<br><a href="{invite_url}">{invite_url}</a></p>
  <p style="font-size:12px;color:#888">This link expires on {expires_label}. If you did not expect this email, you can ignore it.</p>
</body>
</html>"""
    return text, html


async def send_workspace_invite_email(
    *,
    to: str,
    workspace_name: str,
    inviter_name: str,
    invite_url: str,
    role: str,
    expires_at: datetime,
) -> None:
    subject = f"You're invited to {workspace_name} on Kinetix"
    text_body, html_body = _invite_bodies(
        workspace_name=workspace_name,
        inviter_name=inviter_name,
        invite_url=invite_url,
        role=role,
        expires_at=expires_at,
    )
    if is_resend_configured():
        await _send_via_resend(
            to=to,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
        return
    await asyncio.to_thread(
        _send_sync,
        to=to,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )
