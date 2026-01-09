# bot_service/repositories/whitelisted_channel_repository.py
from typing import Optional, List
from sqlalchemy.orm import Session
from models.pydantic_models import WhitelistedChannelPublic # Import model if needed for return type hint? No, repo returns DB model usually.
from core.database import WhitelistedChannel
from repositories.base_repository import BaseRepository

class WhitelistedChannelRepository(BaseRepository[WhitelistedChannel]):
    def __init__(self, db: Session):
        super().__init__(WhitelistedChannel, db)

    def get_all(self) -> List[WhitelistedChannel]:
        return self.db.query(WhitelistedChannel).all()

    def get_by_name(self, channel_name: str) -> Optional[WhitelistedChannel]:
        return self.db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == channel_name
        ).first()

    def add_channel(self, channel_name: str) -> WhitelistedChannel:
        channel = WhitelistedChannel(channel_name=channel_name)
        self.db.add(channel)
        self.db.commit()
        self.db.refresh(channel)
        return channel

    def remove_channel(self, channel: WhitelistedChannel):
        self.db.delete(channel)
        self.db.commit()

    def delete_by_channel_name(self, channel_name: str) -> int:
        """Delete channel by name."""
        result = self.db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == channel_name
        ).delete()
        self.db.commit()
        return result
