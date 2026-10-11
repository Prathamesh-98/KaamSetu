import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token
from app.db.session import engine, AsyncSessionLocal
from app.models.models import Notification
from sqlalchemy import delete

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def cleanup_engine():
    yield
    await engine.dispose()

@pytest.mark.anyio
async def test_get_notifications_unauthorized():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/notifications")
        assert response.status_code == 403

@pytest.mark.anyio
async def test_unread_count_unauthorized():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/notifications/unread-count")
        assert response.status_code == 403

@pytest.mark.anyio
async def test_mark_read_unauthorized():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.put("/api/notifications/123e4567-e89b-12d3-a456-426614174000/read")
        assert response.status_code == 403

@pytest.mark.anyio
async def test_mark_all_read_unauthorized():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.put("/api/notifications/read-all")
        assert response.status_code == 403

@pytest.mark.anyio
async def test_mark_all_read_lifecycle_and_atomic_update():
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncSessionLocal() as session:
        n1 = Notification(
            user_id=worker_user_id,
            type="SYSTEM",
            title="Test 1",
            body="Notification 1",
            is_read=False,
        )
        n2 = Notification(
            user_id=worker_user_id,
            type="SYSTEM",
            title="Test 2",
            body="Notification 2",
            is_read=False,
        )
        session.add_all([n1, n2])
        await session.commit()
        n1_id, n2_id = n1.id, n2.id

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            count_res = await ac.get("/api/notifications/unread-count", headers=headers)
            assert count_res.status_code == 200
            assert count_res.json()["count"] >= 2

            mark_all_res = await ac.put("/api/notifications/read-all", headers=headers)
            assert mark_all_res.status_code == 200
            assert mark_all_res.json() == {"message": "All notifications marked as read"}

            count_after = await ac.get("/api/notifications/unread-count", headers=headers)
            assert count_after.status_code == 200
            assert count_after.json()["count"] == 0
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(delete(Notification).where(Notification.id.in_([n1_id, n2_id])))
            await session.commit()

