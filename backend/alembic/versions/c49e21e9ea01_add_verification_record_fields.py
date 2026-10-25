"""add_verification_record_fields

Revision ID: c49e21e9ea01
Revises: b21f834d0fa1
Create Date: 2026-10-24 23:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c49e21e9ea01'
down_revision: Union[str, Sequence[str], None] = 'b21f834d0fa1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Upgrade schema - Add verification enhancements:
    - Adds 'EXPIRED' value to verificationstatus PostgreSQL enum.
    - Adds document_type, rejection_reason, expires_at, and metadata_json columns.
    - Adds index on verification_records(user_id, verification_type, status) for fast lookup.
    """
    # 1. Add EXPIRED to verificationstatus enum inside autocommit block for PostgreSQL
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE verificationstatus ADD VALUE IF NOT EXISTS 'EXPIRED';")

    # 2. Add columns to verification_records
    op.add_column('verification_records', sa.Column('document_type', sa.String(length=50), nullable=True))
    op.add_column('verification_records', sa.Column('rejection_reason', sa.Text(), nullable=True))
    op.add_column('verification_records', sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('verification_records', sa.Column('metadata_json', sa.Text(), nullable=True))

    # 3. Create index for fast user verification state resolution
    op.create_index(
        'ix_verification_records_lookup',
        'verification_records',
        ['user_id', 'verification_type', 'status'],
        unique=False
    )


def downgrade() -> None:
    """
    Downgrade schema - Revert verification enhancements.
    Note: PostgreSQL does not support removing values from an ENUM type without recreating it.
    """
    op.drop_index('ix_verification_records_lookup', table_name='verification_records')
    op.drop_column('verification_records', 'metadata_json')
    op.drop_column('verification_records', 'expires_at')
    op.drop_column('verification_records', 'rejection_reason')
    op.drop_column('verification_records', 'document_type')
