"""Add versioning columns to TTSUserSettings, ChatBoxSettings, and DropsReward

Revision ID: 20251105_add_versioning
Revises: 
Create Date: 2025-11-05

"""
from alembic import op
import sqlalchemy as sa

# This should be set to the last migration revision
revision = '20251105_add_versioning'
down_revision = None  # Set this to the previous migration ID
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add version columns"""
    
    # Add version column to tts_user_settings if it doesn't exist
    try:
        op.add_column('tts_user_settings', 
                      sa.Column('version', sa.Integer(), nullable=False, server_default='1'))
    except Exception as e:
        print(f"Note: tts_user_settings.version may already exist: {e}")
    
    # Add version column to chatbox_settings if it doesn't exist
    try:
        op.add_column('chatbox_settings',
                      sa.Column('version', sa.Integer(), nullable=False, server_default='1'))
    except Exception as e:
        print(f"Note: chatbox_settings.version may already exist: {e}")
    
    # Add version column to drops_rewards if it doesn't exist
    try:
        op.add_column('drops_rewards',
                      sa.Column('version', sa.Integer(), nullable=False, server_default='1'))
    except Exception as e:
        print(f"Note: drops_rewards.version may already exist: {e}")


def downgrade() -> None:
    """Remove version columns"""
    
    try:
        op.drop_column('drops_rewards', 'version')
    except Exception as e:
        print(f"Note: drops_rewards.version may not exist: {e}")
    
    try:
        op.drop_column('chatbox_settings', 'version')
    except Exception as e:
        print(f"Note: chatbox_settings.version may not exist: {e}")
    
    try:
        op.drop_column('tts_user_settings', 'version')
    except Exception as e:
        print(f"Note: tts_user_settings.version may not exist: {e}")

