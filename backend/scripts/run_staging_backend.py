"""
KaamSetu — Staging Backend Runner
Boots FastAPI on port 8001 using isolated staging configuration (.env.staging)
and dedicated kaamsetu_staging PostgreSQL database.
"""
import os
import sys
from pathlib import Path
from dotenv import dotenv_values

backend_dir = Path(__file__).resolve().parent.parent
os.chdir(backend_dir)
sys.path.insert(0, str(backend_dir))

staging_env_path = backend_dir / ".env.staging"
if not staging_env_path.is_file():
    raise FileNotFoundError(f"Staging configuration file {staging_env_path} not found.")

staging_vars = dotenv_values(str(staging_env_path))
for key, val in staging_vars.items():
    if val is not None:
        os.environ[key] = str(val)

# Safety checks
assert os.environ.get("ENVIRONMENT") == "staging", "ENVIRONMENT must be 'staging'"
assert "kaamsetu_staging" in os.environ.get("DATABASE_URL", ""), "Safety alert: DATABASE_URL must point to kaamsetu_staging"
assert os.environ.get("BACKEND_PORT") == "8001", "BACKEND_PORT must be 8001"

import uvicorn
from app.core.config import settings

print(f"Starting KaamSetu Staging Backend on {settings.BACKEND_HOST}:{settings.BACKEND_PORT}...")
print(f"Environment: {settings.ENVIRONMENT} | Debug: {settings.DEBUG} | Mock OTP: {settings.MOCK_OTP_MODE}")
print(f"Target Database: {settings.DATABASE_URL.split('@')[-1]}")
print(f"Allowed CORS Origin: {settings.FRONTEND_URL}")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8001, log_level="info")
