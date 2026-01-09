# bot_service/services/youtube/youtube_service.py
import re
import aiohttp
import logging
from typing import Optional, Dict, Any

from core.retry_utils import retry_async

logger = logging.getLogger('bot_service')

class YouTubeService:
    """
    Сервис для работы с YouTube API
    """

    def __init__(self):
        from core.config import settings
        self.api_key = settings.youtube_api_key
        self.base_url = "https://www.googleapis.com/youtube/v3"

    async def get_video_info(self, video_url: str) -> Optional[Dict[str, Any]]:
        """Получение информации о YouTube видео"""
        try:
            video_id = self._extract_video_id(video_url)
            if not video_id:
                logger.error(f"Could not extract video ID from URL: {video_url}")
                return None

            if not self.api_key:
                logger.warning("YouTube API key not configured, using fallback method")
                return await self._get_video_info_fallback(video_id, video_url)

            # Запрос к YouTube API с retry
            async def _do_request():
                timeout = aiohttp.ClientTimeout(total=30, connect=10)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    url = f"{self.base_url}/videos"
                    params = {
                        'part': 'snippet,contentDetails,statistics',
                        'id': video_id,
                        'key': self.api_key
                    }
                    async with session.get(url, params=params) as response:
                        return response

            response = await retry_async(
                _do_request,
                max_attempts=3,
                initial_delay=2.0,
                retry_on=(aiohttp.ClientError, aiohttp.ClientConnectorError)
            )

            if not response:
                logger.error(f"YouTube API request failed after retries for: {video_id}")
                return await self._get_video_info_fallback(video_id, video_url)

            if response.status == 200:
                data = await response.json()

                if not data.get('items'):
                    logger.error(f"Video not found: {video_id}")
                    return None

                video_data = data['items'][0]
                return self._parse_video_data(video_data, video_url)
            else:
                logger.error(f"YouTube API error: {response.status}")
                return await self._get_video_info_fallback(video_id, video_url)

        except Exception as e:
            logger.error(f"Error getting video info: {e}")
            return None

    def _extract_video_id(self, url: str) -> Optional[str]:
        """Извлечение video ID из URL"""
        try:
            # Поддерживаемые форматы:
            # https://www.youtube.com/watch?v=VIDEO_ID
            # https://youtu.be/VIDEO_ID
            # https://www.youtube.com/embed/VIDEO_ID
            # https://www.youtube.com/v/VIDEO_ID

            patterns = [
                r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/v/)([^&\n?#]+)',
                r'youtube\.com/watch\?.*v=([^&\n?#]+)',
            ]

            for pattern in patterns:
                match = re.search(pattern, url)
                if match:
                    return match.group(1)

            return None

        except Exception as e:
            logger.error(f"Error extracting video ID: {e}")
            return None

    async def _get_video_info_fallback(self, video_id: str, video_url: str) -> Dict[str, Any]:
        """Fallback метод получения информации без API"""
        try:
            # Пытаемся получить информацию через pytube
            try:
                from pytube import YouTube
                yt = YouTube(video_url)

                return {
                    'video_id': video_id,
                    'title': yt.title or f"YouTube Video {video_id}",
                    'duration': yt.length or 0,
                    'thumbnail_url': yt.thumbnail_url or f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
                    'channel_title': yt.author or "Unknown Channel",
                    'view_count': yt.views or 0,
                    'like_count': 0,
                    'description': (yt.description or "")[:500],
                    'url': video_url,
                    'is_fallback': True
                }
            except Exception as pytube_error:
                logger.warning(f"Pytube fallback failed: {pytube_error}")

                # Если pytube не работает, используем базовую информацию
                return {
                    'video_id': video_id,
                    'title': f"YouTube Video {video_id}",
                    'duration': 0,
                    'thumbnail_url': f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
                    'channel_title': "Unknown Channel",
                    'view_count': 0,
                    'like_count': 0,
                    'description': "",
                    'url': video_url,
                    'is_fallback': True
                }

        except Exception as e:
            logger.error(f"Error in fallback method: {e}")
            return None

    def _parse_video_data(self, video_data: Dict[str, Any], video_url: str) -> Dict[str, Any]:
        """Парсинг данных видео из YouTube API"""
        try:
            snippet = video_data.get('snippet', {})
            content_details = video_data.get('contentDetails', {})
            statistics = video_data.get('statistics', {})

            # Парсинг длительности (ISO 8601 формат)
            duration_iso = content_details.get('duration', 'PT0S')
            duration_formatted = self._parse_duration(duration_iso)

            return {
                'video_id': video_data.get('id'),
                'title': snippet.get('title', 'Unknown Title'),
                'duration': duration_formatted,
                'thumbnail_url': snippet.get('thumbnails', {}).get('medium', {}).get('url', ''),
                'channel_title': snippet.get('channelTitle', 'Unknown Channel'),
                'view_count': int(statistics.get('viewCount', 0)),
                'like_count': int(statistics.get('likeCount', 0)),
                'description': snippet.get('description', ''),
                'published_at': snippet.get('publishedAt'),
                'url': video_url,
                'is_fallback': False
            }

        except Exception as e:
            logger.error(f"Error parsing video data: {e}")
            return self._get_video_info_fallback(video_data.get('id', ''), video_url)

    def _parse_duration(self, duration_iso: str) -> str:
        """Парсинг ISO 8601 длительности в читаемый формат"""
        try:
            # PT4M13S -> 4:13
            # PT1H30M -> 1:30:00

            import re

            # Убираем PT в начале
            duration = duration_iso.replace('PT', '')

            # Ищем часы, минуты, секунды
            hours_match = re.search(r'(\d+)H', duration)
            minutes_match = re.search(r'(\d+)M', duration)
            seconds_match = re.search(r'(\d+)S', duration)

            hours = int(hours_match.group(1)) if hours_match else 0
            minutes = int(minutes_match.group(1)) if minutes_match else 0
            seconds = int(seconds_match.group(1)) if seconds_match else 0

            if hours > 0:
                return f"{hours}:{minutes:02d}:{seconds:02d}"
            else:
                return f"{minutes}:{seconds:02d}"

        except Exception as e:
            logger.error(f"Error parsing duration: {e}")
            return "Unknown"

    def is_valid_youtube_url(self, url: str) -> bool:
        """Проверка валидности YouTube URL"""
        try:
            video_id = self._extract_video_id(url)
            return video_id is not None and len(video_id) == 11
        except Exception:
            return False

    def get_embed_url(self, video_id: str) -> str:
        """Получение URL для встраивания"""
        return f"https://www.youtube.com/embed/{video_id}"

    async def search_videos(self, query: str, max_results: int = 5) -> list:
        """Поиск видео по запросу"""
        try:
            if not self.api_key:
                logger.warning("YouTube API key not configured for search")
                return []

            url = f"{self.base_url}/search"
            params = {
                'part': 'snippet',
                'q': query,
                'type': 'video',
                'maxResults': max_results,
                'key': self.api_key
            }

            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        results = []

                        for item in data.get('items', []):
                            video_id = item['id']['videoId']
                            snippet = item['snippet']

                            results.append({
                                'video_id': video_id,
                                'title': snippet.get('title'),
                                'url': f"https://www.youtube.com/watch?v={video_id}",
                                'thumbnail_url': snippet.get('thumbnails', {}).get('medium', {}).get('url'),
                                'channel_title': snippet.get('channelTitle')
                            })

                        return results
                    else:
                        logger.error(f"YouTube search API error: {response.status}")
                        return []

        except Exception as e:
            logger.error(f"Error searching videos: {e}")
            return []
