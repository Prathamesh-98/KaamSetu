"""
KaamSetu Backend - Configuration
Loads all settings from environment variables using pydantic-settings.
"""
from pydantic_settings import BaseSettings
from typing import Optional
from pydantic import model_validator
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "KaamSetu"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/kaamsetu"

    # JWT
    JWT_SECRET_KEY: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # CORS
    FRONTEND_URL: str = "http://localhost:5173"

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    # Admin seed
    ADMIN_EMAIL: str = "admin@kaamsetu.in"
    ADMIN_PASSWORD: Optional[str] = None

    # Verification & OTP
    MOCK_OTP_MODE: bool = True
    OTP_SECRET_KEY: Optional[str] = None
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 15
    PRIVATE_DOCS_DIR: str = "private_storage"

    # Email Delivery Provider (smtp, resend)
    EMAIL_PROVIDER: Optional[str] = None
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "noreply@kaamsetu.in"
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    RESEND_API_KEY: Optional[str] = None
    RESEND_FROM_EMAIL: str = "noreply@kaamsetu.in"

    # SMS Delivery Provider (msg91, twilio)
    SMS_PROVIDER: Optional[str] = None
    MSG91_AUTH_KEY: Optional[str] = None
    MSG91_TEMPLATE_ID: Optional[str] = None
    MSG91_SENDER_ID: Optional[str] = "KMSETU"
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None

    @model_validator(mode="after")
    def validate_production_settings(self):
        env = (self.ENVIRONMENT or "").strip().lower()
        # Enforce secure configurations in production
        if env in ("production", "prod"):
            if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY == "change-this-secret-key-in-production":
                raise ValueError("A strong JWT_SECRET_KEY environment variable is required in production.")
            
            if self.MOCK_OTP_MODE:
                raise ValueError("MOCK_OTP_MODE must NEVER be enabled in production environment.")

            email_prov = (self.EMAIL_PROVIDER or "").strip().lower()
            if not email_prov or email_prov in ("console", "mock", "none"):
                raise ValueError("A real EMAIL_PROVIDER ('resend' or 'smtp') is required in production; mock/console is forbidden.")
            if email_prov == "resend":
                if not self.RESEND_API_KEY or not self.RESEND_API_KEY.strip():
                    raise ValueError("RESEND_API_KEY is required in production when EMAIL_PROVIDER is 'resend'.")
            elif email_prov == "smtp":
                if not self.SMTP_HOST or not self.SMTP_USER or not self.SMTP_PASSWORD:
                    raise ValueError("SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required in production when EMAIL_PROVIDER is 'smtp'.")
            else:
                raise ValueError(f"Unsupported EMAIL_PROVIDER '{self.EMAIL_PROVIDER}' for production. Must be 'resend' or 'smtp'.")

            sms_prov = (self.SMS_PROVIDER or "").strip().lower()
            if not sms_prov or sms_prov in ("console", "mock", "none"):
                raise ValueError("A real SMS_PROVIDER ('msg91' or 'twilio') is required in production; mock/console is forbidden.")
            if sms_prov == "msg91":
                if not self.MSG91_AUTH_KEY or not self.MSG91_TEMPLATE_ID:
                    raise ValueError("MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are required in production when SMS_PROVIDER is 'msg91'.")
            elif sms_prov == "twilio":
                if not self.TWILIO_ACCOUNT_SID or not self.TWILIO_AUTH_TOKEN or not self.TWILIO_FROM_NUMBER:
                    raise ValueError("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are required in production when SMS_PROVIDER is 'twilio'.")
            else:
                raise ValueError(f"Unsupported SMS_PROVIDER '{self.SMS_PROVIDER}' for production. Must be 'msg91' or 'twilio'.")

            if self.DEBUG:
                # Force DEBUG to False in production
                self.DEBUG = False
                
        # Fallback for development if not provided
        if not self.JWT_SECRET_KEY:
            if env in ("development", "dev", ""):
                self.JWT_SECRET_KEY = "change-this-secret-key-in-production"
            else:
                raise ValueError("JWT_SECRET_KEY is required.")
                
        if not self.OTP_SECRET_KEY:
            self.OTP_SECRET_KEY = self.JWT_SECRET_KEY

        return self

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
