"""
KaamSetu - Database Seeder
Seeds initial data: admin user, job categories, and skills.
"""
import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import AsyncSessionLocal, engine, Base
from app.models.models import User, UserRole, JobCategory, Skill
from app.core.security import hash_password
from app.core.config import settings

# Initial job categories
CATEGORIES = [
    {"name": "Construction", "icon": "🏗️", "description": "Building, civil work, masonry"},
    {"name": "Electrical", "icon": "⚡", "description": "Wiring, installation, repairs"},
    {"name": "Plumbing", "icon": "🔧", "description": "Pipes, fittings, sanitary work"},
    {"name": "Carpentry", "icon": "🪚", "description": "Woodwork, furniture, fittings"},
    {"name": "Painting", "icon": "🖌️", "description": "Interior/exterior painting"},
    {"name": "Driving", "icon": "🚚", "description": "Delivery, chauffeur, logistics"},
    {"name": "Domestic Help", "icon": "🧹", "description": "Housekeeping, cooking, cleaning"},
    {"name": "Farming", "icon": "🌾", "description": "Agricultural and farm work"},
    {"name": "Welding", "icon": "🔥", "description": "Fabrication, welding, metal work"},
    {"name": "Mechanics", "icon": "⚙️", "description": "Auto repair, machinery"},
    {"name": "IT & Tech", "icon": "💻", "description": "Software, hardware, tech support"},
    {"name": "Teaching", "icon": "📚", "description": "Tutoring, training, coaching"},
    {"name": "Security", "icon": "🛡️", "description": "Guard, watchman, security services"},
    {"name": "Event Work", "icon": "🎉", "description": "Event setup, catering, management"},
    {"name": "Delivery", "icon": "📦", "description": "Courier, logistics, last-mile delivery"},
    {"name": "Gardening", "icon": "🌱", "description": "Landscaping, maintenance, planting"},
    {"name": "Healthcare", "icon": "⚕️", "description": "Nursing, caretaking, homecare"},
    {"name": "Tailoring", "icon": "🧵", "description": "Stitching, alterations, embroidery"},
    {"name": "Other", "icon": "💼", "description": "Miscellaneous work"},
]

# Initial skills
SKILLS = [
    # Construction
    ("Masonry", "Construction"), ("Plastering", "Construction"), ("Tiling", "Construction"),
    ("Steel Fixing", "Construction"), ("Scaffolding", "Construction"),
    # Electrical
    ("Wiring", "Electrical"), ("Panel Installation", "Electrical"), ("Solar Installation", "Electrical"),
    # Plumbing
    ("Pipe Fitting", "Plumbing"), ("Bathroom Installation", "Plumbing"), ("Water Pump Repair", "Plumbing"),
    # Carpentry
    ("Furniture Making", "Carpentry"), ("Door/Window Fitting", "Carpentry"), ("Cabinet Making", "Carpentry"),
    # Painting
    ("Interior Painting", "Painting"), ("Exterior Painting", "Painting"), ("Waterproofing", "Painting"),
    # Driving
    ("LMV Driving", "Driving"), ("HMV Driving", "Driving"), ("Delivery Driving", "Driving"),
    # Domestic
    ("Cooking", "Domestic Help"), ("Cleaning", "Domestic Help"), ("Babysitting", "Domestic Help"),
    # Farming
    ("Crop Harvesting", "Farming"), ("Irrigation", "Farming"), ("Tractor Operation", "Farming"),
    # Welding
    ("MIG Welding", "Welding"), ("Arc Welding", "Welding"), ("Fabrication", "Welding"),
    # IT
    ("Web Development", "IT & Tech"), ("Mobile App Development", "IT & Tech"), ("Computer Repair", "IT & Tech"),
    # Other
    ("MS Office", "Other"), ("Data Entry", "Other"), ("Customer Service", "Other"),
]


async def seed():
    """Run database seeding."""
    print("Creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.")

    async with AsyncSessionLocal() as db:
        # Seed admin
        admin_check = await db.execute(select(User).where(User.email == settings.ADMIN_EMAIL))
        if not admin_check.scalar_one_or_none():
            if settings.ADMIN_PASSWORD:
                admin = User(
                    email=settings.ADMIN_EMAIL,
                    password_hash=hash_password(settings.ADMIN_PASSWORD),
                    role=UserRole.ADMIN,
                    is_active=True,
                    is_verified=True,
                )
                db.add(admin)
                print(f"Admin user created: {settings.ADMIN_EMAIL}")
            else:
                print("Skipping admin creation (ADMIN_PASSWORD not set in environment).")

        # Seed categories
        for cat_data in CATEGORIES:
            existing = await db.execute(
                select(JobCategory).where(JobCategory.name == cat_data["name"])
            )
            if not existing.scalar_one_or_none():
                db.add(JobCategory(**cat_data))
        print(f"Seeded {len(CATEGORIES)} categories.")

        # Seed skills
        for skill_name, skill_cat in SKILLS:
            existing = await db.execute(select(Skill).where(Skill.name == skill_name))
            if not existing.scalar_one_or_none():
                db.add(Skill(name=skill_name, category=skill_cat))
        print(f"Seeded {len(SKILLS)} skills.")

        await db.commit()
        print("✅ Database seeding complete!")


if __name__ == "__main__":
    asyncio.run(seed())
