"""add_token_version_to_users

Revision ID: c0c6e57b5c08
Revises: 76432e78825c
Create Date: 2026-10-25 11:54:56.417237

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c0c6e57b5c08'
down_revision: Union[str, Sequence[str], None] = '76432e78825c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add token_version to users table."""
    op.add_column(
        'users',
        sa.Column('token_version', sa.Integer(), server_default=sa.text('1'), nullable=False)
    )


def downgrade() -> None:
    """Downgrade schema - drop token_version from users table."""
    op.drop_column('users', 'token_version')
