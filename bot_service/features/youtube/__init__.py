# bot_service/features/youtube/__init__.py
"""
YouTube Feature Module

This module contains all YouTube integration functionality:
- YouTube video queue management
- YouTube API integration
- YouTube service for video info retrieval
- YouTube API endpoints
"""

from .youtube_service import YouTubeService
from .queue_service import QueueService
from .youtube_api import youtube_router
from .youtube_api_legacy import YouTubeAPI

__all__ = [
    'YouTubeService',
    'QueueService',
    'youtube_router',
    'YouTubeAPI',
]
