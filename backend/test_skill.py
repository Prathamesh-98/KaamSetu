import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.db.session import engine, AsyncSessionLocal
import uuid

async def test():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT id FROM users WHERE role = 'WORKER' LIMIT 1"))
        user_id = res.scalar_one_or_none()
        if not user_id: return
        res = await db.execute(text("SELECT id FROM worker_profiles WHERE user_id = :uid"), {"uid": user_id})
        profile_id = res.scalar_one_or_none()
        res = await db.execute(text("SELECT id FROM skills LIMIT 1"))
        skill_id = res.scalar_one_or_none()
        print(f"Adding skill {skill_id} to profile {profile_id}")

asyncio.run(test())
