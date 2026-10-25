"""
KaamSetu — SMS Delivery Service
Provides modular SMS delivery providers (MSG91, Twilio) with fail-safe error handling,
rate limiting compliance, and no plaintext secret logging.
"""
from typing import Optional, Tuple
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


class BaseSMSProvider:
    async def send_sms(self, phone: str, message: str, otp_code: Optional[str] = None) -> Tuple[bool, str]:
        raise NotImplementedError


class MSG91SMSProvider(BaseSMSProvider):
    def __init__(self):
        self.auth_key = settings.MSG91_AUTH_KEY
        self.template_id = settings.MSG91_TEMPLATE_ID
        self.sender_id = settings.MSG91_SENDER_ID or "KMSETU"

    def is_configured(self) -> bool:
        return bool(self.auth_key and self.template_id)

    async def send_sms(self, phone: str, message: str, otp_code: Optional[str] = None) -> Tuple[bool, str]:
        if not self.is_configured():
            return False, "MSG91 SMS provider is not configured."

        # MSG91 OTP endpoint
        # Normalize phone: MSG91 expects country code without leading '+'
        clean_phone = phone.lstrip("+")
        url = "https://control.msg91.com/api/v5/otp"
        headers = {
            "authkey": self.auth_key,
            "Content-Type": "application/json"
        }
        params = {
            "template_id": self.template_id,
            "mobile": clean_phone,
            "otp": otp_code or "",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, headers=headers, params=params)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("type") == "success":
                        logger.info(f"SMS accepted by MSG91 for phone ending in {phone[-4:]}")
                        return True, "SMS dispatched successfully via MSG91."
                    else:
                        logger.warning(f"MSG91 error response: {data.get('message')}")
                        return False, f"MSG91 error: {data.get('message', 'SMS delivery rejected')}"
                else:
                    logger.warning(f"MSG91 HTTP {res.status_code}")
                    return False, f"MSG91 rejected request (HTTP {res.status_code})."
        except Exception as e:
            logger.error(f"Failed to deliver SMS via MSG91: {type(e).__name__}")
            return False, f"SMS delivery error via MSG91: {type(e).__name__}"


class TwilioSMSProvider(BaseSMSProvider):
    def __init__(self):
        self.account_sid = settings.TWILIO_ACCOUNT_SID
        self.auth_token = settings.TWILIO_AUTH_TOKEN
        self.from_number = settings.TWILIO_FROM_NUMBER

    def is_configured(self) -> bool:
        return bool(self.account_sid and self.auth_token and self.from_number)

    async def send_sms(self, phone: str, message: str, otp_code: Optional[str] = None) -> Tuple[bool, str]:
        if not self.is_configured():
            return False, "Twilio SMS provider is not configured."

        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        data = {
            "To": phone,
            "From": self.from_number,
            "Body": message,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, data=data, auth=(self.account_sid, self.auth_token))
                if res.status_code in (200, 201):
                    logger.info(f"SMS accepted by Twilio for phone ending in {phone[-4:]}")
                    return True, "SMS dispatched successfully via Twilio."
                else:
                    logger.warning(f"Twilio rejected SMS: HTTP {res.status_code}")
                    return False, f"Twilio rejected request (HTTP {res.status_code})."
        except Exception as e:
            logger.error(f"Failed to deliver SMS via Twilio: {type(e).__name__}")
            return False, f"SMS delivery error via Twilio: {type(e).__name__}"


class SMSDeliveryService:
    @staticmethod
    def get_provider() -> Optional[BaseSMSProvider]:
        provider_name = (settings.SMS_PROVIDER or "").strip().lower()
        if provider_name == "msg91":
            return MSG91SMSProvider()
        elif provider_name == "twilio":
            return TwilioSMSProvider()
        return None

    @classmethod
    async def send_otp_sms(cls, phone: str, otp_code: str, purpose: str = "verification") -> Tuple[bool, str]:
        """
        Deliver one-time verification code to the given mobile number.
        Returns: (success: bool, message: str)
        """
        env = (settings.ENVIRONMENT or "").strip().lower()
        provider = cls.get_provider()

        if "recovery" in purpose.lower() or "reset" in purpose.lower():
            message = f"Your KaamSetu password recovery code is: {otp_code}. Valid for {settings.OTP_EXPIRE_MINUTES} mins. Never share your OTP with anyone."
        else:
            message = f"Your KaamSetu phone verification code is: {otp_code}. Valid for {settings.OTP_EXPIRE_MINUTES} mins. Do not share this OTP."

        if not provider:
            if env in ("production", "prod"):
                return False, "SMS provider is not configured. Delivery failed."
            if getattr(settings, "MOCK_OTP_MODE", False):
                logger.debug(f"[DEV MOCK] Simulated SMS OTP for phone ending in {phone[-4:]}")
                return True, "Verification code sent to your phone (Development mock mode)."
            return False, "SMS provider is not configured."

        return await provider.send_sms(phone=phone, message=message, otp_code=otp_code)


sms_service = SMSDeliveryService()
