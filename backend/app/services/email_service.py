"""
KaamSetu — Email Delivery Service
Provides modular email delivery providers (SMTP, Resend) with fail-safe error handling,
credential validation, and no plaintext secret logging.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Tuple
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


class BaseEmailProvider:
    async def send_email(
        self,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None
    ) -> Tuple[bool, str]:
        raise NotImplementedError


class SMTPEmailProvider(BaseEmailProvider):
    def __init__(self):
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.user = settings.SMTP_USER
        self.password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL or "noreply@kaamsetu.in"
        self.use_tls = settings.SMTP_TLS
        self.use_ssl = settings.SMTP_SSL

    def is_configured(self) -> bool:
        return bool(self.host and self.port and self.user and self.password)

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None
    ) -> Tuple[bool, str]:
        if not self.is_configured():
            return False, "SMTP email provider is not fully configured."

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.from_email
            msg["To"] = to_email

            part1 = MIMEText(body_text, "plain", "utf-8")
            msg.attach(part1)

            if body_html:
                part2 = MIMEText(body_html, "html", "utf-8")
                msg.attach(part2)

            # Send via smtplib (in executor for async compatibility)
            import asyncio
            loop = asyncio.get_event_loop()

            def _send():
                if self.use_ssl:
                    server = smtplib.SMTP_SSL(self.host, self.port, timeout=10)
                else:
                    server = smtplib.SMTP(self.host, self.port, timeout=10)
                try:
                    if self.use_tls and not self.use_ssl:
                        server.starttls()
                    server.login(self.user, self.password)
                    server.sendmail(self.from_email, [to_email], msg.as_string())
                finally:
                    server.quit()

            await loop.run_in_executor(None, _send)
            logger.info(f"Email sent via SMTP to destination {to_email[:3]}***@{to_email.split('@')[-1]}")
            return True, "Email sent successfully via SMTP."
        except Exception as e:
            logger.error(f"Failed to send email via SMTP: {type(e).__name__}")
            return False, f"Failed to deliver email via SMTP: {type(e).__name__}"


class ResendEmailProvider(BaseEmailProvider):
    def __init__(self):
        self.api_key = settings.RESEND_API_KEY
        self.from_email = settings.RESEND_FROM_EMAIL or "noreply@kaamsetu.in"

    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None
    ) -> Tuple[bool, str]:
        if not self.is_configured():
            return False, "Resend email provider is not configured."

        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "from": self.from_email,
            "to": [to_email],
            "subject": subject,
            "text": body_text,
        }
        if body_html:
            payload["html"] = body_html

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code in (200, 201):
                    logger.info(f"Email accepted by Resend for destination {to_email[:3]}***@{to_email.split('@')[-1]}")
                    return True, "Email accepted for delivery by Resend."
                else:
                    err_msg = ""
                    try:
                        data = res.json()
                        err_msg = data.get("message", "")
                    except Exception:
                        pass
                    msg_suffix = f": {err_msg}" if err_msg else ""
                    logger.warning(f"Resend rejected email request: {res.status_code}{msg_suffix}")
                    return False, f"Email delivery rejected by Resend (HTTP {res.status_code}){msg_suffix}"
        except Exception as e:
            logger.error(f"Failed to deliver email via Resend: {type(e).__name__}")
            return False, f"Email delivery error via Resend: {type(e).__name__}"


class EmailDeliveryService:
    @staticmethod
    def get_provider() -> Optional[BaseEmailProvider]:
        provider_name = (settings.EMAIL_PROVIDER or "").strip().lower()
        if provider_name == "smtp":
            return SMTPEmailProvider()
        elif provider_name == "resend":
            return ResendEmailProvider()
        return None

    @classmethod
    async def send_password_reset_email(cls, to_email: str, otp_code: str) -> Tuple[bool, str]:
        """
        Deliver password recovery OTP to the user's email address.
        Returns: (success: bool, message: str)
        """
        # In non-production with MOCK_OTP_MODE enabled and no provider configured:
        env = (settings.ENVIRONMENT or "").strip().lower()
        provider = cls.get_provider()

        subject = "KaamSetu — Password Recovery Verification Code"
        text_body = (
            f"Hello,\n\n"
            f"You requested to reset your password on KaamSetu.\n\n"
            f"Your one-time verification code is: {otp_code}\n\n"
            f"This code will expire in {settings.OTP_EXPIRE_MINUTES} minutes.\n"
            f"If you did not request this code, please ignore this email or contact support@kaamsetu.in.\n\n"
            f"— The KaamSetu Team"
        )
        html_body = (
            f"<div style='font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 12px;'>"
            f"<h2 style='color: #182849;'>KaamSetu Account Recovery</h2>"
            f"<p style='color: #4b5563;'>You requested to reset your account password. Use the following 6-digit code to complete verification:</p>"
            f"<div style='background: #f3f4f6; padding: 14px; text-align: center; border-radius: 8px; font-size: 26px; font-weight: bold; letter-spacing: 6px; color: #2563eb; margin: 20px 0;'>"
            f"{otp_code}"
            f"</div>"
            f"<p style='color: #6b7280; font-size: 13px;'>This code is single-use and will expire in {settings.OTP_EXPIRE_MINUTES} minutes. If you did not make this request, please disregard this email.</p>"
            f"<hr style='border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;'/>"
            f"<p style='color: #9ca3af; font-size: 11px;'>KaamSetu Workforce Marketplace — Empowering Workers and Employers</p>"
            f"</div>"
        )

        if not provider:
            if env in ("production", "prod"):
                return False, "Email provider is not configured. Delivery failed."
            if getattr(settings, "MOCK_OTP_MODE", False):
                logger.debug(f"[DEV MOCK] Simulated password reset email for {to_email[:3]}***")
                return True, "Verification code sent to your email (Development mock mode)."
            return False, "Email provider is not configured."

        return await provider.send_email(to_email, subject, text_body, html_body)


email_service = EmailDeliveryService()
