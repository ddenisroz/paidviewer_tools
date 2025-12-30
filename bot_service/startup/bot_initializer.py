# bot_service/startup/bot_initializer.py
"""
Инициализация Twitch и VK Live ботов.

Вынесено из main.py для улучшения модульности и тестируемости.
"""

import os
import asyncio
import logging
from typing import Optional, List

import httpx

from core.config import settings
from core.connection_manager import get_connection_manager
from core.database import SessionLocal, User, UserToken, get_db
from core.token_encryption import decrypt_token, is_token_encrypted
from bots.twitch_bot import Bot
from bots.vk_live_bot import VKLiveBot
from .bot_registry import get_bot_registry

logger = logging.getLogger(__name__)


async def generate_vk_client_credentials_token() -> Optional[str]:
    """
    Генерирует токен для VK Live бота используя ClientCredentials flow.
    
    Returns:
        access_token или None при ошибке
    """
    vk_client_id = settings.vk_client_id
    vk_client_secret = settings.vk_client_secret
    
    if not vk_client_id or not vk_client_secret:
        logger.warning("[WARN] VK_CLIENT_ID or VK_CLIENT_SECRET not configured")
        return None
    
    try:
        import base64
        
        logger.info("[VK] Generating VK Live bot token using ClientCredentials...")
        
        credentials = f"{vk_client_id}:{vk_client_secret}"
        base64_credentials = base64.b64encode(credentials.encode()).decode()
        
        headers = {
            "Authorization": f"Basic {base64_credentials}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        payload = {"grant_type": "client_credentials"}
        
        async with httpx.AsyncClient(timeout=10.0, trust_env=False) as client:
            response = await client.post(
                "https://api.live.vkvideo.ru/oauth/server/token",
                data=payload,
                headers=headers
            )
            
            if response.status_code == 200:
                token_data = response.json()
                access_token = token_data.get("access_token")
                
                if access_token:
                    os.environ["VK_LIVE_USER_TOKEN"] = access_token
                    logger.info("[OK] VK Live bot token generated (expires in 3600s)")
                    return access_token
                else:
                    logger.error("[ERROR] No access_token in VK Live response")
            else:
                logger.error(f"[ERROR] VK token generation failed: {response.status_code}")
                
    except Exception as e:
        logger.error(f"[ERROR] Error generating VK Live token: {e}")
    
    return None


async def validate_vk_oauth_token(access_token: str) -> bool:
    """
    Проверяет валидность VK OAuth токена.
    
    Returns:
        True если токен валиден
    """
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            response = await client.get(
                'https://apidev.live.vkvideo.ru/v1/current_user',
                headers={'Authorization': f'Bearer {access_token}'}
            )
        return response.status_code == 200
    except Exception as e:
        logger.warning(f"[WARN] VK token validation error: {e}")
        return False


async def refresh_vk_token_if_needed(user_id: int, access_token: str) -> Optional[str]:
    """
    Обновляет VK токен если он истёк.
    
    Returns:
        Новый access_token или None
    """
    # Проверяем текущий токен
    async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
        response = await client.get(
            'https://apidev.live.vkvideo.ru/v1/current_user',
            headers={'Authorization': f'Bearer {access_token}'}
        )
    
    if response.status_code == 200:
        return access_token  # Токен валиден
    
    if response.status_code != 401:
        return None  # Другая ошибка
    
    # Токен истёк, пробуем обновить
    logger.info("[VK] Token expired, attempting refresh...")
    
    try:
        from api.vk_api import VKLiveAPI
        vk_api = VKLiveAPI()
        new_token = await vk_api._refresh_user_token(user_id)
        
        if new_token:
            logger.info("[OK] VK token refreshed")
            return new_token
        else:
            logger.error("[ERROR] Failed to refresh VK token")
            
    except Exception as e:
        logger.error(f"[ERROR] VK token refresh error: {e}")
    
    return None


async def initialize_twitch_bot(channels: Optional[List[str]] = None) -> bool:
    """
    Инициализирует Twitch бота.
    
    Приоритет токенов:
    1. OAuth токен из БД (с refresh_token) - предпочтительно
    2. TMI токен из .env (без refresh_token) - fallback
    
    Args:
        channels: Список каналов для подключения (опционально)
    
    Returns:
        True если бот успешно запущен
    """
    registry = get_bot_registry()
    
    if registry.is_twitch_running():
        logger.info("[INFO] Twitch bot already running")
        return True
    
    # Приоритет 1: Проверяем OAuth токен из БД
    from services.twitch_bot_oauth_service import twitch_bot_oauth_service
    
    db = next(get_db())
    try:
        bot_token_data = await twitch_bot_oauth_service.get_bot_token(db)
        
        if bot_token_data:
            logger.info("[TWITCH] Found OAuth bot token in database")
            
            # Проверяем и обновляем токен если нужно
            await twitch_bot_oauth_service.refresh_if_needed(db)
            
            # Перечитываем токен после возможного обновления
            bot_token_data = await twitch_bot_oauth_service.get_bot_token(db)
            bot_token = f"oauth:{bot_token_data['access_token']}"
            
            logger.info(f"[TWITCH] Using OAuth token for bot: {bot_token_data['bot_login']}")
            use_oauth = True
        else:
            logger.info("[TWITCH] No OAuth token in database, checking .env...")
            bot_token = settings.twitch_bot_token
            use_oauth = False
            
            if not bot_token:
                logger.warning("[WARN] TWITCH_BOT_TOKEN not configured")
                logger.warning("[INFO] To configure OAuth bot token:")
                logger.warning("[INFO] 1. Go to /auth/twitch/bot/login (admin only)")
                logger.warning("[INFO] 2. Or set TWITCH_BOT_TOKEN in .env")
                return False
    finally:
        db.close()
    
    # Валидируем токен перед запуском бота
    from services.bot_token_validator import bot_token_validator
    
    logger.info("[TWITCH] Validating bot token before initialization...")
    validation_result = await bot_token_validator.validate_twitch_bot_token()
    
    if not validation_result['valid']:
        logger.error("[ERROR] [TWITCH] Cannot start bot with invalid token!")
        logger.error(f"[ERROR] Reason: {validation_result.get('error', 'Unknown')}")
        
        if use_oauth:
            logger.error("[FIX] OAuth token is invalid. Please re-authorize:")
            logger.error("[FIX] Go to /auth/twitch/bot/login (admin only)")
        else:
            if 'instructions' in validation_result:
                logger.error(f"[FIX] {validation_result['instructions']}")
        
        return False
    
    try:
        connection_manager = get_connection_manager()
        channels = channels or []
        
        logger.info("=" * 80)
        logger.info("[TWITCH] Creating Twitch bot instance...")
        logger.info(f"[TWITCH] Token validated: ✅")
        logger.info(f"[TWITCH] Bot user: {validation_result.get('login', 'unknown')}")
        logger.info(f"[TWITCH] Channels to connect: {channels}")
        logger.info("=" * 80)
        
        bot = Bot(bot_token, channels, connection_manager)
        
        logger.info("[TWITCH] Bot instance created, starting bot.start() task...")
        task = asyncio.create_task(bot.start())
        
        registry.twitch_bot = bot
        registry.twitch_task = task
        
        logger.info("[TWITCH] Task created, waiting 5 seconds for connection...")
        await asyncio.sleep(5)  # Ждём подключения
        
        # Проверяем статус задачи
        if task.done():
            logger.error("[ERROR] [TWITCH] Bot task completed unexpectedly!")
            if task.exception():
                logger.error(f"[ERROR] [TWITCH] Task exception: {task.exception()}")
                import traceback
                logger.error(traceback.format_exception(type(task.exception()), task.exception(), task.exception().__traceback__))
            return False
        else:
            logger.info("[OK] [TWITCH] Bot task is running")
        
        # Проверяем подключение
        if hasattr(bot, 'nick') and bot.nick:
            logger.info(f"[OK] [TWITCH] Bot connected as: {bot.nick}")
        else:
            logger.warning("[WARN] [TWITCH] Bot nick not set yet, may still be connecting...")
        
        logger.info("[OK] Twitch bot started")
        return True
        
    except Exception as e:
        logger.error(f"[ERROR] Twitch bot initialization failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


async def initialize_vk_bot() -> bool:
    """
    Инициализирует VK Live бота.
    
    Returns:
        True если бот успешно запущен
    """
    registry = get_bot_registry()
    
    if registry.is_vk_running():
        logger.info("[INFO] VK Live bot already running")
        return True
    
    connection_manager = get_connection_manager()
    
    # Приоритет 1: ClientCredentials токен
    vk_bot_token = settings.vk_live_user_token
    
    if vk_bot_token:
        logger.info("[OK] Using VK Live ClientCredentials token")
        
        try:
            bot = VKLiveBot(vk_bot_token, connection_manager)
            task = asyncio.create_task(bot.start_bot())
            
            registry.vk_bot = bot
            registry.vk_task = task
            
            logger.info("[OK] VK Live bot initialized with ClientCredentials")
        except Exception as e:
            logger.error(f"[ERROR] VK bot creation failed: {e}")
            return False
    
    # Приоритет 2: OAuth токен из БД
    await _connect_vk_bot_to_user_channel(registry, connection_manager)
    
    return registry.is_vk_running()


async def _connect_vk_bot_to_user_channel(registry, connection_manager) -> None:
    """Подключает VK бота к каналу пользователя через OAuth токен."""
    logger.info("[VK] Checking for user OAuth token...")
    
    db = SessionLocal()
    try:
        token_record = db.query(UserToken).filter(
            UserToken.platform == 'vk',
            UserToken.access_token.isnot(None),
            UserToken.is_active.is_(True)
        ).first()
        
        if not token_record:
            logger.info("[VK] No VK OAuth token found")
            return
        
        logger.info(f"[VK] Found token for user_id: {token_record.user_id}")
        
        # Расшифровываем токен
        access_token = token_record.access_token
        if is_token_encrypted(access_token):
            access_token = decrypt_token(access_token)
        
        # Проверяем/обновляем токен
        access_token = await refresh_vk_token_if_needed(
            token_record.user_id, 
            access_token
        )
        
        if not access_token:
            logger.warning("[WARN] VK token invalid, please re-authorize")
            return
        
        # Получаем channel_name
        user = db.query(User).filter(User.id == token_record.user_id).first()
        if not user:
            logger.warning(f"[WARN] User {token_record.user_id} not found")
            return
        
        channel_name = user.vk_channel_name or user.vk_username
        if not channel_name:
            logger.warning(f"[WARN] User {user.id} has no VK channel name")
            return
        
        # Создаём бота если ещё не создан
        if not registry.vk_bot:
            logger.info(f"[VK] Creating bot with OAuth token for user {token_record.user_id}")
            bot = VKLiveBot(access_token, connection_manager)
            task = asyncio.create_task(bot.start_bot())
            registry.vk_bot = bot
            registry.vk_task = task
        
        # Подключаемся к каналу
        logger.info(f"[VK] Connecting to channel: {channel_name}")
        success = await registry.vk_bot.connect_to_channel(channel_name)
        
        if success:
            logger.info(f"[OK] VK bot connected to {channel_name}")
        else:
            logger.error(f"[ERROR] Failed to connect to {channel_name}")
            
    except Exception as e:
        logger.error(f"[ERROR] VK bot channel connection failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        db.close()


async def initialize_all_bots() -> None:
    """
    Инициализирует всех ботов при старте приложения.
    
    Вызывается из lifespan startup.
    """
    if settings.testing:
        logger.info("[TEST] Testing mode: skipping bot initialization")
        return
    
    # Генерируем VK ClientCredentials токен
    await generate_vk_client_credentials_token()
    
    # Получаем каналы для ботов
    connection_manager = get_connection_manager()
    db = next(get_db())
    
    try:
        twitch_channels = await connection_manager.get_twitch_channels_for_bot(db)
        vk_channels = await connection_manager.get_vk_channels_for_bot(db)
        
        logger.info(f"[STARTUP] Twitch channels: {twitch_channels}")
        logger.info(f"[STARTUP] VK channels: {vk_channels}")
        
        # Запускаем ботов
        await initialize_twitch_bot(twitch_channels)
        await initialize_vk_bot()
        
    except Exception as e:
        logger.error(f"[ERROR] Bot initialization failed: {e}")
    finally:
        db.close()
