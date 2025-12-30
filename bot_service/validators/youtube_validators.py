"""
YouTube URL валидаторы
Проверка и извлечение video_id из YouTube URL
"""
import re
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

# Regex паттерны для YouTube URL
YOUTUBE_PATTERNS = [
    # youtube.com/watch?v=VIDEO_ID
    r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})(?:&.*)?$',
    # youtu.be/VIDEO_ID
    r'(?:https?://)?(?:www\.)?youtu\.be/([a-zA-Z0-9_-]{11})(?:\?.*)?$',
    # youtube.com/embed/VIDEO_ID
    r'(?:https?://)?(?:www\.)?youtube\.com/embed/([a-zA-Z0-9_-]{11})(?:\?.*)?$',
    # youtube.com/v/VIDEO_ID
    r'(?:https?://)?(?:www\.)?youtube\.com/v/([a-zA-Z0-9_-]{11})(?:\?.*)?$',
]


def validate_youtube_url(url: str) -> Tuple[bool, str, str]:
    """
    Валидирует YouTube URL и извлекает video_id
    
    Args:
        url: URL для проверки
        
    Returns:
        (is_valid, video_id, error_message)
        - is_valid: True если URL валиден
        - video_id: Извлеченный ID видео (или пустая строка)
        - error_message: Сообщение об ошибке (или пустая строка)
    """
    if not url or not isinstance(url, str):
        return False, "", "URL is empty or invalid"

    url = url.strip()

    if len(url) < 10:
        return False, "", "URL is too short"

    if len(url) > 500:
        return False, "", "URL is too long"

    # Проверяем что это YouTube URL
    if not any(domain in url.lower() for domain in ['youtube.com', 'youtu.be']):
        return False, "", "Not a YouTube URL"

    # Пробуем извлечь video_id
    for pattern in YOUTUBE_PATTERNS:
        match = re.match(pattern, url)
        if match:
            video_id = match.group(1)

            # Проверяем что video_id валиден (11 символов, буквы/цифры/-/_)
            if len(video_id) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', video_id):
                logger.debug(f"[OK] Valid YouTube URL: {url} → {video_id}")
                return True, video_id, ""
            else:
                return False, "", f"Invalid video ID format: {video_id}"

    # Если ни один паттерн не подошел
    return False, "", "Invalid YouTube URL format"


def is_valid_youtube_url(url: str) -> bool:
    """
    Простая проверка валидности YouTube URL
    
    Args:
        url: URL для проверки
        
    Returns:
        True если URL валиден
    """
    is_valid, _, _ = validate_youtube_url(url)
    return is_valid


def extract_video_id(url: str) -> str:
    """
    Извлекает video_id из YouTube URL
    
    Args:
        url: YouTube URL
        
    Returns:
        video_id или пустая строка если URL невалиден
    """
    _, video_id, _ = validate_youtube_url(url)
    return video_id
