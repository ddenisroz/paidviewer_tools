# bot_service/main.py
"""Основной файл bot_service"""
import os
import sys
import asyncio
import logging
import requests
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, WebSocket, Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# ⚠️ КРИТИЧНО: Добавить bot_service в sys.path ПЕРВЫМ делом!
# Получаем путь к bot_service
BOT_SERVICE_ROOT = Path(__file__).parent
PROJECT_ROOT = BOT_SERVICE_ROOT.parent

# Добавляем bot_service в sys.path
if str(BOT_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(BOT_SERVICE_ROOT))

# Теперь можем импортировать core.project_paths
from core.project_paths import BOT_SERVICE_ROOT, PROJECT_ROOT

# Загружаем .env
env_path = BOT_SERVICE_ROOT / '.env'
load_dotenv(dotenv_path=env_path, override=True)

# Импорты из новых модулей
from core.app_config import create_app, setup_logging

# Настройка логирования
setup_logging()
logger = logging.getLogger(__name__)

from core.middleware import SecurityHeadersMiddleware, RequestLoggingMiddleware
from core.auth_handlers import auth_handlers
from core.background_tasks import background_tasks
from core.database import get_db, init_db, User, UserToken
from core.connection_manager import get_connection_manager
from core.session_manager import session_manager
from auth.auth import get_current_user, get_current_user_optional
# Rate limiting handled by slowapi
from bots.twitch_bot import Bot
from services.memory_tts_queue import memory_tts_queue
from core.security_modern import limiter, rate_limit_handler
from services.memory_websocket_manager import memory_websocket_manager
# Удален database_session_storage - дублирует session_manager
# Удален modern_monitor - используем enhanced_logger

# Импорты роутеров
from api.tts_api import tts_router, voices_router, user_voices_router, local_tts_router
from api.youtube_api_endpoints import youtube_router
from api.drops_api import router as drops_router
from api.moderation_api import router as moderation_router
from api.database_management_api import router as database_router
from api.commands_api import router as commands_router
from api.points_api_endpoints import points_router
from api.session_api import router as session_api_router
from api.support_api import router as support_router
from auth.vk_auth import router as vk_auth_router
from auth.twitch_auth import router as twitch_auth_router
from api.vk_api import router as vk_api_router
from api.twitch_api_badges import router as twitch_badges_router
from auth.donationalerts_auth import router as da_auth_router
from api.widgets import router as widgets_router
from api.bot_control_api import router as bot_control_router
from api.stream_info_api import router as stream_info_router
from api.additional_api import router as additional_router
from api.obs_integration_api import router as obs_integration_router
from api.system_api import router as system_router
from api.user_settings_api import router as user_settings_router
from api.chatbox_api import router as chatbox_router
from api.monitoring_api import router as monitoring_router

from core.token_utils import get_user_token_from_db, validate_platform_token

async def initialize_twitch_bot():
    """Инициализация Twitch бота"""
    try:
        import os
        from bots.twitch_bot import Bot
        
        twitch_token = os.getenv("TWITCH_BOT_TOKEN")
        if not twitch_token:
            logger.warning("TWITCH_BOT_TOKEN not configured, skipping Twitch bot initialization")
            return
        
        global bot_instance, bot_task
        
        if not bot_instance:
            logger.info("Creating new Twitch bot instance...")
            connection_manager = get_connection_manager()
            bot_instance = Bot(twitch_token, [], connection_manager)
            bot_task = asyncio.create_task(bot_instance.start())
            await asyncio.sleep(2)  # Ждем подключения
            logger.info("Twitch bot successfully initialized")
        else:
            logger.info("Twitch bot already running")
            
    except Exception as e:
        logger.error(f"Error initializing Twitch bot: {e}")

async def initialize_vk_live_bot():
    """Инициализация VK Live бота
    
    NOTE: VK_LIVE_USER_TOKEN - это токен БОТА (отдельный аккаунт VK Live для работы в чате).
    Это НЕ токен стримера! Токен стримера получается через OAuth и хранится в БД.
    
    Аналогично Twitch:
    - VK_LIVE_USER_TOKEN = токен бота для чата (как TWITCH_BOT_TOKEN)
    - UserToken(platform='vk') = токен стримера для управления (из OAuth)
    """
    try:
        import os
        from bots.vk_live_bot import VKLiveBot
        
        vk_token = os.getenv("VK_LIVE_USER_TOKEN")  # Токен БОТА для чата
        if not vk_token:
            logger.warning("VK_LIVE_USER_TOKEN not configured, skipping VK Live bot initialization")
            logger.info("💡 VK_LIVE_USER_TOKEN is the BOT account token for chat. Get it from VK Live for your bot account.")
            return
        
        global vk_live_bot_instance, vk_live_bot_task
        
        if not vk_live_bot_instance:
            logger.info("Creating new VK Live bot instance...")
            connection_manager = get_connection_manager()
            vk_live_bot_instance = VKLiveBot(vk_token, connection_manager)
            vk_live_bot_task = asyncio.create_task(vk_live_bot_instance.start())
            await asyncio.sleep(2)  # Ждем подключения
            logger.info("VK Live bot successfully initialized")
        else:
            logger.info("VK Live bot already running")
            
    except Exception as e:
        logger.error(f"Error initializing VK Live bot: {e}")

# Импорты API роутеров (уже импортированы выше, удаляем дубликаты)

# Настройка логирования
logger = setup_logging()

# Создание приложения
app = create_app()

# Импорт глобальных переменных
# Глобальные переменные для ботов (заменяем global_vars)
bot_instance = None
bot_task = None
vk_live_bot_instance = None
vk_live_bot_task = None

# Добавление middleware
# Session Middleware (должен быть первым)
from starlette.middleware.sessions import SessionMiddleware
# Получаем секретный ключ из переменных окружения
secret_key = os.getenv("SECRET_KEY")
if not secret_key:
    raise ValueError("SECRET_KEY environment variable is required for security")

app.add_middleware(
    SessionMiddleware,
    secret_key=secret_key
)

# Trusted Host Middleware для защиты от Host Header атак
# Временно отключаем для тестов
# from fastapi.middleware.trustedhost import TrustedHostMiddleware
# app.add_middleware(
#     TrustedHostMiddleware,
#     allowed_hosts=["localhost", "127.0.0.1", "*.yourdomain.com"]
# )

# CORS Middleware
from fastapi.middleware.cors import CORSMiddleware
from constants import DEFAULT_FRONTEND_URL
CORS_ORIGINS = os.getenv("CORS_ORIGINS", f"{os.getenv('FRONTEND_URL', DEFAULT_FRONTEND_URL)},{os.getenv('FRONTEND_URL', DEFAULT_FRONTEND_URL).replace('5173', '3000')}")
allowed_origins = [origin.strip() for origin in CORS_ORIGINS.split(',')]

logger.info(f"🔐 CORS configured for origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-CSRFToken"],
    expose_headers=["Content-Type"],
)

# Явный обработчик OPTIONS запросов для CORS
@app.options("/{path:path}")
async def options_handler(request: Request, path: str):
    """Обработчик OPTIONS запросов для CORS"""
    from fastapi.responses import Response
    
    origin = request.headers.get("origin")
    if origin in allowed_origins:
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRFToken",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "3600"
            }
        )
    return Response(status_code=403)

# Rate Limiting handled by advanced_rate_limiter in endpoints

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# --- Lifespan Events ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    
    # Startup
    logger.info("Bot service starting on port 8000")
    
    try:
        # Инициализация базы данных
        init_db()
        logger.info("Database initialized")
        
        # Инициализация сервисов (без Redis)
        try:
            await memory_tts_queue.start()
            logger.info("Memory TTS Queue started")
        except Exception as e:
            logger.error(f"Failed to start Memory TTS Queue: {e}")
            raise
            
        try:
            await memory_websocket_manager.start()
            logger.info("Memory WebSocket Manager started")
        except Exception as e:
            logger.error(f"Failed to start Memory WebSocket Manager: {e}")
            raise
        
        # Мониторинг теперь только в админке
        
        # Инициализация connection_manager (как в оригинале)
        connection_manager = get_connection_manager()
        db = next(get_db())
        try:
            await connection_manager.restore_active_sessions_from_db(db)
            active_channels = connection_manager.get_active_channels()
            logger.info(f"Restored {len(active_channels)} active channels")
            
            # Восстанавливаем TTS состояние для всех пользователей
            from core.database import User, UserToken
            
            # Загружаем всех пользователей с включенным TTS (только те кто сам включил)
            users_with_tts = db.query(User).filter(User.tts_enabled == True).all()
            for user in users_with_tts:
                # Включаем TTS для Twitch каналов
                if user.twitch_username:
                    connection_manager.enable_tts_for_channel(user.twitch_username.lower())
                    logger.info(f"✅ Restored TTS for Twitch: {user.twitch_username}")
                
                # Включаем TTS для VK каналов
                vk_token = db.query(UserToken).filter(
                    UserToken.user_id == user.id,
                    UserToken.platform == 'vk',
                    UserToken.is_active == True
                ).first()
                if vk_token and vk_token.platform_user_id:
                    connection_manager.enable_tts_for_channel(vk_token.platform_user_id)
                    logger.info(f"✅ Restored TTS for VK: {vk_token.platform_user_id}")
            
            logger.info(f"✅ Restored TTS state for {len(users_with_tts)} users")
        finally:
            db.close()
        
        # Запуск фоновых задач
        await background_tasks.start_all_tasks()
        logger.info("Background tasks started")
        
        # --- Monitoring System ---
        # TODO: Monitoring system module needs to be implemented
        # Мониторинг в разработке
        # try:
        #     from monitoring import bot_monitor
        #     bot_monitor.start_monitoring(interval=60)  # Каждую минуту
        #     logger.info("System monitoring started for bot_service")
        # except Exception as e:
        #     logger.warning(f"Failed to start monitoring: {e}")
        
        # --- Backup System ---
        # TODO: Backup system module needs to be implemented
        # Система backup в разработке
        # try:
        #     from backup_manager import bot_backup_manager
        #     bot_backup_manager.schedule_backups()
        #     bot_backup_manager.start_scheduler()
        #     logger.info("Backup system started")
        # except Exception as e:
        #     logger.warning(f"Failed to start backup system: {e}")
        
        logger.info("=== BOT SERVICE STARTED WITH ENHANCED LOGGING ===")
        
        # Запуск современного мониторинга (удалено - используем enhanced_logger)
        # try:
        #     # modern_monitor.start_monitoring(interval=30)  # Удалено
        #     logger.info("✅ Enhanced logging system active")
        # except Exception as e:
        #     logger.error(f"Failed to start monitoring: {e}")
        
        logger.info("✅ Enhanced logging system active")
        
        # Инициализация ботов при старте (как в оригинальном монолите)
        # Пропускаем инициализацию ботов в тестовом режиме
        if os.getenv("TESTING") == "true":
            logger.info("🧪 Testing mode: skipping bot initialization")
        else:
            try:
                # === VK Live ClientCredentials Token Generation ===
                # Генерируем токен для VK Live бота используя ClientCredentials flow
                vk_client_id = os.getenv("VK_CLIENT_ID")
                vk_client_secret = os.getenv("VK_CLIENT_SECRET")
                
                if vk_client_id and vk_client_secret:
                    try:
                        import base64
                        import httpx
                        
                        logger.info("🔄 Generating VK Live bot token using ClientCredentials...")
                        
                        # Подготавливаем Basic Auth
                        credentials = f"{vk_client_id}:{vk_client_secret}"
                        base64_credentials = base64.b64encode(credentials.encode()).decode()
                        
                        headers = {
                            "Authorization": f"Basic {base64_credentials}",
                            "Content-Type": "application/x-www-form-urlencoded"
                        }
                        
                        payload = {
                            "grant_type": "client_credentials"
                        }
                        
                        async with httpx.AsyncClient(timeout=10.0, trust_env=False) as client:
                            token_response = await client.post(
                                "https://api.live.vkvideo.ru/oauth/server/token",
                                data=payload,
                                headers=headers
                            )
                            
                            if token_response.status_code == 200:
                                token_data = token_response.json()
                                vk_access_token = token_data.get("access_token")
                                
                                if vk_access_token:
                                    # Сохраняем токен в переменную окружения для использования ботом
                                    os.environ["VK_LIVE_USER_TOKEN"] = vk_access_token
                                    logger.info("✅ VK Live bot token successfully generated (expires in 3600 seconds)")
                                else:
                                    logger.error("❌ No access_token in VK Live response")
                            else:
                                logger.error(f"❌ VK Live token generation failed: {token_response.status_code} - {token_response.text}")
                    
                    except Exception as e:
                        logger.error(f"❌ Error generating VK Live token: {e}")
                        logger.info("⚠️ VK Live bot will not be available until token is generated")
                else:
                    logger.warning("⚠️ VK_CLIENT_ID or VK_CLIENT_SECRET not configured, skipping VK Live token generation")
                
                # === Используем глобальные переменные напрямую ===
                connection_manager = get_connection_manager()
                
                # Получаем Twitch каналы для бота
                twitch_channels = await connection_manager.get_twitch_channels_for_bot(db)
                
                # Получаем VK Live каналы для бота
                vk_channels = await connection_manager.get_vk_channels_for_bot(db)
                
                # Запускаем Twitch бота (даже без активных каналов для гостевого режима)
                global bot_instance, bot_task
                bot_token = os.getenv("TWITCH_BOT_TOKEN")
                if bot_token:
                    bot_instance = Bot(bot_token, twitch_channels, connection_manager)
                    bot_task = asyncio.create_task(bot_instance.start())
                    logger.info("✅ Twitch bot started and ready for connections.")
                    
                    # Ждем подключения бота к Twitch
                    await asyncio.sleep(3)
                    
                    # Бот уже подключился к initial_channels автоматически,
                    # но нужно подключиться к гостевым каналам если есть
                    
                    # Проверяем, есть ли активные гостевые сессии и подключаемся к их каналам
                    try:
                        from core.database import SessionLocal, UserSession
                        db = SessionLocal()
                        guest_sessions = db.query(UserSession).filter(
                            UserSession.user_id == -1,
                            UserSession.is_active == True
                        ).all()
                        db.close()
                        
                        for session in guest_sessions:
                            device_info = session.device_info
                            if device_info and 'monitored_channel' in device_info:
                                channel_name = device_info['monitored_channel']
                                platform = device_info.get('platform', 'twitch')
                                
                                if platform == 'twitch' and channel_name:
                                    logger.info(f"🔌 Connecting bot to guest channel: {channel_name}")
                                    try:
                                        await bot_instance.join_channel(channel_name)
                                        logger.info(f"✅ Bot connected to guest channel: {channel_name}")
                                    except Exception as e:
                                        logger.error(f"❌ Failed to connect to guest channel {channel_name}: {e}")
                    except Exception as e:
                        logger.error(f"❌ Error connecting to guest channels: {e}")
                    
                    if active_channels:
                        logger.info(f"🚀 Found active channels: {active_channels}")
                        logger.info(f"🎮 Twitch channels to connect: {twitch_channels}")
                        logger.info(f"🎮 VK Live channels to connect: {vk_channels}")
                    else:
                        logger.info("📺 No active channels found, but bot is ready for guest connections.")
                else:
                    logger.warning("⚠️ TWITCH_BOT_TOKEN not found. Twitch bot not started.")
                
                # Запускаем VK Live бота НЕЗАВИСИМО от Twitch
                # (переносим логику из else блока на этот уровень)
                try:
                    global vk_live_bot_instance, vk_live_bot_task
                    from bots.vk_live_bot import VKLiveBot
                    from core.database import SessionLocal, UserToken, User
                    
                    # Приоритет 1: Используем сгенерированный ClientCredentials токен
                    vk_bot_token = os.getenv("VK_LIVE_USER_TOKEN")
                    
                    if vk_bot_token:
                        logger.info("✅ Using generated VK Live ClientCredentials token for bot")
                        
                        # Создаем и запускаем VK Live бота с bot токеном
                        vk_live_bot_instance = VKLiveBot(vk_bot_token, connection_manager)
                        vk_live_bot_task = asyncio.create_task(vk_live_bot_instance.start_bot())
                        logger.info("✅ VK Live bot successfully initialized with ClientCredentials token")
                    else:
                        logger.info("ℹ️ No ClientCredentials token, will try to create bot with OAuth token")
                    
                    # Теперь пытаемся подключить бота к каналу пользователя через OAuth токен
                    # Если бот ещё не создан, создадим его с OAuth токеном
                    if True:  # Всегда проверяем OAuth токен
                        logger.info("📺 [VK] Checking for user OAuth token to connect to channel...")
                        
                        db_temp = SessionLocal()
                        try:
                            vk_token_record = db_temp.query(UserToken).filter(
                                UserToken.platform == 'vk',
                                UserToken.access_token.isnot(None),
                                UserToken.is_active == True
                            ).first()
                            
                            if vk_token_record:
                                logger.info(f"📺 [VK] Found VK token record for user_id: {vk_token_record.user_id}")
                                
                                # Расшифровываем токен перед использованием
                                from core.token_encryption import decrypt_token, is_token_encrypted
                                vk_access_token = vk_token_record.access_token
                                if is_token_encrypted(vk_access_token):
                                    vk_access_token = decrypt_token(vk_access_token)
                                    logger.info(f"🔓 [VK] Token decrypted for validation")
                                
                                # Проверяем валидность токена через VK Live API
                                import requests
                                try:
                                    logger.info(f"📺 [VK] Testing VK OAuth token validity...")
                                    # Используем dev API (только он доступен, SSL verification отключена)
                                    test_response = requests.get(f'https://apidev.live.vkvideo.ru/v1/current_user', 
                                                               headers={'Authorization': f'Bearer {vk_access_token}'}, 
                                                               timeout=5,
                                                               verify=False)
                                    logger.info(f"📺 [VK] Token validation response: status={test_response.status_code}")
                                    if test_response.status_code == 401:
                                        logger.info("🔄 VK Live OAuth token expired, refreshing automatically...")
                                        logger.info("🔄 Attempting to refresh VK token using refresh_token...")
                                        
                                        # Пытаемся обновить токен через refresh_token
                                        from api.vk_api import VKLiveAPI
                                        vk_api = VKLiveAPI()
                                        new_access_token = await vk_api._refresh_user_token(vk_token_record.user_id)
                                        
                                        if new_access_token:
                                            logger.info("✅ VK token successfully refreshed!")
                                            vk_access_token = new_access_token
                                            # Повторяем валидацию с новым токеном (используем dev API)
                                            test_response = requests.get(f'https://apidev.live.vkvideo.ru/v1/current_user', 
                                                                       headers={'Authorization': f'Bearer {vk_access_token}'}, 
                                                                       timeout=5,
                                                                       verify=False)
                                            logger.info(f"📺 [VK] Token validation after refresh: status={test_response.status_code}")
                                            
                                            if test_response.status_code != 200:
                                                logger.error("❌ VK token refresh failed - token still invalid")
                                                logger.info("💡 Please re-authorize VK integration on frontend")
                                        else:
                                            logger.error("❌ Failed to refresh VK token")
                                            logger.info("💡 Please re-authorize VK integration on frontend to get a new token")
                                    
                                    if test_response.status_code == 200:
                                        # Получаем channel_name из User таблицы для подключения бота к каналу
                                        user_record = db_temp.query(User).filter(User.id == vk_token_record.user_id).first()
                                        if user_record:
                                            # Приоритет: vk_channel_name (ник канала) > vk_username (fallback для старых записей)
                                            channel_name = user_record.vk_channel_name or user_record.vk_username
                                            if channel_name:
                                                logger.info(f"📺 [VK] Connecting to channel: {channel_name}")
                                            else:
                                                logger.warning(f"⚠️ [VK] User {user_record.id} has no vk_channel_name or vk_username")
                                                channel_name = None
                                        else:
                                            logger.warning(f"⚠️ [VK] User record not found for token user_id: {vk_token_record.user_id}")
                                            channel_name = None
                                        
                                        if channel_name:
                                            # Если бот ещё не создан (нет ClientCredentials), создаём с OAuth токеном
                                            if not vk_live_bot_instance:
                                                logger.info(f"📺 [VK] Creating VK Live bot with OAuth token for user {vk_token_record.user_id}")
                                                vk_live_bot_instance = VKLiveBot(vk_access_token, connection_manager)
                                                vk_live_bot_task = asyncio.create_task(vk_live_bot_instance.start_bot())
                                                logger.info("✅ VK Live bot created with OAuth token")
                                            
                                            # Подключаемся к каналу пользователя
                                            logger.info(f"🔌 Connecting VK Live bot to channel: {channel_name}")
                                            success = await vk_live_bot_instance.connect_to_channel(channel_name)
                                            if success:
                                                logger.info(f"✅ VK Live bot connected to channel: {channel_name}")
                                            else:
                                                logger.error(f"❌ Failed to connect VK Live bot to channel: {channel_name}")
                                        else:
                                            logger.warning("⚠️ VK username not found for user")
                                except Exception as e:
                                    logger.warning(f"⚠️ Failed to validate VK OAuth token: {e}")
                                    logger.info("💡 Please re-authorize VK integration on frontend")
                            else:
                                logger.info("📺 No VK OAuth token found in database")
                                logger.info("💡 Authorize VK integration on frontend to connect bot to your channel")
                                logger.info("💡 VK ClientCredentials token is active, but user OAuth token is needed for channel connection")
                        finally:
                            db_temp.close()
                        
                except Exception as e:
                    logger.error(f"❌ Error starting VK Live bot: {e}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
            
            except Exception as e:
                logger.error(f"Error during bot initialization: {e}")
        
    except Exception as e:
        logger.error(f"Error during startup: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Bot service shutting down")
    
    try:
        # Используем глобальные переменные напрямую
        connection_manager = get_connection_manager()
        
        # Очищаем все активные VK боты (как в оригинале)
        active_vk_bots = connection_manager.active_vk_bots
        logger.info(f"🧹 Cleaning up {len(active_vk_bots)} active VK bots...")
        for channel_name, bot_data in list(active_vk_bots.items()):
            try:
                vk_live_bot = bot_data["bot"]
                await vk_live_bot.disconnect()
                logger.info(f"✅ VK Live bot disconnected from {channel_name}")
            except Exception as e:
                logger.error(f"❌ Error disconnecting VK Live bot from {channel_name}: {e}")
        
        # Остановка фоновых задач
        await background_tasks.stop_all_tasks()
        logger.info("Background tasks stopped")
        
        # Остановка ботов
        if bot_task:
            bot_task.cancel()
            try:
                await bot_task
            except asyncio.CancelledError:
                pass
        
        if vk_live_bot_task:
            vk_live_bot_task.cancel()
            try:
                await vk_live_bot_task
            except asyncio.CancelledError:
                pass
        
        # Очистка соединений
        # connection_manager не имеет метода cleanup()
        logger.info("Connections cleaned up")
        
        # Остановка сервисов (без Redis)
        try:
            await memory_tts_queue.stop()
            logger.info("Memory TTS Queue stopped")
        except Exception as e:
            logger.error(f"Error stopping Memory TTS Queue: {e}")
            
        try:
            await memory_websocket_manager.stop()
            logger.info("Memory WebSocket Manager stopped")
        except Exception as e:
            logger.error(f"Error stopping Memory WebSocket Manager: {e}")
        
        # Остановка мониторинга (удалено - используем enhanced_logger)
        try:
            # modern_monitor.stop_monitoring()  # Удалено
            logger.info("Enhanced logging system stopped")
        except Exception as e:
            logger.error(f"Error stopping monitoring: {e}")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

# Установка lifespan
app.router.lifespan_context = lifespan

# --- WebSocket Endpoints ---
@app.websocket("/ws/chat/{user_id}")
async def websocket_chat(websocket: WebSocket, user_id: str):
    logger.info(f"🔌 WebSocket connection for user {user_id}")
    
    await websocket.accept()
    logger.info(f"✅ WebSocket accepted for user {user_id}")
    
    # Отменяем отложенное отключение TTS если пользователь переподключился
    user_id_int = int(user_id) if user_id.isdigit() else -1
    if user_id_int > 0:
        from core.connection_manager import get_connection_manager
        conn_mgr = get_connection_manager()
        conn_mgr.cancel_tts_disconnect(user_id_int)
    
    # Добавляем соединение в memory manager
    from services.memory_websocket_manager import memory_websocket_manager
    conn_id = await memory_websocket_manager.add_connection(
        websocket, 
        user_id_int,
        f"user_{user_id}",
        "chat"
    )
    logger.info(f"✅ Connection added: {conn_id}")
    
    # Отправляем историю сообщений сразу после подключения
    try:
        from core.database import ChatMessage, User, get_db
        db = next(get_db())
        try:
            user = db.query(User).filter(User.id == user_id_int).first()
            if user:
                # Получаем последние 50 сообщений для всех каналов пользователя
                messages = []
                
                # Twitch сообщения
                if user.twitch_username:
                    twitch_messages = db.query(ChatMessage).filter(
                        ChatMessage.user_id == user_id_int,
                        ChatMessage.platform == 'twitch'
                    ).order_by(ChatMessage.timestamp.desc()).limit(50).all()
                    messages.extend(twitch_messages)
                
                # VK сообщения
                if user.vk_channel_name:
                    vk_messages = db.query(ChatMessage).filter(
                        ChatMessage.user_id == user_id_int,
                        ChatMessage.platform == 'vk'
                    ).order_by(ChatMessage.timestamp.desc()).limit(50).all()
                    messages.extend(vk_messages)
                
                # Сортируем все сообщения по времени
                messages.sort(key=lambda x: x.timestamp)
                
                # Форматируем для отправки
                import json
                import time
                history_data = []
                for msg in messages[-50:]:  # Последние 50
                    # Парсим badges если это строка JSON
                    badges_list = msg.badges
                    if isinstance(badges_list, str):
                        try:
                            badges_list = json.loads(badges_list)
                        except:
                            badges_list = None
                    
                    # Конвертируем datetime в миллисекунды (JavaScript Date.now() формат)
                    timestamp_ms = None
                    if msg.timestamp:
                        timestamp_ms = int(msg.timestamp.timestamp() * 1000)
                    
                    history_data.append({
                        "id": msg.id,
                        "platform": msg.platform,
                        "author": msg.author_username,
                        "author_name": msg.author_username,
                        "message": msg.message,
                        "timestamp": timestamp_ms,
                        "role": msg.role,  # Роль пользователя
                        "badges": badges_list  # Значки пользователя (массив)
                    })
                
                # Отправляем историю
                await websocket.send_text(json.dumps({
                    "type": "chat_history",
                    "messages": history_data
                }))
                
                # Debug: Проверяем первое сообщение
                if history_data:
                    sample_msg = history_data[0]
                    logger.info(f"📜 [WS HISTORY] Sample message: author={sample_msg.get('author')}, badges={sample_msg.get('badges')}, role={sample_msg.get('role')}")
                
                logger.info(f"📜 Sent {len(history_data)} messages history to ChatOverlay")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"❌ Error sending chat history: {e}")
    
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"📨 Received from user {user_id}: {data}")
            
            # Отвечаем на ping
            if data == '{"type":"ping"}':
                await websocket.send_text('{"type":"pong"}')
                
    except Exception as e:
        logger.info(f"🔌 WebSocket disconnected for user {user_id}: {e}")
    finally:
        await memory_websocket_manager.remove_connection(conn_id)
        logger.info(f"✅ Connection removed: {conn_id}")
        
        # Планируем отключение TTS с таймером (если пользователь не переподключится)
        if user_id_int > 0:
            from core.connection_manager import get_connection_manager
            from core.database import User, get_db
            
            conn_mgr = get_connection_manager()
            
            # Получаем username для логов
            db = next(get_db())
            try:
                user = db.query(User).filter(User.id == user_id_int).first()
                
                # ⚠️ Проверяем что пользователь существует (может быть удалён)
                if user:
                    username = user.twitch_username or user.vk_username or f"user_{user_id_int}"
                    
                    # Запускаем таймер на отключение TTS
                    conn_mgr.schedule_tts_disconnect(user_id_int, username)
                else:
                    logger.warning(f"⚠️ User {user_id_int} not found (possibly deleted), skipping TTS disconnect")
            finally:
                db.close()

# Тестовый WebSocket endpoint для проверки
@app.websocket("/ws/test")
async def websocket_test(websocket: WebSocket):
    logger.info("🔌 Test WebSocket connection attempt")
    await websocket.accept()
    logger.info("✅ Test WebSocket connected")
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"📨 Test WebSocket received: {data}")
            await websocket.send_text(f"Echo: {data}")
    except Exception as e:
        logger.error(f"❌ Test WebSocket error: {e}")
        await websocket.close()

# Старые WebSocket endpoints удалены - используем memory_websocket_manager напрямую

# --- Auth Endpoints ---
# УДАЛЕНО: старый endpoint /auth/twitch/login - используется роутер из twitch_auth.py

@app.get("/test-callback")
async def test_callback():
    logger.info("Test callback route called!")
    return {"message": "Test callback works"}

# Twitch OAuth endpoints moved to auth/twitch_auth.py router
# Removed duplicate endpoints to avoid conflicts

@app.post("/api/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return await auth_handlers.logout(current_user)

@app.get("/api/auth/status")
# Rate limiting handled by slowapi
async def auth_status(request: Request, db: Session = Depends(get_db)):
    """Получить статус авторизации и интеграций с проверкой валидности токенов."""
    logger.info("=== AUTH STATUS REQUEST START ===")
    session_id = request.cookies.get("session_id")
    logger.info(f"🔍 Auth status request - session_id: {session_id}")
    logger.info(f"🔍 All cookies: {request.cookies}")
    
    if not session_id:
        logger.info("❌ No session_id found in cookies")
        logger.info("=== AUTH STATUS REQUEST END (no session) ===")
        return {"authenticated": False}

    logger.info(f"🔍 Validating session: {session_id}")
    session_data = session_manager.validate_session(session_id)
    logger.info(f"🔍 Session validation result: {session_data}")
    
    if not session_data:
        logger.info("❌ Session validation failed")
        logger.info("=== AUTH STATUS REQUEST END (invalid session) ===")
        return {"authenticated": False, "integrations": {}}
    
    user_id = session_data.get("user_id", -1)
    logger.info(f"🔍 Extracted user_id from session: {user_id}")
    
    if user_id == -1:
        logger.info("🔍 Guest session detected")
        # Формируем user object для гостя из session_data
        device_info = session_data.get("device_info", {})
        guest_user = {
            "id": -1,
            "session_id": session_id,  # Добавляем session_id для уникальной идентификации
            "username": device_info.get("monitored_channel", "guest"),
            "is_guest": True,
            "is_admin": False,
            "platform": device_info.get("platform", "unknown")
        }
        logger.info(f"🔍 Returning guest user: {guest_user}")
        logger.info("=== AUTH STATUS REQUEST END (guest) ===")
        return {"authenticated": True, "user": guest_user, "integrations": {}}
    
    logger.info(f"🔍 Regular user session - user_id: {user_id}")
    
    # Получаем актуальные данные пользователя из базы данных
    user_data = {}
    user = None
    try:
        logger.info(f"🔍 Querying user from database for user_id: {user_id}")
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            logger.info(f"🔍 Found user in database: {user.id}, twitch_username: {user.twitch_username}, vk_channel_name: {user.vk_channel_name or user.vk_username}")
            user_data = {
                "id": user.id,
                "twitch_username": user.twitch_username,
                "vk_username": user.vk_username,
                "is_admin": user.is_admin
            }
        else:
            logger.warning(f"❌ User not found in database for user_id: {user_id}")
    except Exception as e:
        logger.error(f"❌ Error getting user data: {e}")
        user_data = {
            "id": user_id,
            "twitch_username": None,
            "vk_username": None,
            "is_admin": session_data.get("is_admin", False)
        }
    
    integrations = {}
    try:
        logger.info(f"🔍 Querying UserToken for user_id: {user_id}")
        user_tokens = db.query(UserToken).filter(UserToken.user_id == user_id).all()
        logger.info(f"🔍 Found {len(user_tokens)} tokens for user {user_id}")
        
        for i, token in enumerate(user_tokens):
            # БЕЗОПАСНАЯ проверка is_active (колонка может не существовать в старых БД)
            is_active = getattr(token, 'is_active', True)
            logger.info(f"🔍 Token {i+1}: platform={token.platform}, platform_user_id={token.platform_user_id}, has_access_token={bool(token.access_token)}, is_active={is_active}")
            
            # Пропускаем неактивные токены (отключенные через disconnect)
            if not is_active:
                logger.info(f"⚠️ Token for {token.platform} is inactive (disconnected), skipping")
                continue
            
            if token.access_token:
                logger.info(f"🔍 Validating token for {token.platform}...")
                # ВАЛИДАЦИЯ ТОКЕНА ЧЕРЕЗ API ПЛАТФОРМЫ (с обработкой сетевых ошибок)
                try:
                    is_valid = await validate_platform_token(token)
                    logger.info(f"🔍 Token validation result for {token.platform}: {is_valid}")
                except Exception as e:
                    # При сетевых ошибках считаем токен валидным (не можем проверить)
                    logger.warning(f"⚠️ Token validation network error for {token.platform}: {type(e).__name__}, assuming valid")
                    is_valid = True
                
                if is_valid:
                    logger.info(f"✅ Token for {token.platform} is valid")
                    
                    # ВАЖНО: Для VK Live проверяем что это OAuth токен стримера, а не токен бота
                    if token.platform == 'vk':
                        # VK токен должен иметь refresh_token И scopes чтобы быть OAuth токеном стримера
                        if not token.refresh_token or not token.scopes:
                            logger.info(f"⚠️ VK token missing refresh_token or scopes - это токен бота, не показываем в интеграциях")
                            continue  # Пропускаем этот токен
                        logger.info(f"✅ VK token has refresh_token and scopes - это OAuth токен стримера")
                    
                    # Получаем username из базы данных пользователя
                    username = None
                    if token.platform == 'twitch' and user:
                        username = user.twitch_username
                    elif token.platform == 'vk' and user:
                        username = user.vk_username
                    elif token.platform == 'donationalerts' and user:
                        username = getattr(user, 'donationalerts_username', None)
                    
                    logger.info(f"🔍 Adding {token.platform} to integrations with username: {username}")
                    integrations[token.platform] = {
                        "connected": True,
                        "enabled": True,  # Frontend expects 'enabled' for StreamCategoryCard
                        "platform_user_id": token.platform_user_id,
                        "avatar_url": token.avatar_url,
                        "username": username
                    }
                else:
                    # Токен недействителен - НЕ добавляем в интеграции, НО НЕ удаляем (может быть временная проблема)
                    logger.warning(f"⚠️ Invalid token for {token.platform} user {user_id}, skipping integration (keeping token for retry)")
                    # Не удаляем токен - возможно это временная проблема с API платформы
            else:
                logger.warning(f"❌ Token for {token.platform} has no access_token")
            
    except Exception as e:
        logger.error(f"❌ Error fetching integrations for user {user_id}: {e}")
        import traceback
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
    
    logger.info(f"🔍 Final integrations: {integrations}")
    logger.info(f"🔍 Final user_data: {user_data}")
    logger.info("=== AUTH STATUS REQUEST END ===")
    
    return {
        "authenticated": True,
        "is_guest": False,
        "integrations": integrations,
        "user": user_data
    }

# --- Health Check ---
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "bot_service"}

# --- Exception Handlers for Debugging ---
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Логируем все HTTP исключения для диагностики"""
    logger.warning(f"HTTP {exc.status_code}: {request.method} {request.url.path} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# --- API Routes ---
app.include_router(tts_router)
app.include_router(local_tts_router)
app.include_router(voices_router)
app.include_router(user_voices_router)
app.include_router(youtube_router)
app.include_router(drops_router)
app.include_router(moderation_router)
app.include_router(database_router)
app.include_router(commands_router)
app.include_router(points_router)
app.include_router(session_api_router)
app.include_router(vk_auth_router)
app.include_router(twitch_auth_router)
app.include_router(twitch_badges_router, prefix="/api/twitch", tags=["twitch-badges"])
app.include_router(vk_api_router)
app.include_router(da_auth_router)
app.include_router(widgets_router)
app.include_router(bot_control_router)
app.include_router(stream_info_router)
app.include_router(additional_router)
app.include_router(obs_integration_router)
app.include_router(system_router)
app.include_router(user_settings_router)
app.include_router(support_router)
app.include_router(chatbox_router)

# --- New API Routes ---
from api.admin_api import router as admin_router
from api.active_channels_api import router as active_channels_router
from api.stream_history_api import router as stream_history_router
from api.donationalerts_api import router as donationalerts_router
from api.guest_api import router as guest_router

app.include_router(admin_router)
app.include_router(active_channels_router)
app.include_router(stream_history_router)
app.include_router(donationalerts_router)
app.include_router(monitoring_router)
app.include_router(guest_router)

# --- Static Files for Widgets ---
# Добавляем статические файлы для виджетов
from fastapi.staticfiles import StaticFiles
from core.project_paths import FRONTEND_ROOT, TEMP_DIR

widgets_path = FRONTEND_ROOT / "src" / "widgets"
if widgets_path.exists():
    app.mount("/widgets", StaticFiles(directory=str(widgets_path)), name="widgets")

# Добавляем статические файлы для аудио (базовая TTS)
temp_audio_dir = TEMP_DIR / "tts_audio"
temp_audio_dir.mkdir(parents=True, exist_ok=True)
app.mount("/audio", StaticFiles(directory=str(temp_audio_dir)), name="audio")


if __name__ == "__main__":
    # Запускаем автоматическую очистку базы данных
    # TODO: Scheduled cleanup module needs to be implemented
    # try:
    #     from services.scheduled_cleanup import scheduled_cleanup_service
    #     scheduled_cleanup_service.start_scheduled_cleanup()
    # except Exception as e:
    #     logger.warning(f"Failed to start scheduled cleanup: {e}")
    
    import uvicorn
    # reload=True для автоматической перезагрузки при изменении кода (только для dev!)
    # Для production используйте reload=False
    import os
    is_dev = os.getenv('ENVIRONMENT', 'production') == 'development'
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=is_dev)
