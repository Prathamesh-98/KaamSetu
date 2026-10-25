"""KaamSetu - Development Admin Provisioning CLI

Secure CLI tool to create or update an administrator account in local development
and testing environments. Public registration of ADMIN users is strictly forbidden.

Usage:
    python scripts/create_admin.py
    python scripts/create_admin.py --email admin@example.com --full-name "System Admin"
"""
import sys
import os
import re
import getpass
import argparse
import asyncio

# Ensure backend root is on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.models import User, UserRole, AdminProfile
from app.core.security import hash_password
from app.core.config import settings


def validate_password_complexity(password: str) -> None:
    """Validate that password meets security requirements."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not any(c.isupper() for c in password):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not any(c.isdigit() for c in password):
        raise ValueError("Password must contain at least one digit.")


def validate_email_format(email: str) -> str:
    """Validate email format."""
    email = email.strip().lower()
    email_regex = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    if not re.match(email_regex, email):
        raise ValueError(f"Invalid email address format: '{email}'")
    return email


async def provision_admin(
    email: str,
    full_name: str,
    password: str,
    phone: str = None,
    department: str = "Operations",
    force: bool = False,
) -> bool:
    """Provision or update an admin user in the database."""
    env = (settings.ENVIRONMENT or "").strip().lower()
    if env in ("production", "prod"):
        print("ERROR: create_admin.py is disabled in production environments.", file=sys.stderr)
        return False

    validate_password_complexity(password)
    email = validate_email_format(email)

    async with AsyncSessionLocal() as session:
        # Check if user already exists
        result = await session.execute(select(User).where(User.email == email))
        existing_user = result.scalar_one_or_none()

        if existing_user:
            if not force:
                print(f"Warning: User '{email}' already exists with role '{existing_user.role.value}'.")
                confirm = input("Are you sure you want to overwrite and set role to ADMIN? [y/N]: ").strip().lower()
                if confirm not in ("y", "yes"):
                    print("Operation cancelled. User account was not modified.")
                    return False

            print(f"Updating existing user '{email}' to ADMIN...")
            existing_user.role = UserRole.ADMIN
            existing_user.password_hash = hash_password(password)
            existing_user.token_version = (existing_user.token_version or 1) + 1
            existing_user.is_active = True
            existing_user.is_verified = True
            if phone:
                existing_user.phone = phone

            # Check for existing AdminProfile
            prof_res = await session.execute(
                select(AdminProfile).where(AdminProfile.user_id == existing_user.id)
            )
            existing_profile = prof_res.scalar_one_or_none()
            if existing_profile:
                existing_profile.full_name = full_name
                if phone:
                    existing_profile.phone = phone
                if department:
                    existing_profile.department = department
            else:
                new_profile = AdminProfile(
                    user_id=existing_user.id,
                    full_name=full_name,
                    phone=phone or existing_user.phone,
                    department=department,
                )
                session.add(new_profile)

            await session.commit()
            print(f"Successfully updated user '{email}' as ADMIN.")
            return True

        # Create new admin user
        print(f"Creating new admin user '{email}'...")
        new_user = User(
            email=email,
            password_hash=hash_password(password),
            role=UserRole.ADMIN,
            token_version=1,
            is_active=True,
            is_verified=True,
            phone=phone,
        )
        session.add(new_user)
        await session.flush()
        await session.refresh(new_user)

        new_profile = AdminProfile(
            user_id=new_user.id,
            full_name=full_name,
            phone=phone,
            department=department,
        )
        session.add(new_profile)
        await session.commit()
        print(f"Successfully created admin user '{email}'.")
        return True


def main():
    parser = argparse.ArgumentParser(
        description="Secure Admin Provisioning CLI for KaamSetu (Development/Staging only)"
    )
    parser.add_argument("--email", help="Admin email address")
    parser.add_argument("--full-name", help="Admin full name")
    parser.add_argument("--phone", help="Admin phone number (optional)")
    parser.add_argument("--department", default="Operations", help="Admin department (default: Operations)")
    parser.add_argument("--password", help="Admin password (if omitted, will prompt securely)")
    parser.add_argument("--force", action="store_true", help="Force overwrite without interactive confirmation")

    args = parser.parse_args()

    # Interactive input if not provided via flags
    email = args.email
    if not email:
        try:
            email = input("Admin Email: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(1)

    if not email:
        print("Error: Email is required.", file=sys.stderr)
        sys.exit(1)

    try:
        email = validate_email_format(email)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    full_name = args.full_name
    if not full_name:
        try:
            full_name = input("Admin Full Name [Administrator]: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(1)
        if not full_name:
            full_name = "Administrator"

    phone = args.phone
    if phone is None and not args.email:
        try:
            phone_input = input("Admin Phone (optional): ").strip()
            phone = phone_input if phone_input else None
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(1)

    department = args.department or "Operations"

    password = args.password
    if not password:
        try:
            password = getpass.getpass("Enter admin password: ")
            confirm_pwd = getpass.getpass("Confirm admin password: ")
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(1)

        if password != confirm_pwd:
            print("Error: Passwords do not match.", file=sys.stderr)
            sys.exit(1)

    try:
        validate_password_complexity(password)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    success = asyncio.run(
        provision_admin(
            email=email,
            full_name=full_name,
            password=password,
            phone=phone,
            department=department,
            force=args.force,
        )
    )

    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
