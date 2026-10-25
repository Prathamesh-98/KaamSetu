"""
KaamSetu — Phase 4.1 Development CORS Configuration Test Suite
Verifies:
1. Preflight OPTIONS request from http://127.0.0.1:5173 returns allowed CORS headers.
2. Preflight OPTIONS request from http://localhost:5173 returns allowed CORS headers.
3. Requests with credentials support allow-credentials: true.
4. Unauthorized origins are rejected.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.mark.anyio
async def test_cors_preflight_for_local_frontend_origins():
    """
    Verifies development CORS allows both http://127.0.0.1:5173 and http://localhost:5173.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Test 127.0.0.1:5173
        res1 = await client.options(
            "/api/auth/me",
            headers={
                "Origin": "http://127.0.0.1:5173",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization,Content-Type",
            }
        )
        assert res1.status_code == 200, res1.text
        assert res1.headers.get("access-control-allow-origin") == "http://127.0.0.1:5173"
        assert res1.headers.get("access-control-allow-credentials") == "true"

        # 2. Test localhost:5173
        res2 = await client.options(
            "/api/auth/me",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization,Content-Type",
            }
        )
        assert res2.status_code == 200, res2.text
        assert res2.headers.get("access-control-allow-origin") == "http://localhost:5173"
        assert res2.headers.get("access-control-allow-credentials") == "true"

        # 3. Test unauthorized malicious origin
        res3 = await client.options(
            "/api/auth/me",
            headers={
                "Origin": "http://malicious-site.com",
                "Access-Control-Request-Method": "GET",
            }
        )
        # Unauthorized origin should NOT receive access-control-allow-origin
        assert res3.headers.get("access-control-allow-origin") != "http://malicious-site.com"
