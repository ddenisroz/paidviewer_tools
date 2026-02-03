"""Add extra_settings to bot_commands

Revision ID: add_extra_settings_cmd
Revises: 20251218_add_fundamental_constraints
Create Date: 2026-01-31

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_extra_settings_cmd'
down_revision = '20251218_fundamental'
branch_labels = None
depends_on = None


def upgrade():
    # Add extra_settings column to bot_commands
    op.add_column('bot_commands', sa.Column('extra_settings', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('bot_commands', 'extra_settings')
