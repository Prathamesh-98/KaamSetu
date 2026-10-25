"""KaamSetu - Development Admin Password Reset CLI

Secure CLI tool to reset the password of the existing 'admin@kaamsetu.in'
account in local development and testing environments.

Safeguards:
1. Strictly fails closed if ENVIRONMENT is missing, unrecognized, or production.
2. Positively verifies the connection targets local development database (loopback host + kaamsetu).
3. Strictly locked to 'admin@kaamsetu.in'; never creates new accounts or promotes other roles.
4. Masks interactive password entry with getpass (no command-line flags, no secrets logged).
5. Enforces application password complexity requirements.
6. Executes password update and token_version increment inside a single atomic database transaction.

Usage:
    cd backend
    .\\.venv2\\Scripts\\python.exe scripts/reset_admin_password.py
"""
import sys
import os
import re
import getpass
import asyncio
from typing import Any
from datetime import datetime, timezone
from urllib.parse import urlparse

# Ensure backend root is on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal
from app.models.models import User, UserRole
from app.core.security import hash_password, verify_password
from app.core.config import settings

# ─── Allowed Environments & Hosts (Fail-Closed) ──────────────────────────────
ALLOWED_ENVIRONMENTS = {"development", "dev", "local", "test", "testing"}
ALLOWED_DB_HOSTS = {"localhost", "127.0.0.1", "::1"}
ALLOWED_DB_NAMES = {"kaamsetu", "kaamsetu_test"}
TARGET_ADMIN_EMAIL = "admin@kaamsetu.in"

_UNSET = object()


def verify_environment_safety(env_value: Any = _UNSET) -> None:
    """Fail closed if environment is missing, unrecognized, or indicates production."""
    raw_env = settings.ENVIRONMENT if env_value is _UNSET else env_value
    if not isinstance(raw_env, str):
        env = ""
    else:
        env = raw_env.strip().lower()

    if not env or env not in ALLOWED_ENVIRONMENTS:
        raise ValueError(
            f"CRITICAL SAFETY ABORT: ENVIRONMENT is '{raw_env}'. "
            f"Admin password reset is restricted to local development environments: {sorted(ALLOWED_ENVIRONMENTS)}."
        )


def verify_database_target(db_url: str = None) -> None:
    """Verify the database connection URL targets a local loopback address."""
    url_to_check = db_url or settings.DATABASE_URL or ""
    clean_url = url_to_check.replace("postgresql+asyncpg://", "http://").replace("postgresql://", "http://")
    parsed = urlparse(clean_url)
    host = (parsed.hostname or "").strip().lower()
    if not host or host not in ALLOWED_DB_HOSTS:
        raise ValueError(
            f"CRITICAL SAFETY ABORT: Database host '{host}' is not an authorized local loopback address {ALLOWED_DB_HOSTS}."
        )


async def verify_connected_database(session: AsyncSession) -> str:
    """Query PostgreSQL runtime to confirm the active database name."""
    res = await session.execute(text("SELECT current_database()"))
    db_name = res.scalar()
    if not db_name or db_name.strip().lower() not in ALLOWED_DB_NAMES:
        raise ValueError(
            f"CRITICAL SAFETY ABORT: Connected database is '{db_name}'. "
            f"Reset script only allows local databases: {sorted(ALLOWED_DB_NAMES)}."
        )
    return db_name


def validate_password_complexity(password: str) -> None:
    """Validate password against KaamSetu complexity standards."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not any(c.isupper() for c in password):
        raise ValueError("Password must contain at least one uppercase letter (A-Z).")
    if not any(c.isdigit() for c in password):
        raise ValueError("Password must contain at least one digit (0-9).")


async def reset_admin_password_in_session(
    session: AsyncSession,
    new_password: str,
    target_email: str = TARGET_ADMIN_EMAIL,
    enforce_target_check: bool = True,
) -> int:
    """
    Atomically update password_hash and increment token_version for the targeted admin.
    Commits the transaction on success, or rolls back on any error.
    Returns the new token_version.
    """
    if enforce_target_check and target_email != TARGET_ADMIN_EMAIL:
        raise ValueError(f"Target account is strictly locked to '{TARGET_ADMIN_EMAIL}'.")

    validate_password_complexity(new_password)

    try:
        # Select user with row lock to avoid race conditions
        stmt = select(User).where(User.email == target_email).with_for_update()
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()

        if user is None:
            raise ValueError(f"Target account '{target_email}' does not exist in the database.")

        if user.role != UserRole.ADMIN:
            raise ValueError(f"Target account '{target_email}' has role '{user.role.value}', not 'ADMIN'. Aborting.")

        # Reject if new password matches existing password hash
        if verify_password(new_password, user.password_hash):
            raise ValueError("New password cannot be the same as the current password.")

        # Update credentials atomically
        user.password_hash = hash_password(new_password)
        user.token_version = (user.token_version or 1) + 1
        user.updated_at = datetime.now(timezone.utc)

        await session.commit()
        await session.refresh(user)
        return user.token_version
    except Exception:
        await session.rollback()
        raise


async def run_reset_interactive():
    """Interactive command-line workflow with masked input."""
    try:
        verify_environment_safety()
        verify_database_target()
    except ValueError as e:
        print(f"\n[ABORT] {e}", file=sys.stderr)
        sys.exit(1)

    print("=" * 65)
    print("KaamSetu Local Development - Secure Admin Password Reset CLI")
    print("=" * 65)
    print(f"Target Account : {TARGET_ADMIN_EMAIL}")

    async with AsyncSessionLocal() as session:
        try:
            db_name = await verify_connected_database(session)
            print(f"Target Database: '{db_name}' (verified local)")
        except ValueError as e:
            print(f"\n[ABORT] {e}", file=sys.stderr)
            sys.exit(1)

        # Preflight check: verify admin user exists and is ADMIN
        res = await session.execute(select(User).where(User.email == TARGET_ADMIN_EMAIL))
        user = res.scalar_one_or_none()
        if not user:
            print(f"\n[ERROR] Account '{TARGET_ADMIN_EMAIL}' not found in database. Script will not create new users.", file=sys.stderr)
            sys.exit(1)
        if user.role != UserRole.ADMIN:
            print(f"\n[ERROR] Account '{TARGET_ADMIN_EMAIL}' has role '{user.role.value}', not 'ADMIN'. Aborting.", file=sys.stderr)
            sys.exit(1)

        print("[OK] Admin account verified. Please enter new credentials.")
        print("-" * 65)

        # Masked password input
        try:
            pwd1 = getpass.getpass("Enter new password for admin@kaamsetu.in: ")
            if not pwd1:
                print("Aborted: Password cannot be empty.")
                sys.exit(1)

            pwd2 = getpass.getpass("Confirm new password: ")
            if pwd1 != pwd2:
                print("Error: Passwords do not match.", file=sys.stderr)
                sys.exit(1)

            validate_password_complexity(pwd1)
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
        except (KeyboardInterrupt, EOFError):
            print("\nAborted by user.")
            sys.exit(1)

        # Final explicit confirmation
        try:
            confirm = input(f"\nAre you sure you want to reset password for '{TARGET_ADMIN_EMAIL}'? [y/N]: ").strip().lower()
            if confirm not in ("y", "yes"):
                print("Operation cancelled. No changes were made.")
                sys.exit(0)
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(1)

        # Execute atomic transaction
        try:
            new_version = await reset_admin_password_in_session(
                session=session,
                new_password=pwd1,
                target_email=TARGET_ADMIN_EMAIL,
            )
        except Exception as e:
            print(f"\n[FAILED] Transaction failed and was rolled back: {e}", file=sys.stderr)
            sys.exit(1)

        print("-" * 65)
        print(f"[SUCCESS] Password for '{TARGET_ADMIN_EMAIL}' has been reset successfully.")
        print(f"[SECURITY] Session token version incremented (v{new_version}). All previous access tokens are revoked.")
        print("You can now log in via the web application or API with your new credentials.")
        print("=" * 65)


if __name__ == "__main__":
    asyncio.run(run_reset_interactive())
