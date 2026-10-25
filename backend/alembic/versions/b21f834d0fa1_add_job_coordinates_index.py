"""add_job_coordinates_index

Revision ID: b21f834d0fa1
Revises: a10e921e9ea0
Create Date: 2026-10-24 22:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b21f834d0fa1'
down_revision: Union[str, Sequence[str], None] = 'a10e921e9ea0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add composite index on jobs(latitude, longitude) for fast bounding-box lookups."""
    op.create_index(
        'ix_jobs_coordinates',
        'jobs',
        ['latitude', 'longitude'],
        unique=False
    )


def downgrade() -> None:
    """Downgrade schema - Remove composite index on jobs(latitude, longitude)."""
    op.drop_index('ix_jobs_coordinates', table_name='jobs')
