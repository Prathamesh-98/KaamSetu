"""add_persistent_otp_and_reset_authorizations

Revision ID: e4f5a6b7c8d9
Revises: c0c6e57b5c08
Create Date: 2026-10-25 16:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, Sequence[str], None] = 'c0c6e57b5c08'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add otp_challenges and password_reset_authorizations tables."""
    # 1. Create otp_challenges table
    op.create_table(
        'otp_challenges',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('purpose', sa.String(length=50), nullable=False),
        sa.Column('destination', sa.String(length=255), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('code_hash', sa.String(length=128), nullable=False),
        sa.Column('salt', sa.String(length=64), nullable=False),
        sa.Column('attempts_left', sa.Integer(), server_default='5', nullable=False),
        sa.Column('max_attempts', sa.Integer(), server_default='5', nullable=False),
        sa.Column('is_consumed', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index(
        'ix_otp_challenges_lookup',
        'otp_challenges',
        ['purpose', 'destination', 'is_consumed'],
        unique=False
    )
    op.create_index(
        'ix_otp_challenges_user_lookup',
        'otp_challenges',
        ['user_id', 'purpose', 'is_consumed'],
        unique=False
    )
    op.create_index(
        'ix_otp_challenges_created_at',
        'otp_challenges',
        ['created_at'],
        unique=False
    )
    op.create_index(
        'ix_otp_challenges_expires_at',
        'otp_challenges',
        ['expires_at'],
        unique=False
    )

    # 2. Create password_reset_authorizations table
    op.create_table(
        'password_reset_authorizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(length=128), unique=True, nullable=False),
        sa.Column('purpose', sa.String(length=50), nullable=False),
        sa.Column('is_consumed', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index(
        'ix_pwd_reset_auth_lookup',
        'password_reset_authorizations',
        ['token_hash', 'is_consumed'],
        unique=False
    )
    op.create_index(
        'ix_pwd_reset_auth_user',
        'password_reset_authorizations',
        ['user_id', 'is_consumed'],
        unique=False
    )
    op.create_index(
        'ix_pwd_reset_auth_expires_at',
        'password_reset_authorizations',
        ['expires_at'],
        unique=False
    )


def downgrade() -> None:
    """Downgrade schema - drop persistent OTP and reset authorization tables."""
    op.drop_index('ix_pwd_reset_auth_expires_at', table_name='password_reset_authorizations')
    op.drop_index('ix_pwd_reset_auth_user', table_name='password_reset_authorizations')
    op.drop_index('ix_pwd_reset_auth_lookup', table_name='password_reset_authorizations')
    op.drop_table('password_reset_authorizations')

    op.drop_index('ix_otp_challenges_expires_at', table_name='otp_challenges')
    op.drop_index('ix_otp_challenges_created_at', table_name='otp_challenges')
    op.drop_index('ix_otp_challenges_user_lookup', table_name='otp_challenges')
    op.drop_index('ix_otp_challenges_lookup', table_name='otp_challenges')
    op.drop_table('otp_challenges')
