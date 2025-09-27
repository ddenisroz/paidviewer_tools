# bot_service/models.py
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Whitelist models
class WhitelistedChannelPublic(BaseModel):
    id: int
    channel_name: str
    platform: str
    added_at: datetime

    class Config:
        from_attributes = True

class AddToWhitelistRequest(BaseModel):
    username: str

class WhitelistResponse(BaseModel):
    whitelist_users: List[WhitelistedChannelPublic]

# YouTube models
class YouTubeVideoPublic(BaseModel):
    id: int
    video_id: str
    title: str
    url: str
    duration: int
    thumbnail_url: str
    added_at: datetime
    user_id: str

    class Config:
        from_attributes = True

class QueueResponse(BaseModel):
    current_video: Optional[YouTubeVideoPublic] = None
    queue: List[YouTubeVideoPublic] = []
    is_playing: bool = False

# Blocked bots models
class BlockedBotPublic(BaseModel):
    id: int
    bot_name: str
    added_at: datetime

    class Config:
        from_attributes = True

class AddBlockedBotRequest(BaseModel):
    bot_name: str

# User models
class UserPublic(BaseModel):
    id: int
    display_name: str
    is_admin: bool
    is_blocked: bool = False
    blocked_reason: Optional[str] = None
    blocked_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Stream management models
class UpdateTitleRequest(BaseModel):
    title: str

class UpdateCategoryRequest(BaseModel):
    categoryId: str

class StreamUpdateData(BaseModel):
    title: Optional[str] = None
    category_id: Optional[str] = None

class StreamUpdateRequest(BaseModel):
    twitch: Optional[StreamUpdateData] = None
    vk: Optional[StreamUpdateData] = None

# OBS models
class ObsUrlResponse(BaseModel):
    obs_token: str
