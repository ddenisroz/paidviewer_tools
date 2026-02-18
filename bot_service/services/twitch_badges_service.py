"""
API для получения Twitch badges (значков)
"""
import aiohttp
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Кэш для badges (чтобы не запрашивать каждый раз)
GLOBAL_BADGES_CACHE: Optional[Dict] = None
CHANNEL_BADGES_CACHE: Dict[str, Dict] = {}  # {channel_id: badges_dict}


async def get_global_badges(client_id: str, access_token: str) -> Dict:
    """
    Получить глобальные badges Twitch
    """
    global GLOBAL_BADGES_CACHE

    if GLOBAL_BADGES_CACHE:
        return GLOBAL_BADGES_CACHE

    url = "https://api.twitch.tv/helix/chat/badges/global"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Client-Id": client_id
    }

    try:
        # Timeout: 10 секунд на соединение, 30 секунд на чтение
        timeout = aiohttp.ClientTimeout(total=30, connect=10)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()

                    # Преобразуем в удобный формат: {badge_id: {version: url}}
                    badges_dict = {}
                    for badge_set in data.get('data', []):
                        set_id = badge_set['set_id']
                        badges_dict[set_id] = {}
                        for version in badge_set['versions']:
                            badges_dict[set_id][version['id']] = {
                                'image_url_1x': version['image_url_1x'],
                                'image_url_2x': version['image_url_2x'],
                                'image_url_4x': version['image_url_4x'],
                            }

                    GLOBAL_BADGES_CACHE = badges_dict
                    logger.info(f"[OK] Loaded {len(badges_dict)} global badge sets")
                    return badges_dict
                else:
                    logger.error(f"[ERROR] Failed to fetch global badges: {response.status}")
                    return {}
    except Exception:
        logger.exception("[ERROR] Error fetching global badges")
        return {}


async def get_channel_badges(broadcaster_id: str, client_id: str, access_token: str) -> Dict:
    """
    Получить badges конкретного канала
    """
    if broadcaster_id in CHANNEL_BADGES_CACHE:
        return CHANNEL_BADGES_CACHE[broadcaster_id]

    url = f"https://api.twitch.tv/helix/chat/badges?broadcaster_id={broadcaster_id}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Client-Id": client_id
    }

    try:
        # Timeout: 10 секунд на соединение, 30 секунд на чтение
        timeout = aiohttp.ClientTimeout(total=30, connect=10)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()

                    # Преобразуем в удобный формат
                    badges_dict = {}
                    for badge_set in data.get('data', []):
                        set_id = badge_set['set_id']
                        badges_dict[set_id] = {}
                        for version in badge_set['versions']:
                            badges_dict[set_id][version['id']] = {
                                'image_url_1x': version['image_url_1x'],
                                'image_url_2x': version['image_url_2x'],
                                'image_url_4x': version['image_url_4x'],
                            }

                    CHANNEL_BADGES_CACHE[broadcaster_id] = badges_dict
                    logger.info(f"[OK] Loaded {len(badges_dict)} badge sets for channel {broadcaster_id}")
                    return badges_dict
                elif response.status == 400:
                    # 400 Bad Request - обычно означает что канал не найден или неверный broadcaster_id
                    error_text = await response.text()
                    logger.warning(f"[WARN] Channel badges not available for broadcaster {broadcaster_id}: {response.status} - {error_text}")
                    # Кэшируем пустой результат, чтобы не запрашивать снова
                    CHANNEL_BADGES_CACHE[broadcaster_id] = {}
                    return {}
                elif response.status == 404:
                    # 404 Not Found - канал не найден
                    logger.warning(f"[WARN] Channel {broadcaster_id} not found")
                    CHANNEL_BADGES_CACHE[broadcaster_id] = {}
                    return {}
                else:
                    error_text = await response.text()
                    logger.error(f"[ERROR] Failed to fetch channel badges: {response.status} - {error_text}")
                    # Не кэшируем ошибки, чтобы можно было повторить попытку
                    return {}
    except Exception:
        logger.exception("[ERROR] Error fetching channel badges")
        return {}


def get_badge_url(badge_id: str, version: str, global_badges: Dict, channel_badges: Dict, size: str = '2x') -> Optional[str]:
    """
    Получить URL значка по ID и версии
    
    Args:
        badge_id: ID значка (например, "broadcaster", "subscriber")
        version: Версия значка (например, "1", "12")
        global_badges: Словарь глобальных badges
        channel_badges: Словарь badges канала
        size: Размер ('1x', '2x', '4x')
    
    Returns:
        URL значка или None
    """
    # Сначала ищем в badges канала (приоритет)
    if badge_id in channel_badges and version in channel_badges[badge_id]:
        return channel_badges[badge_id][version].get(f'image_url_{size}')

    # Затем в глобальных badges
    if badge_id in global_badges and version in global_badges[badge_id]:
        return global_badges[badge_id][version].get(f'image_url_{size}')

    return None


