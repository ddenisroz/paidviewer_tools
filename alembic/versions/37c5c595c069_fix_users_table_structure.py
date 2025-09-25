"""fix_users_table_structure

Revision ID: 37c5c595c069
Revises: 974036a6950c
Create Date: 2025-09-23 18:13:09.488716

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '37c5c595c069'
down_revision: Union[str, Sequence[str], None] = '974036a6950c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix users table structure to match the new unified user model."""
    # Drop the old users table and recreate it with the correct structure
    op.drop_table('users')
    
    # Create the new users table with correct structure
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('display_name', sa.String(length=255), nullable=True),
        sa.Column('is_admin', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False)
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop the new users table and recreate the old structure
    op.drop_table('users')
    
    # Recreate the old users table structure
    op.create_table('users',
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        sa.Column('username', sa.String(), nullable=True),
        sa.Column('display_name', sa.String(), nullable=True),
        sa.Column('avatar', sa.String(), nullable=True),
        sa.Column('platform', sa.String(), nullable=True),
        sa.Column('twitch_access_token', sa.String(), nullable=True),
        sa.Column('twitch_refresh_token', sa.String(), nullable=True),
        sa.Column('is_admin', sa.Boolean(), nullable=True),
        sa.Column('settings', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('session_id', sa.String(), nullable=True),
        sa.Column('last_activity', sa.DateTime(), nullable=True)
    )
