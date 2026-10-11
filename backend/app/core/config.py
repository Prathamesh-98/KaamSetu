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

    @model_validator(mode="after")
    def validate_production_settings(self):
        # Enforce secure configurations in production
        if self.ENVIRONMENT == "production":
            if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY == "change-this-secret-key-in-production":
                raise ValueError("A strong JWT_SECRET_KEY environment variable is required in production.")
            
            if self.DEBUG:
                # Force DEBUG to False in production
                self.DEBUG = False
                
        # Fallback for development if not provided
        if not self.JWT_SECRET_KEY:
            if self.ENVIRONMENT == "development":
                self.JWT_SECRET_KEY = "change-this-secret-key-in-production"
            else:
                raise ValueError("JWT_SECRET_KEY is required.")
                
        return self

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
