# bot_service/startup/bot_initializer.py
"""
Инициализация Twitch и VK Live ботов.

Вынесено из main.py для улучшения модульности и тестируемости.
"""

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


async def validate_vk_oauth_token(access_token: str) -> bool:
    """
    Проверяет валидность VK OAuth токена.
    
    Returns:
        True если токен валиден
    """
    try:
        from core.config import settings
        ssl_verify = settings.is_production
        async with httpx.AsyncClient(timeout=5.0, verify=ssl_verify) as client:
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
    from core.config import settings
    ssl_verify = settings.is_production
    async with httpx.AsyncClient(timeout=5.0, verify=ssl_verify) as client:
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
        from services.token_refresh_service import TokenRefreshService
        new_token = await TokenRefreshService.refresh_on_401(user_id, 'vk')
        
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
            # Fallback: legacy env token
            if settings.twitch_bot_token:
                bot_token = settings.twitch_bot_token
                if not bot_token.startswith("oauth:"):
                    bot_token = f"oauth:{bot_token}"
                logger.warning("[TWITCH] Using legacy bot token from .env (no refresh)")
                use_oauth = False
            else:
                logger.error("[WARN] Twitch bot OAuth token not configured.")
                logger.error("[FIX] Configure a dedicated Twitch bot account:")
                logger.error("[FIX] Go to /auth/twitch/bot/login (admin only)")
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
        logger.info("[TWITCH] Token validated: OK")
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
    
    # Приоритет 1: OAuth токен из БД (VkBotOAuthService)
    from services.vk_bot_oauth_service import vk_bot_oauth_service
    db = next(get_db())
    try:
        bot_token_data = await vk_bot_oauth_service.get_bot_token(db)
        
        if bot_token_data:
            logger.info("[VK] Found OAuth bot token in database")
            
            # Проверяем и обновляем токен если нужно
            await vk_bot_oauth_service.refresh_if_needed(db)
            
            # Перечитываем токен
            bot_token_data = await vk_bot_oauth_service.get_bot_token(db)
            access_token = bot_token_data.get('access_token')
            
            if access_token:
                logger.info(f"[VK] Using OAuth token for bot: {bot_token_data.get('bot_login')}")
                try:
                    bot = VKLiveBot(access_token, connection_manager)
                    task = asyncio.create_task(bot.start_bot())
                    registry.vk_bot = bot
                    registry.vk_task = task
                    logger.info("[OK] VK Live bot initialized with OAuth token")
                    return True
                except Exception as e:
                    logger.error(f"[ERROR] VK bot creation with OAuth token failed: {e}")
            else:
                logger.warning("[WARN] VK OAuth token found but access_token is missing")
    except Exception as e:
        logger.error(f"[ERROR] Error checking VK OAuth token: {e}")
    finally:
        db.close()

    # Fallback: legacy env token
    if settings.vk_live_user_token:
        logger.warning("[VK] Using legacy bot token from .env (no refresh)")
        try:
            bot = VKLiveBot(settings.vk_live_user_token, connection_manager)
            task = asyncio.create_task(bot.start_bot())
            registry.vk_bot = bot
            registry.vk_task = task
            logger.info("[OK] VK Live bot initialized with legacy env token")
            return True
        except Exception as e:
            logger.error(f"[ERROR] VK bot creation with env token failed: {e}")

    # Fallback 2: Use user VK OAuth token from database
    logger.info("[VK] Trying user OAuth token as fallback...")
    db2 = next(get_db())
    try:
        token_record = db2.query(UserToken).filter(
            UserToken.platform == 'vk',
            UserToken.access_token.isnot(None),
            UserToken.is_active.is_(True)
        ).first()
        
        if token_record:
            access_token = token_record.access_token
            if is_token_encrypted(access_token):
                access_token = decrypt_token(access_token)
            
            logger.info(f"[VK] Using user OAuth token (user_id={token_record.user_id})")
            try:
                bot = VKLiveBot(access_token, connection_manager)
                task = asyncio.create_task(bot.start_bot())
                registry.vk_bot = bot
                registry.vk_task = task
                logger.info("[OK] VK Live bot initialized with user OAuth token")
                return True
            except Exception as e:
                logger.error(f"[ERROR] VK bot creation with user OAuth token failed: {e}")
    except Exception as e:
        logger.error(f"[ERROR] Error checking user VK OAuth token: {e}")
    finally:
        db2.close()

    logger.error("[WARN] VK bot OAuth token not configured.")
    logger.error("[FIX] Configure a dedicated VK bot account:")
    logger.error("[FIX] Go to /auth/vk/bot/login (admin only)")

    return False


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

        # Подключаем VK бота к каналам после инициализации
        try:
            registry = get_bot_registry()
            if registry.vk_bot and vk_channels:
                for channel_name in vk_channels:
                    logger.info(f"[VK] Connecting bot to channel: {channel_name}")
                    success = await registry.vk_bot.connect_to_channel(channel_name)
                    if success:
                        logger.info(f"[OK] VK bot connected to {channel_name}")
                    else:
                        logger.error(f"[ERROR] Failed to connect VK bot to {channel_name}")
        except Exception as e:
            logger.error(f"[ERROR] VK channel connect pass failed: {e}")
        
    except Exception as e:
        logger.error(f"[ERROR] Bot initialization failed: {e}")
    finally:
        db.close()
