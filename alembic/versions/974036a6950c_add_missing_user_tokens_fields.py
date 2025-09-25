"""add_missing_user_tokens_fields

Revision ID: 974036a6950c
Revises: da709b00ae1f
Create Date: 2025-09-23 17:00:04.305297

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '974036a6950c'
down_revision: Union[str, Sequence[str], None] = 'da709b00ae1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add missing fields to user_tokens table."""
    with op.batch_alter_table('user_tokens', schema=None) as batch_op:
        batch_op.add_column(sa.Column('platform_user_id', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('platform_display_name', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('avatar_url', sa.String(500), nullable=True))
        batch_op.add_column(sa.Column('scopes', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Remove added fields from user_tokens table."""
    with op.batch_alter_table('user_tokens', schema=None) as batch_op:
        batch_op.drop_column('scopes')
        batch_op.drop_column('avatar_url')
        batch_op.drop_column('platform_display_name')
        batch_op.drop_column('platform_user_id')
