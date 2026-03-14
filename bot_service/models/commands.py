"""Bot command model."""

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String

from core.datetime_utils import utcnow_naive
from models.base import Base


class BotCommand(Base):
    """Bot command definition.

    Command types:
    - `global`: shared built-in commands (`user_id=NULL`)
    - `override`: user overrides of a global command
    - `custom`: fully custom user command
    """

    __tablename__ = "bot_commands"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    channel_name = Column(String, nullable=True, index=True)
    command_name = Column(String, nullable=False, index=True)
    command_type = Column(String, nullable=False, index=True)
    parent_command_id = Column(Integer, ForeignKey("bot_commands.id"), nullable=True)
    alias = Column(String, nullable=True, index=True)
    description = Column(String, nullable=True)
    response_text = Column(String, nullable=True)
    is_enabled = Column(Boolean, default=True)
    platforms = Column(String, nullable=False, default="twitch,vk")
    allowed_roles = Column(String, nullable=False, default="all")
    cooldown_seconds = Column(Integer, default=0)
    last_used = Column(DateTime, nullable=True)
    usage_count = Column(Integer, default=0)
    tags = Column(String, nullable=True, default="")
    extra_settings = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
