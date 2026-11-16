import asyncio
from sqlalchemy import text
from app.db.session import engine

async def main():
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT current_database(), current_user, to_regclass('public.users')")
        )
        print(result.one())

    await engine.dispose()

asyncio.run(main())