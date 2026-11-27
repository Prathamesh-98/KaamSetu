"""
KaamSetu — CORS Configuration & Origin Allowlist Security Test Suite
Verifies:
1. Preflight OPTIONS requests for local dev origins succeed with credentials.
2. Live website origin and Capacitor Android/iOS origins are permitted.
3. Arbitrary third-party *.onrender.com and untrusted origins are rejected.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_cors_preflight_allowlist_and_rejection():
    allowed = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "https://kaamsetu-frontend-jxpg.onrender.com",
        "https://localhost",
        "capacitor://localhost",
    ]
    blocked = [
        "http://malicious-site.com",
        "https://evil-phishing-app.onrender.com",
    ]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for origin in allowed:
            res = await client.options(
                "/api/auth/me",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": "Authorization,Content-Type",
                },
            )
            assert res.status_code == 200, f"Expected 200 for {origin}: {res.text}"
            assert res.headers.get("access-control-allow-origin") == origin
            assert res.headers.get("access-control-allow-credentials") == "true"

        for origin in blocked:
            res = await client.options(
                "/api/auth/me",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                },
            )
            assert res.headers.get("access-control-allow-origin") != origin
