"""add_admin_profiles_table

Revision ID: 76432e78825c
Revises: d50f32a0fb12
Create Date: 2026-10-25 11:26:48.912865

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '76432e78825c'
down_revision: Union[str, Sequence[str], None] = 'd50f32a0fb12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - create admin_profiles table."""
    op.create_table(
        'admin_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('full_name', sa.String(150), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('user_id', name='uq_admin_profiles_user_id')
    )
    op.create_index('ix_admin_profiles_user_id', 'admin_profiles', ['user_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema - drop admin_profiles table."""
    op.drop_index('ix_admin_profiles_user_id', table_name='admin_profiles')
    op.drop_table('admin_profiles')
