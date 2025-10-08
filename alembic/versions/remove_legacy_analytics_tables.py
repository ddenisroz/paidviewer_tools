"""Remove legacy analytics tables

Revision ID: remove_legacy_analytics
Revises: 974036a6950c
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'remove_legacy_analytics'
down_revision = '4a2a8e4e2af1'
branch_labels = None
depends_on = None


def upgrade():
    """Remove legacy analytics tables that are no longer used"""
    # Drop stream_peaks table
    op.drop_table('stream_peaks')
    
    # Drop stream_data table
    op.drop_table('stream_data')


def downgrade():
    """Recreate legacy analytics tables (not recommended)"""
    # Note: This downgrade is not implemented as these tables are legacy
    # and should not be recreated. If you need to restore them,
    # you would need to recreate the table definitions from the original schema.
    pass
