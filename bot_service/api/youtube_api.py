# bot_service/youtube_api.py
import re
import logging
from typing import Optional, Dict, Any
from pytube import YouTube
from pytube.exceptions import PytubeError
from urllib.error import URLError

logger = logging.getLogger(__name__)

class YouTubeAPI:
    def __init__(self):
        pass

    def extract_video_id(self, url: str) -> Optional[str]:
        """Извлечь ID видео из YouTube URL"""
        patterns = [
            r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
            r'youtube\.com/watch\?.*v=([a-zA-Z0-9_-]{11})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        return None

    def get_video_info(self, url: str) -> Optional[Dict[str, Any]]:
        """Получить информацию о YouTube видео"""
        try:
            video_id = self.extract_video_id(url)
            if not video_id:
                logger.error(f"Invalid YouTube URL: {url}")
                return None

            yt = YouTube(url)
            
            # Получаем информацию о видео
            video_info = {
                "video_id": video_id,
                "title": yt.title,
                "url": url,
                "duration": yt.length,
                "thumbnail_url": yt.thumbnail_url,
                "author": yt.author,
                "views": yt.views,
                "description": yt.description[:500] if yt.description else "",  # Ограничиваем описание
            }
            
            logger.info(f"YouTube video info extracted: {video_info['title']}")
            return video_info
            
        except PytubeError as e:
            logger.error(f"Pytube error for URL {url}: {e}")
            return None
        except URLError as e:
            logger.error(f"URL error for {url}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error for URL {url}: {e}")
            return None

    def validate_url(self, url: str) -> bool:
        """Проверить, является ли URL валидным YouTube URL"""
        video_id = self.extract_video_id(url)
        return video_id is not None

    def get_thumbnail_url(self, video_id: str, quality: str = "medium") -> str:
        """Получить URL миниатюры видео"""
        quality_map = {
            "default": "default",
            "medium": "mqdefault", 
            "high": "hqdefault",
            "standard": "sddefault",
            "maxres": "maxresdefault"
        }
        
        quality_key = quality_map.get(quality, "mqdefault")
        return f"https://img.youtube.com/vi/{video_id}/{quality_key}.jpg"
