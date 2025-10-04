# bot_service/main.py
import os
import asyncio
import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends, WebSocket, WebSocketDisconnect, HTTPException, Response, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import RedirectResponse
import uvicorn
from utils.rate_limiter import rate_limiter
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from pathlib import Path
import sys
from datetime import datetime, timedelta

# --- Logging Configuration ---
import sys
from pathlib import Path
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
# logging_config удален - используем стандартный logging
import logging

from core.database import get_db, init_db, User, GuestVerification, StreamData, UserSession, UserToken, BotCommand
from core.session_manager import session_manager
from models.pydantic_models import *
from core.connection_manager import get_connection_manager
from auth.auth import get_current_user, get_current_user_optional, get_admin_user, create_jwt_token
from bots.twitch_bot import Bot
from auth.oauth_handler import oauth_handler, OAuthUserData
from api.twitch_api import TwitchAPI
from api.vk_api import vk_api
from auth.vk_auth import router as vk_auth_router
from api.tts_api import TTSAPI
from api.youtube_api import YouTubeAPI
from services.admin_service import AdminAPI
from bots.vk_live_bot import VKLiveBot

# --- Logging and Monitoring Setup ---
log_level = os.getenv("LOG_LEVEL", "INFO")
logger = logging.getLogger(__name__)

# --- Monitoring API ---
from monitoring import bot_monitor

# Запускаем мониторинг
bot_monitor.start_monitoring(interval=60)  # Каждую минуту
logger.info("System monitoring started for bot_service")

# --- Backup System ---
from backup_manager import bot_backup_manager
from logging_config import bot_logging_config

# Запускаем систему бэкапов
bot_backup_manager.schedule_backups()
bot_backup_manager.start_scheduler()
logger.info("=== BOT SERVICE STARTED WITH ENHANCED LOGGING ===")

# Load .env file from bot_service directory
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path=dotenv_path)
else:
    logger.warning(f".env не найден в bot_service: {dotenv_path}")

logger.info("=== BOT SERVICE STARTED ===")

# --- Global Variables ---
connection_manager = get_connection_manager()
twitch_api = TwitchAPI(connection_manager)
tts_api = TTSAPI()
youtube_api = YouTubeAPI()
admin_api = AdminAPI()

bot_instance = None
bot_task = None
vk_live_bot_instance = None
vk_live_bot_task = None



# --- Helper Functions ---
def get_platform_username(user: dict, platform: str) -> str:
    """Получить имя пользователя для конкретной платформы"""
    integration = user.get("integrations", {}).get(platform)
    if integration:
        # Пробуем разные поля для получения имени пользователя (приоритет display_name)
        username = integration.get("display_name") or integration.get("username") or integration.get("platform_user_id")
        if username:
            return username
    return ""

# Реестр активных ботов по каналам (теперь в connection_manager)
# active_vk_bots = {}  # {channel_name: {"bot": VKLiveBot_instance, "task": asyncio.Task}}

async def cleanup_all_vk_bots():
    """Принудительная очистка всех активных VK ботов"""
    active_vk_bots = connection_manager.active_vk_bots
    logger.info(f"🧹 Cleaning up {len(active_vk_bots)} active VK bots...")
    for channel_name, bot_data in list(active_vk_bots.items()):
        try:
            bot = bot_data["bot"]
            task = bot_data.get("task")
            
            # Останавливаем бота
            await bot.stop_bot()
            
            # Отменяем задачу, если она существует
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
            
            logger.info(f"✅ Stopped VK bot for channel: {channel_name}")
        except Exception as e:
            logger.error(f"Error stopping VK bot for channel {channel_name}: {e}")
    active_vk_bots.clear()
    logger.info("🧹 All VK bots cleaned up")

# --- Helper Functions ---
async def _disconnect_user_bots(user_data: dict):
    """Отключает ботов от каналов пользователя при logout"""
    logger.info(f"Global bot_instance: {bot_instance is not None}")
    logger.info(f"Global vk_live_bot_instance: {vk_live_bot_instance is not None}")
    
    try:
        # Отключаем Twitch бота
        if bot_instance and user_data.get("integrations", {}).get("twitch"):
            twitch_username = user_data["integrations"]["twitch"].get("display_name")
            if twitch_username:
                success = await bot_instance.leave_channel(twitch_username)
                if success:
                    logger.info(f"Twitch bot disconnected from {twitch_username} on logout")
                else:
                    logger.warning(f"Failed to disconnect Twitch bot from {twitch_username} on logout")
        
        # Отключаем VK Live бота - используем реестр активных ботов
        if user_data.get("integrations", {}).get("vk"):
            logger.info("Attempting to disconnect VK Live bot...")
            # Получаем channel_url из VK API для правильного отключения
            from bot_disconnect import _get_vk_channel_url
            vk_channel = await _get_vk_channel_url(user_data["integrations"]["vk"], user_data["id"])
            logger.info(f"Retrieved VK channel: {vk_channel}")
            if vk_channel:
                active_vk_bots = connection_manager.active_vk_bots
                logger.info(f"🔍 Looking for active VK bot for channel: {vk_channel}")
                logger.info(f"📋 Current active VK bots registry: {list(active_vk_bots.keys())}")
                # Ищем активного бота для этого канала
                if vk_channel in active_vk_bots:
                    bot_data = active_vk_bots[vk_channel]
                    active_bot = bot_data["bot"]
                    task = bot_data.get("task")
                    
                    # Сначала отключаемся от канала
                    await active_bot.leave_channel(vk_channel)
                    # Затем полностью останавливаем бота
                    await active_bot.stop_bot()
                    
                    # Отменяем задачу, если она существует
                    if task and not task.done():
                        task.cancel()
                        try:
                            await task
                        except asyncio.CancelledError:
                            pass
                    
                    # Удаляем из реестра
                    del active_vk_bots[vk_channel]
                    logger.info(f"✅ VK Live bot disconnected and stopped for {vk_channel} on logout")
                else:
                    logger.warning(f"No active VK Live bot found for channel {vk_channel}")
            else:
                logger.warning("Could not get VK Live channel URL for bot disconnection")
        else:
            logger.warning("No VK integration found for user")
                    
    except Exception as e:
        logger.error(f"Error disconnecting user bots on logout: {e}")

# --- Background Tasks ---
async def collect_stream_stats():
    """Сбор статистики стримов для активных пользователей"""
    while True:
        await asyncio.sleep(60)  # Каждую минуту
        try:
            db = next(get_db())
            if not db:
                continue

            # Получаем всех пользователей, у которых есть токены (т.е. они авторизованы)
            from core.database import UserToken
            twitch_tokens = db.query(UserToken).filter(
                UserToken.platform == 'twitch',
                UserToken.access_token.isnot(None)
            ).all()
            vk_tokens = db.query(UserToken).filter(
                UserToken.platform == 'vk',
                UserToken.access_token.isnot(None)
            ).all()
            
            # Импортируем analytics service
            from services.analytics_service import AnalyticsService
            analytics_service = AnalyticsService()
            
            # Собираем статистику Twitch
            for token in twitch_tokens:
                try:
                    # Для Twitch используем display_name, для других платформ - platform_user_id
                    if token.platform == 'twitch':
                        username = token.platform_display_name
                    else:
                        username = token.platform_user_id or token.platform_display_name
                    
                    if not username:
                        continue
                        
                    stream_info = await twitch_api.get_stream_info(username)
                    
                    # Если стрим онлайн, сохраняем данные
                    if stream_info and stream_info.get('type') == 'live':
                        # Используем новый analytics service для записи с пиками
                        analytics_service.record_stream_data(
                            user_id=token.user_id,
                            platform='twitch',
                            viewer_count=stream_info.get('viewer_count', 0),
                            stream_id=stream_info.get('id'),
                            category_name=stream_info.get('game_name', ''),
                            title=stream_info.get('title', ''),
                            is_live=True,
                            db=db
                        )
                    else:
                        # Записываем оффлайн статус
                        analytics_service.record_stream_data(
                            user_id=token.user_id,
                            platform='twitch',
                            viewer_count=0,
                            is_live=False,
                            db=db
                        )
                except Exception as e:
                    logger.error(f"Error processing Twitch token {token.user_id}: {e}")
            
            # Собираем статистику VK Live
            for token in vk_tokens:
                try:
                    stream_info = await vk_api.get_stream_info(token.user_id)
                    
                    # Если стрим онлайн, сохраняем данные
                    if stream_info and stream_info.get('online'):
                        analytics_service.record_stream_data(
                            user_id=token.user_id,
                            platform='vk',
                            viewer_count=stream_info.get('viewer_count', 0),
                            stream_id=stream_info.get('stream_key', ''),
                            category_name=stream_info.get('category', ''),
                            title=stream_info.get('title', ''),
                            is_live=True,
                            db=db
                        )
                    else:
                        # Записываем оффлайн статус
                        analytics_service.record_stream_data(
                            user_id=token.user_id,
                            platform='vk',
                            viewer_count=0,
                            is_live=False,
                            db=db
                        )
                except Exception as e:
                    logger.error(f"Error processing VK token {token.user_id}: {e}")

        finally:
            if db:
                db.close()

async def background_cache_updater():
    """Обновление кэша в фоне"""
    while True:
        try:
            # Здесь должна быть логика обновления кэша
            await asyncio.sleep(300)  # Каждые 5 минут
        except Exception as e:
            logger.error(f"Error in background_cache_updater: {e}")
            await asyncio.sleep(300)

# --- Lifespan Events ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global bot_instance, bot_task
    
    # Startup
    logger.info("Bot service starting on port 8000")
    
    # Инициализация базы данных
    init_db()
    
    # Восстанавливаем активные сессии из базы данных при запуске
    logger.info("🔄 Restoring active sessions from database...")
    db = next(get_db())
    try:
        connection_manager.restore_active_sessions_from_db(db)
        
        # Получаем каналы для подключения
        active_channels = connection_manager.get_active_channels()
        twitch_channels = connection_manager.get_active_twitch_channels(db)
    finally:
        db.close()

    # Запускаем Twitch бота и подключаем только к Twitch каналам
    if active_channels:
        logger.info(f"🚀 Found active channels: {active_channels}")
        logger.info(f"🎮 Twitch channels to connect: {twitch_channels}")
        
        bot_token = os.getenv("TWITCH_BOT_TOKEN")
        if bot_token and twitch_channels:
            bot_instance = Bot(bot_token, twitch_channels, connection_manager)
            bot_task = asyncio.create_task(bot_instance.start_bot())
            logger.info("✅ Twitch bot started and connecting to Twitch channels.")
        elif bot_token:
            logger.info("📺 No Twitch channels found, but bot token available. Creating bot instance ready for connections.")
            bot_instance = Bot(bot_token, [], connection_manager)
            bot_task = asyncio.create_task(bot_instance.start_bot())
        else:
            logger.warning("⚠️ TWITCH_BOT_TOKEN not found. Twitch bot not started.")
    else:
        logger.info("No active channels found. Twitch bot will be started on demand.")
        # Создаем экземпляр бота без каналов, чтобы он был готов к подключениям
        bot_token = os.getenv("TWITCH_BOT_TOKEN")
        if bot_token:
            bot_instance = Bot(bot_token, [], connection_manager)
            bot_task = asyncio.create_task(bot_instance.start_bot())
            logger.info("✅ Twitch bot instance created and ready.")
        else:
            logger.warning("⚠️ TWITCH_BOT_TOKEN not found. Twitch bot cannot be created.")
    
    # Загружаем данные верификации из базы данных при старте
    try:
        db_gen = get_db()
        db = next(db_gen)
        try:
            verifications = db.query(GuestVerification).filter(
                GuestVerification.is_verified == True
            ).all()
            
            for verification in verifications:
                # Загружаем все верифицированные каналы без проверки таймаута
                # Активные сессии существуют до тех пор, пока не будут заменены новой верификацией
                if verification.verified_at:
                    # Загружаем данные из базы данных, но НЕ помечаем как verified в памяти
                    # Это позволяет требовать новую верификацию для новых сессий
                    connection_manager.pending_verifications[verification.channel_name] = {
                        "channel": verification.channel_name,
                        "code": verification.verification_code,
                        "timestamp": verification.verified_at.timestamp(),
                        "verified": False  # Всегда False для новых сессий
                    }
                    logger.info(f"Loaded verification from database for channel: {verification.channel_name}")
            
            db.commit()
            logger.info(f"Loaded {len(verifications)} verifications from database")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to load verifications from database: {e}")
    
    # Запуск фоновых задач
    asyncio.create_task(collect_stream_stats())
    asyncio.create_task(background_cache_updater())
    
    yield
    
    # Shutdown
    logger.info("Bot service stopping")
    
    # Очищаем все активные VK боты
    await cleanup_all_vk_bots()
    
    if bot_instance:
        await bot_instance.stop_bot()
    
    if bot_task:
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            pass

# --- Environment Variables ---
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")

# --- FastAPI App ---
app = FastAPI(lifespan=lifespan)

# --- Session Middleware (должен быть первым) ---
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SECRET_KEY", "your-secret-key")
)

# --- CORS Middleware (должен быть перед rate limiting) ---
allowed_origins = [origin.strip() for origin in CORS_ORIGINS.split(',')]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request Logging Middleware ---
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start_time = time.time()
    
    # Получаем информацию о пользователе из токена (если есть)
    user_info = "Anonymous"
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from auth.auth import decode_jwt_token
            token = auth_header.split(" ")[1]
            payload = decode_jwt_token(token)
            user_info = f"User:{payload.get('display_name', 'Unknown')}"
        except:
            user_info = "InvalidToken"
    
    # Обрабатываем preflight запросы
    origin = request.headers.get("origin")
    if request.method == "OPTIONS":
        response = Response()
        if origin and origin.startswith("http://localhost"):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRFToken"
            response.headers["Access-Control-Max-Age"] = "86400"
        return response
    
    response = await call_next(request)
    
    # Добавляем CORS заголовки если их нет
    if origin and origin.startswith("http://localhost"):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    
    # Логируем только важные запросы
    process_time = time.time() - start_time
    if should_log_request(request.url.path, response.status_code):
        log_message = f"🌐 {request.method} {request.url.path} | {user_info} | {response.status_code} | {process_time:.3f}s"
        
        # Используем специальный логгер для доступа
        access_logger = bot_logging_config.get_access_logger()
        if response.status_code >= 400:
            access_logger.error(log_message)
        else:
            access_logger.info(log_message)
    
    return response

def should_log_request(path: str, status_code: int) -> bool:
    """Определяет, нужно ли логировать запрос"""
    # Всегда логируем ошибки
    if status_code >= 400:
        return True
    
    # Логируем важные операции
    important_paths = [
        "/api/admin/",
        "/api/auth/",
        "/api/tts/",
        "/api/chat/",
        "/auth/twitch/",
        "/auth/vk/"
    ]
    
    # Не логируем частые статусные запросы
    skip_paths = [
        "/api/active-channels",
        "/api/chat/status",
        "/api/tts/status",
        "/api/admin/bots/status"
    ]
    
    for skip_path in skip_paths:
        if path.startswith(skip_path):
            return False
    
    for important_path in important_paths:
        if path.startswith(important_path):
            return True
    
    return False

# --- Rate Limiting Middleware ---
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Получаем IP адрес клиента
    client_ip = request.client.host
    
    # Проверяем rate limit для API endpoints
    if request.url.path.startswith("/api/"):
        # Увеличиваем лимиты для YouTube и TTS endpoints
        if any(path in request.url.path for path in ["/api/youtube/", "/api/tts/", "/api/voices/"]):
            max_requests = 200  # Больше запросов для медиа endpoints
        else:
            max_requests = 200   # Увеличенный лимит для всех API
        
        if not rate_limiter.is_allowed(client_ip, max_requests=max_requests, window_seconds=60):
            return Response(
                content="Too Many Requests",
                status_code=429,
                headers={"Retry-After": "60"}
            )
    
    response = await call_next(request)
    return response

# --- Include Routers ---
app.include_router(vk_auth_router)

# Import TTS router
from api.tts_api_endpoints import tts_router
app.include_router(tts_router)

# Import Voices router
from api.voices_api_endpoints import voices_router
app.include_router(voices_router)

# Import YouTube router
from api.youtube_api_endpoints import youtube_router
app.include_router(youtube_router)

# Import Lootbox router
from api.lootbox_api_endpoints import lootbox_router
app.include_router(lootbox_router, prefix="/lootbox", tags=["lootbox"])

# --- WebSocket Endpoints ---
@app.websocket("/ws/chat/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await connection_manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Обработка сообщений
    except WebSocketDisconnect:
        await connection_manager.disconnect(user_id)

@app.websocket("/ws/audio/{channel}")
async def websocket_audio_endpoint(websocket: WebSocket, channel: str):
    """WebSocket для отправки аудио в канал"""
    await connection_manager.connect_audio(websocket, channel)
    try:
        while True:
            data = await websocket.receive_text()
            # Обработка аудио сообщений
    except WebSocketDisconnect:
        await connection_manager.disconnect_audio(channel)

@app.websocket("/ws/obs/{token}")
async def websocket_obs_endpoint(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    await connection_manager.connect_obs(websocket, token)
    try:
        while True:
            data = await websocket.receive_text()
            # Обработка OBS сообщений
    except WebSocketDisconnect:
        await connection_manager.disconnect_obs(token)

@app.websocket("/ws/youtube-obs/{token}")
async def websocket_youtube_obs_endpoint(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    """WebSocket для YouTube OBS - отдельный от TTS"""
    await connection_manager.connect_youtube_obs(websocket, token)
    try:
        while True:
            data = await websocket.receive_text()
            logger.debug(f"YouTube OBS WebSocket received: {data}")
    except WebSocketDisconnect:
        await connection_manager.disconnect_youtube_obs(token)

# --- Auth Endpoints ---
@app.get("/auth/twitch")
async def login_twitch():
    client_id = os.getenv("TWITCH_CLIENT_ID")
    redirect_uri = "http://localhost:8000/auth/twitch/callback"
    scope = "user:read:email channel:manage:broadcast"
    
    auth_url = f"https://id.twitch.tv/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}"
    return RedirectResponse(url=auth_url)

@app.get("/auth/twitch/login")
async def api_login_twitch():
    """API endpoint для Twitch login (для совместимости с фронтендом)"""
    client_id = os.getenv("TWITCH_CLIENT_ID")
    redirect_uri = "http://localhost:8000/auth/twitch/callback"
    scope = "user:read:email channel:manage:broadcast"
    
    auth_url = f"https://id.twitch.tv/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}"
    return {"auth_url": auth_url}

@app.get("/api/auth/twitch")
async def api_auth_twitch():
    """API endpoint для Twitch auth (для совместимости с фронтендом)"""
    client_id = os.getenv("TWITCH_CLIENT_ID")
    redirect_uri = "http://localhost:8000/auth/twitch/callback"
    scope = "user:read:email channel:manage:broadcast"
    
    auth_url = f"https://id.twitch.tv/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}"
    return {"auth_url": auth_url}

async def auto_connect_twitch_bot(user_id: int):
    """Автоматически подключает Twitch бота к каналу пользователя после OAuth"""
    global bot_instance, bot_task
    
    try:
        logger.info(f"🤖 Auto-connecting Twitch bot for user {user_id}")
        
        # Получаем данные пользователя из базы
        db = next(get_db())
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.error(f"User {user_id} not found for auto-connect")
                return
            
            # Получаем Twitch токен пользователя
            twitch_token = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == "twitch"
            ).first()
            
            if not twitch_token:
                logger.error(f"No Twitch token found for user {user_id}")
                return
            
            # Получаем имя канала из токена
            channel_name = twitch_token.platform_display_name
            if not channel_name:
                logger.error(f"No channel name found for user {user_id}")
                return
            
            channel_name = channel_name.lower()
            logger.info(f"🎯 Auto-connecting Twitch bot to channel: {channel_name}")
            
            # ВСЕГДА пересоздаем бота с нужными каналами для надежности
            # TwitchIO лучше работает, когда каналы указаны при создании
            bot_token = os.getenv("TWITCH_BOT_TOKEN")
            if not bot_token:
                logger.error("⚠️ TWITCH_BOT_TOKEN not found for auto-connect")
                return
            
            # Останавливаем старый бот если он есть
            if bot_instance and bot_task:
                logger.info("🛑 Stopping existing bot to recreate with correct channels")
                try:
                    await bot_instance.close()
                    bot_task.cancel()
                except Exception as e:
                    logger.warning(f"Error stopping old bot: {e}")
            
            # Создаем новый бот с правильными каналами
            logger.info(f"🤖 Creating new Twitch bot instance for channel: {channel_name}")
            logger.info(f"🔧 Bot token: {bot_token[:10]}...")
            logger.info(f"🔧 Channels: {[channel_name]}")
            
            try:
                bot_instance = Bot(bot_token, [channel_name], connection_manager)
                logger.info(f"✅ Bot instance created successfully")
                
                logger.info(f"🚀 Starting bot task...")
                bot_task = asyncio.create_task(bot_instance.start_bot())
                logger.info(f"✅ Bot task created and started")
                
                # Ждем немного, чтобы бот успел подключиться
                logger.info(f"⏳ Waiting 3 seconds for bot to connect...")
                await asyncio.sleep(3)
                
                # Проверяем статус бота после подключения
                logger.info(f"🔍 Checking bot status after connection attempt...")
                logger.info(f"🔍 Bot instance exists: {bot_instance is not None}")
                logger.info(f"🔍 Bot task exists: {bot_task is not None}")
                logger.info(f"🔍 Bot task done: {bot_task.done() if bot_task else 'N/A'}")
                
                if bot_instance:
                    logger.info(f"🔍 Bot nick: {getattr(bot_instance, 'nick', 'Not set')}")
                    logger.info(f"🔍 Bot user_id: {getattr(bot_instance, 'user_id', 'Not set')}")
                    logger.info(f"🔍 Bot connected_channels: {getattr(bot_instance, 'connected_channels', 'Not set')}")
                
                logger.info(f"✅ Twitch bot should be connected to {channel_name}")
                
                # Попробуем отправить тестовое сообщение в лог
                logger.info(f"🧪 TEST: If you see this, logging from main.py works!")
                
            except Exception as bot_error:
                logger.error(f"❌ CRITICAL ERROR creating/starting bot: {bot_error}")
                logger.error(f"❌ Bot creation failed for channel: {channel_name}")
                import traceback
                logger.error(f"❌ Traceback: {traceback.format_exc()}")
                raise
                
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error in auto_connect_twitch_bot: {e}")

async def auto_connect_vk_live_bot(user_id: int):
    """Автоматически подключает VK Live бота к каналу пользователя после OAuth"""
    global vk_live_bot_instance, vk_live_bot_task
    
    try:
        logger.info(f"🤖 Auto-connecting VK Live bot for user {user_id}")
        
        # Получаем данные пользователя из базы
        db = next(get_db())
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.error(f"User {user_id} not found for auto-connect")
                return
            
            # Получаем VK токен пользователя
            vk_token = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == "vk"
            ).first()
            
            if not vk_token:
                logger.error(f"No VK token found for user {user_id}")
                return
            
            # Определяем корректный канал VK Live: предпочтительно используем channel_url из VK API
            channel_name = (vk_token.platform_display_name or "").strip()
            vk_access_token = vk_token.access_token
            channel_url = None
            try:
                if vk_access_token:
                    user_info = await vk_api._get_current_user_info(vk_access_token)
                    if user_info and user_info.get("channel") and user_info["channel"].get("url"):
                        channel_url = user_info["channel"]["url"]
            except Exception as e:
                logger.error(f"Failed to fetch VK channel_url via API for user {user_id}: {e}")

            # Выбираем то, что удалось получить: сначала channel_url, иначе display_name
            target_channel = (channel_url or channel_name).lower()
            if not target_channel:
                logger.error(f"No VK Live channel identifier (channel_url/display_name) found for user {user_id}")
                return

            logger.info(f"🎯 Auto-connecting VK Live bot to channel: {target_channel}")
            
            # Проверяем, есть ли уже активный бот для этого канала
            if target_channel in connection_manager.active_vk_bots:
                logger.info(f"VK Live bot already active for channel: {target_channel}, skipping auto-connect")
                return
            
            # Если бот уже существует, подключаем к новому каналу
            if vk_live_bot_instance:
                success = await vk_live_bot_instance.join_channel(target_channel)
                if success:
                    logger.info(f"✅ VK Live bot auto-connected to channel: {target_channel}")
                else:
                    logger.error(f"❌ Failed to auto-connect VK Live bot to channel: {target_channel}")
            else:
                # Если бот еще не создан, создаем его
                if not vk_access_token:
                    logger.error("⚠️ VK access token not found for auto-connect")
                    return
                    
                logger.info(f"🤖 Creating new VK Live bot instance for channel: {target_channel}")
                from bots.vk_live_bot import VKLiveBot
                vk_live_bot_instance = VKLiveBot(vk_access_token, connection_manager)
                vk_live_bot_task = asyncio.create_task(vk_live_bot_instance.start_bot())
                # Даем время инициализироваться chat_reader внутри бота
                await asyncio.sleep(2)
                
                # Подключаем к каналу
                success = await vk_live_bot_instance.join_channel(target_channel)
                if success:
                    logger.info(f"✅ VK Live bot started and connected to {target_channel}")
                else:
                    logger.error(f"❌ Failed to connect VK Live bot to {target_channel}")
                
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error in auto_connect_vk_live_bot: {e}")

@app.get("/auth/twitch/callback")
async def auth_twitch_callback(request: Request, code: str = None, error: str = None, state: str = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_optional)):
    """Callback для OAuth авторизации Twitch."""
    from constants import Platform
    from utils.error_handler import oauth_error, missing_code_error, api_error
    
    # Проверяем ошибки от Twitch
    if error:
        logger.warning(f"Twitch OAuth cancelled by user or failed: {error}")
        # Просто перенаправляем пользователя обратно в дашборд
        return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?auth_error=cancelled")
    
    if not code:
        raise missing_code_error(Platform.TWITCH)

    # Получаем токен и данные пользователя
    token_data = await twitch_api.get_user_access_token(code)
    if not token_data:
        raise api_error("get access token", Platform.TWITCH)
    
    user_data = await twitch_api.get_user_from_token(token_data["access_token"])
    if not user_data:
        raise api_error("get user data", Platform.TWITCH)

    # Создаем объект с данными пользователя
    oauth_user_data = OAuthUserData(
        platform_user_id=user_data["id"],
        platform_display_name=user_data["display_name"],
        avatar_url=user_data.get("profile_image_url"),
        access_token=token_data["access_token"],
        refresh_token=token_data.get("refresh_token"),
        expires_at=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600)),
        scopes=token_data.get("scope", [])
    )
    
    # Используем общий OAuth handler
    oauth_result = await oauth_handler.handle_oauth_callback(
        request=request,
        db=db,
        platform=Platform.TWITCH,
        user_data=oauth_user_data,
        current_user=current_user,
        auto_connect_bot=True
    )
    
    # Автоматически подключаем Twitch бота к чату пользователя
    if oauth_result.user and oauth_result.user.id:
        logger.info(f"🎯 Twitch OAuth successful, auto-connecting bot for user {oauth_result.user.id}")
        await auto_connect_twitch_bot(oauth_result.user.id)
    
    # Создаем ответ с редиректом
    return oauth_handler.create_oauth_response(oauth_result)

@app.post("/api/clear-verifications")
async def clear_verifications():
    """Очистить все pending verifications из памяти"""
    try:
        connection_manager.pending_verifications.clear()
        logger.info("🗑️ Cleared all pending verifications from memory")
        return {"success": True, "message": "Pending verifications cleared"}
    except Exception as e:
        logger.error(f"Error clearing verifications: {e}")
        return {"success": False, "message": str(e)}

@app.get("/api/bot/status")
async def get_bot_status():
    """Получить статус Twitch бота"""
    global bot_instance, bot_task
    
    try:
        status = {
            "bot_instance_exists": bot_instance is not None,
            "bot_task_exists": bot_task is not None,
            "bot_task_done": bot_task.done() if bot_task else None,
            "bot_connected_channels": [],
            "bot_nick": None,
            "bot_user_id": None
        }
        
        if bot_instance:
            status["bot_nick"] = getattr(bot_instance, 'nick', None)
            status["bot_user_id"] = getattr(bot_instance, 'user_id', None)
            status["bot_connected_channels"] = [ch.name for ch in getattr(bot_instance, 'connected_channels', [])]
            
        if bot_task and bot_task.done():
            try:
                exception = bot_task.exception()
                if exception:
                    status["bot_task_exception"] = str(exception)
            except:
                pass
        
        return status
    except Exception as e:
        logger.error(f"Error getting bot status: {e}")
        return {"error": str(e)}

@app.post("/auth/logout")
async def logout(request: Request, response: Response):
    
    # Завершаем сессию
    session_id = request.cookies.get("session_id")
    logger.info(f"Logout request received, session_id: {session_id}")
    if session_id:
        # Получаем данные пользователя перед завершением сессии
        logger.info(f"Validating session {session_id} before logout")
        user_data = session_manager.validate_session(session_id)
        logger.info(f"User data retrieved: {user_data is not None}")
        if user_data:
            logger.info(f"User data: {user_data}")
            user_id = user_data.get('user_id') or user_data.get('id')
            
            # Отключаем ботов от каналов пользователя
            await _disconnect_user_bots(user_data)
            logger.info(f"Disconnected bots for user {user_id} on logout")
            
            # УДАЛЯЕМ ВСЕ токены интеграций при logout для безопасности
            # Пользователь должен заново авторизоваться во всех сервисах после logout
            if user_id and user_id != -1:  # Не гостевой пользователь
                logger.info(f"🗑️ Clearing ALL integration tokens for user {user_id} on logout")
                session_manager.clear_all_user_tokens(user_id)
        else:
            logger.warning(f"Could not get user data for session {session_id} during logout")
        
        session_manager.terminate_session(session_id, "logout")
        response.delete_cookie("session_id")
        logger.info(f"Session {session_id} terminated")
    else:
        logger.warning("No session_id found in logout request")
    
    # Очищаем старую сессию
    request.session.clear()
    return {"message": "Logged out successfully"}

@app.post("/api/auth/logout")
async def api_logout(request: Request, response: Response):
    """API endpoint для logout (для совместимости с фронтендом)"""
    
    # Завершаем сессию
    session_id = request.cookies.get("session_id")
    logger.info(f"Logout request received, session_id: {session_id}")
    if session_id:
        # Получаем данные пользователя перед завершением сессии
        logger.info(f"Validating session {session_id} before logout")
        user_data = session_manager.validate_session(session_id)
        logger.info(f"User data retrieved: {user_data is not None}")
        if user_data:
            logger.info(f"User data: {user_data}")
            user_id = user_data.get('user_id') or user_data.get('id')
            
            # Отключаем ботов от каналов пользователя
            await _disconnect_user_bots(user_data)
            logger.info(f"Disconnected bots for user {user_id} on logout")
            
            # УДАЛЯЕМ ВСЕ токены интеграций при logout для безопасности
            # Пользователь должен заново авторизоваться во всех сервисах после logout
            if user_id and user_id != -1:  # Не гостевой пользователь
                logger.info(f"🗑️ Clearing ALL integration tokens for user {user_id} on logout")
                session_manager.clear_all_user_tokens(user_id)
        else:
            logger.warning(f"Could not get user data for session {session_id} during logout")
        
        session_manager.terminate_session(session_id, "logout")
        response.delete_cookie("session_id")
        logger.info(f"Session {session_id} terminated")
    else:
        logger.warning("No session_id found in logout request")
    
    # Очищаем старую сессию
    request.session.clear()
    return {"message": "Logged out successfully"}

@app.get("/api/auth/user/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return current_user

@app.post("/api/integrations/{platform}/disconnect")
async def disconnect_integration(platform: str, current_user: dict = Depends(get_current_user)):
    """Отключить интеграцию с конкретной платформой"""
    if platform not in ['twitch', 'vk']:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")
    
    user_id = current_user["id"]
    
    # Удаляем токены платформы
    success = session_manager.remove_platform_token(user_id, platform)
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to disconnect {platform} integration")
    
    logger.info(f"Integration {platform} disconnected for user {user_id}")
    
    return {"message": f"{platform.capitalize()} integration disconnected successfully"}

@app.get("/api/auth/status")
async def get_auth_status(request: Request, db: Session = Depends(get_db)):
    """Получить статус авторизации и интеграций с проверкой валидности токенов."""
    session_id = request.cookies.get("session_id")
    if not session_id:
        return {"authenticated": False}

    session_data = session_manager.validate_session(session_id)
    if not session_data:
        return {"authenticated": False, "integrations": {}}
    
    user_id = session_data.get("user_id", -1)
    if user_id == -1:
        return {"authenticated": True, "is_guest": True, "integrations": {}}
    
    integrations = {}
    tokens_to_delete = []
    try:
        user_tokens = db.query(UserToken).filter(UserToken.user_id == user_id).all()
        
        for token in user_tokens:
            is_valid = False
            user_info = None
            if token.platform == 'twitch':
                user_info = await twitch_api.get_user_from_token(token.access_token)
                is_valid = user_info is not None
            elif token.platform == 'vk':
                user_info = await vk_api._get_current_user_info(token.access_token)
                is_valid = user_info is not None

            if is_valid:
                integrations[token.platform] = {
                    "enabled": True,
                    "display_name": token.platform_display_name,
                    "avatar_url": token.avatar_url
                }
            else:
                logger.warning(f"Invalid '{token.platform}' token for user {user_id}. Marking for deletion.")
                tokens_to_delete.append(token)
        
        if tokens_to_delete:
            for token in tokens_to_delete:
                db.delete(token)
            db.commit()
            
    except Exception as e:
        logger.error(f"Error fetching/validating integrations for user {user_id}: {e}")
        db.rollback()
    
    return {
        "authenticated": True,
        "is_guest": False,
        "integrations": integrations,
        "user": {
            "id": user_id,
            "username": session_data.get("username", "unknown"),
            "display_name": session_data.get("display_name", "Unknown User"),
            "is_admin": session_data.get("is_admin", False)
        }
    }

@app.get("/api/auth/session/status")
async def get_session_status(request: Request):
    """Получить статус текущей сессии"""
    from auth.auth import get_session_data, get_active_platforms
    
    session_data = get_session_data(request)
    if not session_data:
        return {"authenticated": False}
    
    user_id = session_data.get("user_id", -1)
    
    return {
        "authenticated": True,
        "is_guest": user_id == -1,
        "platforms": get_active_platforms(request),
        "user": {
            "id": user_id,
            "username": session_data["username"],
            "display_name": session_data["display_name"],
            "is_admin": session_data["is_admin"]
        }
    }

# --- Bot Management Endpoints ---
@app.post("/api/chat/connect")
async def connect_bot(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    global bot_instance, bot_task
    
    if not bot_instance:
        # Создаем нового бота
        bot_token = os.getenv("TWITCH_BOT_TOKEN")
        if not bot_token:
            raise HTTPException(status_code=500, detail="TWITCH_BOT_TOKEN not configured")
        
        twitch_username = get_platform_username(user, "twitch")
        if not twitch_username:
            raise HTTPException(status_code=400, detail="Twitch integration not found")
        
        bot_instance = Bot(bot_token, [twitch_username], connection_manager)
        bot_task = asyncio.create_task(bot_instance.start_bot())
        
        # Ждем подключения
        await asyncio.sleep(2)
    
    # Проверяем, подключен ли бот уже к каналу
    if bot_instance.is_connected_to_channel(twitch_username):
        logger.info(f"Bot already connected to channel: {twitch_username}")
        success = True
    else:
        # Подключаемся к каналу (whitelist проверка только для TTS функций)
        success = await bot_instance.join_channel(twitch_username)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to connect to channel")
    
    return {"message": f"Bot connected to {twitch_username}"}

@app.post("/api/chat/disconnect")
async def disconnect_bot(user: dict = Depends(get_current_user)):
    global bot_instance
    
    if not bot_instance:
        raise HTTPException(status_code=400, detail="Bot not running")
    
    twitch_username = get_platform_username(user, "twitch")
    if not twitch_username:
        raise HTTPException(status_code=400, detail="Twitch integration not found")
    
    success = await bot_instance.leave_channel(twitch_username)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to disconnect from channel")
    
    return {"message": f"Bot disconnected from {twitch_username}"}

@app.get("/api/chat/status")
async def get_bot_status(user: dict = Depends(get_current_user)):
    if not bot_instance:
        return {"connected": False, "message": "Bot not running"}
    
    twitch_username = get_platform_username(user, "twitch")
    if not twitch_username:
        return {"connected": False, "message": "Twitch integration not found"}
    
    is_connected = bot_instance.is_connected_to_channel(twitch_username)
    return {"connected": is_connected, "message": f"Bot {'connected' if is_connected else 'not connected'} to {twitch_username}"}

@app.post("/api/chat/reconnect")
async def reconnect_bot(user: dict = Depends(get_current_user)):
    """Принудительное переподключение к каналу"""
    global bot_instance
    
    if not bot_instance:
        raise HTTPException(status_code=400, detail="Bot not running")
    
    twitch_username = get_platform_username(user, "twitch")
    if not twitch_username:
        raise HTTPException(status_code=400, detail="Twitch integration not found")
    
    # Проверяем, подключен ли бот уже к каналу
    if bot_instance.is_connected_to_channel(twitch_username):
        logger.info(f"Bot already connected to channel: {twitch_username}, skipping reconnect")
        success = True
    else:
        # Сначала отключаемся
        await bot_instance.leave_channel(twitch_username)
        await asyncio.sleep(1)
        
        # Затем подключаемся заново
        success = await bot_instance.join_channel(twitch_username)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to reconnect to channel")
    
    return {"message": f"Bot reconnected to {twitch_username}"}

# --- Guest Bot Endpoints ---
@app.post("/api/chat/guest/reconnect")
async def reconnect_bot_guest(request: Request, db: Session = Depends(get_db)):
    """Переподключение к уже верифицированному каналу (для перезагрузки страницы)"""
    data = await request.json()
    channel_name = data.get("channel_name", "").lower()
    
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name required")
    
    # Проверяем, верифицирован ли канал (сначала в памяти, потом в БД)
    if connection_manager.is_verified(channel_name):
        # Дополнительная проверка: верификация должна быть недавней (в течение 5 минут)
        # Это предотвращает использование /reconnect с других устройств
        try:
            verification = db.query(GuestVerification).filter(
                GuestVerification.channel_name == channel_name,
                GuestVerification.is_verified == True
            ).first()
            
            if verification and verification.verified_at:
                # Канал верифицирован, разрешаем переподключение без проверки таймаута
                # Активные сессии существуют до тех пор, пока не будут заменены новой верификацией
                logger.info(f"Channel {channel_name} is verified, allowing reconnection")
                
                # Канал верифицирован и недавно, разрешаем переподключение
                logger.info(f"Reconnecting to verified channel: {channel_name}")
                return {
                    "message": f"Reconnected to {channel_name}",
                    "verification_required": False,
                    "verified": True
                }
            else:
                raise HTTPException(status_code=400, detail="Verification check failed")
                
        except Exception as e:
            logger.error(f"Error checking verification: {e}")
            raise HTTPException(status_code=400, detail="Verification check failed")
    
    # Если канал не верифицирован, возвращаем ошибку
    raise HTTPException(status_code=400, detail="Channel not verified")

@app.post("/api/chat/guest/connect")
async def connect_bot_guest(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    channel_name = data.get("channel_name", "").lower()
    platform = data.get("platform", "twitch")  # По умолчанию Twitch
    
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name required")
    
    # Если это VK Live, используем специальный эндпоинт
    if platform == "vk" or platform == "vk_live":
        return await connect_vk_live_bot_guest(request, db)
    
    # Проверяем, верифицирован ли канал (сначала в памяти, потом в БД)
    if connection_manager.is_verified(channel_name):
        logger.info(f"Guest reconnecting to already verified channel: {channel_name}")
        # Логика для уже верифицированных каналов (повторное подключение)
        return {
            "message": f"Reconnected to {channel_name}",
            "verification_required": False,
            "verified": True
        }
    
    # --- ИСПРАВЛЕНО: Логика генерации нового кода верификации ---
    logger.info(f"New guest connection for Twitch channel: {channel_name}. Generating verification code.")
    
    # Генерируем новый код верификации
    import secrets
    import time
    verification_code = secrets.token_urlsafe(8)
    
    verification_data = {
        "channel": channel_name,
        "code": verification_code,
        "timestamp": time.time(),
        "verified": False,
        "platform": "twitch"
    }
    
    # Сохраняем в connection_manager для доступа из бота
    connection_manager.pending_verifications[channel_name] = verification_data
    
    # Отправляем боту команду с кодом верификации
    global bot_instance
    if bot_instance:
        await bot_instance.join_channel(channel_name)
        # Отправляем сообщение в чат после небольшой задержки
        async def send_verification_message():
            await asyncio.sleep(2)
            try:
                # Получаем канал и отправляем сообщение
                channel = bot_instance.get_channel(channel_name)
                if channel:
                    await channel.send(f"Код верификации для TTS.TTB: {verification_code}")
                    logger.info(f"✅ Sent verification code to channel {channel_name}")
                else:
                    logger.error(f"❌ Channel {channel_name} not found for sending message")
            except Exception as e:
                logger.error(f"❌ Error sending verification message: {e}")
        asyncio.create_task(send_verification_message())
    
    logger.info(f"Generated verification code for {channel_name}: {verification_code}")
    
    return {
        "message": f"Verification required for {channel_name}",
        "verification_required": True,
        "verification_code": verification_code,
        "timeout": 120 # 2 минуты на верификацию
    }

@app.post("/api/chat/guest/disconnect")
async def disconnect_bot_guest(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    channel_name = data.get("channel_name", "").lower()
    
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name required")
    
    global bot_instance
    if not bot_instance:
        raise HTTPException(status_code=400, detail="Bot not running")
    
    success = await bot_instance.leave_channel(channel_name)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to disconnect from channel")
    
    # Очищаем данные верификации из connection_manager
    if channel_name in connection_manager.pending_verifications:
        del connection_manager.pending_verifications[channel_name]
        logger.info(f"Cleared verification data for channel: {channel_name}")
    
    return {"message": f"Bot disconnected from {channel_name}"}

@app.get("/api/chat/guest/status")
async def get_bot_status_guest(channel_name: str, db: Session = Depends(get_db)):
    channel_name = channel_name.lower()
    
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name required")
    
    global bot_instance
    if not bot_instance:
        return {"connected": False, "is_whitelisted": False, "verified": False}
    
    is_connected = bot_instance.is_connected_to_channel(channel_name)
    is_verified = connection_manager.is_verified(channel_name)
    
    return {
        "connected": is_connected,
        "verified": is_verified
    }

# --- VK Live Guest Bot Endpoints ---
@app.post("/api/chat/vk/guest/connect")
async def connect_vk_live_bot_guest(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    channel_name = data.get("channel_name", "").lower()
    
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name required")
    
    # Подключаемся к каналу VK Live
    logger.info(f"Attempting to join VK Live channel: {channel_name}")
    
    # Проверяем, есть ли уже активный бот для этого канала
    if channel_name in connection_manager.active_vk_bots:
        logger.info(f"VK Live bot already active for channel: {channel_name}")
        success = True
    elif vk_live_bot_instance and vk_live_bot_instance.is_connected_to_channel(channel_name):
        logger.info(f"Global VK Live bot already connected to channel: {channel_name}")
        success = True
    else:
        # Создаем новый бот для гостевого режима
        vk_user_token = os.getenv("VK_LIVE_USER_TOKEN")
        if not vk_user_token:
            raise HTTPException(status_code=500, detail="VK_LIVE_USER_TOKEN not configured. Use a regular VK Live user access token.")
        
        logger.info("Creating new VK Live bot instance for guest mode...")
        vk_live_bot = VKLiveBot(vk_user_token, connection_manager)
        
        # Запускаем бота
        bot_task = asyncio.create_task(vk_live_bot.start_bot())
        await asyncio.sleep(2)
        
        # Регистрируем бота в глобальном реестре
        connection_manager.active_vk_bots[channel_name] = {
            "bot": vk_live_bot,
            "task": bot_task
        }
        
        success = await vk_live_bot.join_channel(channel_name)
    if not success:
        logger.error(f"Failed to connect to VK Live channel: {channel_name}")
        raise HTTPException(status_code=500, detail="Failed to connect to VK Live channel")
    
    # Проверяем, верифицирован ли канал (сначала в памяти, потом в БД) - как в Twitch логике
    if connection_manager.is_verified(channel_name):
        # Дополнительная проверка: верификация должна быть недавней (в течение 5 минут)
        # Это предотвращает использование /reconnect с других устройств
        try:
            verification = db.query(GuestVerification).filter(
                GuestVerification.channel_name == channel_name,
                GuestVerification.is_verified == True
            ).first()
            
            if verification and verification.verified_at:
                # Канал верифицирован, разрешаем переподключение без проверки таймаута
                # Активные сессии существуют до тех пор, пока не будут заменены новой верификацией
                logger.info(f"VK Live channel {channel_name} is verified, allowing reconnection")
                
                # Канал верифицирован и недавно, разрешаем переподключение
                logger.info(f"Reconnecting to verified VK Live channel: {channel_name}")
                return {
                    "message": f"VK Live bot reconnected to {channel_name}",
                    "verification_required": False,
                    "verified": True,
                    "platform": "vk_live"
                }
            else:
                raise HTTPException(status_code=400, detail="VK Live verification check failed")
                
        except Exception as e:
            logger.error(f"Error checking VK Live verification: {e}")
            raise HTTPException(status_code=400, detail="VK Live verification check failed")
    
    # Если канал не верифицирован, продолжаем с созданием новой верификации
    
    # Проверяем конфликт сессий - если есть активная авторизованная сессия для этого канала
    try:
        # Проверяем, есть ли активные авторизованные сессии для этого канала
        active_sessions = db.query(UserSession).filter(
            UserSession.user_id != -1,  # Не гостевые сессии
            UserSession.is_active == True
        ).all()
        
        # Проверяем, есть ли конфликт с авторизованными пользователями
        for session in active_sessions:
            if session.device_info and session.device_info.get("guest_channel") == channel_name:
                logger.warning(f"Session conflict detected: authorized user using channel {channel_name}")
                return {
                    "message": f"Channel {channel_name} is already in use by an authorized user",
                    "conflict": True,
                    "verification_required": False,
                    "verified": False,
                    "platform": "vk_live"
                }
    except Exception as e:
        logger.error(f"Error checking session conflicts: {e}")
    
    # Генерируем новый код верификации
    import secrets
    verification_code = secrets.token_urlsafe(8)
    
    # Сохраняем код верификации в connection_manager для доступа из бота
    verification_data = {
        "channel": channel_name,
        "code": verification_code,
        "timestamp": time.time(),
        "verified": False,
        "platform": "vk_live"  # Отмечаем, что это VK Live верификация
    }
    
    # Сохраняем в connection_manager для доступа из бота
    connection_manager.pending_verifications[channel_name] = verification_data
    
    logger.info(f"Successfully connected to VK Live channel: {channel_name}, verification code: {verification_code}")
    return {
        "message": f"VK Live bot connected to {channel_name}",
        "verification_required": True,
        "verification_code": verification_code,
        "timeout": 60,
        "platform": "vk_live"
    }

@app.post("/api/chat/vk/guest/disconnect")
async def disconnect_vk_live_bot_guest(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    channel_name = data.get("channel_name", "").lower()
    
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name required")
    
    # Проверяем, есть ли активный бот для этого канала
    if channel_name not in connection_manager.active_vk_bots:
        logger.warning(f"No active VK Live bot found for channel: {channel_name}")
        return {"message": f"No active VK Live bot for {channel_name}"}
    
    # Получаем бота из connection_manager
    bot_data = connection_manager.active_vk_bots[channel_name]
    vk_live_bot = bot_data["bot"]
    
    # Отключаемся от канала
    success = await vk_live_bot.leave_channel(channel_name)
    if not success:
        logger.warning(f"Failed to leave VK Live channel: {channel_name}")
    
    # Останавливаем бота
    try:
        await vk_live_bot.stop_bot()
    except Exception as e:
        logger.error(f"Error stopping VK Live bot: {e}")
    
    # Удаляем бота из активных
    del connection_manager.active_vk_bots[channel_name]
    
    # Очищаем данные верификации из connection_manager
    if channel_name in connection_manager.pending_verifications:
        del connection_manager.pending_verifications[channel_name]
        logger.info(f"Cleared VK Live verification data for channel: {channel_name}")
    
    logger.info(f"VK Live bot disconnected from {channel_name}")
    return {"message": f"VK Live bot disconnected from {channel_name}"}

@app.get("/api/chat/vk/guest/status")
async def get_vk_live_bot_status_guest(channel_name: str, db: Session = Depends(get_db)):
    channel_name = channel_name.lower()
    
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name required")
    
    # Проверяем, есть ли активный бот для этого канала
    if channel_name not in connection_manager.active_vk_bots:
        return {"connected": False, "verified": False, "platform": "vk_live"}
    
    # Получаем бота из connection_manager
    bot_data = connection_manager.active_vk_bots[channel_name]
    vk_live_bot = bot_data["bot"]
    
    is_connected = vk_live_bot.is_connected_to_channel(channel_name)
    is_verified = connection_manager.is_verified(channel_name)
    
    return {
        "connected": is_connected,
        "verified": is_verified,
        "platform": "vk_live"
    }

@app.get("/api/chat/vk/guest/check-blocked")
async def check_vk_live_channel_blocked(channel_name: str, db: Session = Depends(get_db)):
    """Проверка, заблокирован ли канал VK Live для гостевого режима"""
    channel_name = channel_name.lower()
    
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name required")
    
    # Для VK Live пока всегда разрешаем гостевой режим
    # В будущем можно добавить логику блокировки
    return {"blocked": False, "platform": "vk_live"}

# --- Twitch API Endpoints ---
@app.get("/api/twitch/stream")
async def get_stream_info(user: dict = Depends(get_current_user)):
    twitch_integration = user.get("integrations", {}).get("twitch")
    if not twitch_integration:
        return {"online": False}
    
    twitch_username = twitch_integration.get("display_name")
    if not twitch_username:
        return {"online": False}
    
    stream_info = await twitch_api.get_stream_info(twitch_username)
    return stream_info or {"online": False}

@app.get("/api/twitch/stream-info")
async def get_stream_info_detailed(user: dict = Depends(get_current_user), force: bool = False):
    """Получить детальную информацию о стриме"""
    twitch_integration = user.get("integrations", {}).get("twitch")
    if not twitch_integration:
        raise HTTPException(status_code=400, detail="Twitch integration not found for this user.")
    
    twitch_username = twitch_integration.get("display_name")
    
    # Проверяем кэш, если не принудительное обновление
    if not force:
        cache_key = f"stream_info_{twitch_username}"
        cached = connection_manager.get_twitch_cache(cache_key)
        if cached:
            logger.info(f"Using cached stream info for {twitch_username}")
            return cached
    else:
        logger.info(f"Force refreshing stream info for {twitch_username}")
    
    stream_info = await twitch_api.get_stream_info(twitch_username)
    
    # Если стрим офлайн, получаем информацию о канале
    if not stream_info:
        channel_info = await twitch_api.get_channel_info(twitch_username)
        if channel_info:
            category_info = None
            if channel_info.get("game_id"):
                category_info = await twitch_api.get_category_info(channel_info["game_id"])

            result = {
                "online": False,
                "title": channel_info.get("title", ""),
                "game_id": channel_info.get("game_id", ""),
                "game": channel_info.get("game_name", ""),
                "viewer_count": 0,
                "started_at": "",
                "category_info": category_info
            }
        else:
            result = {"online": False}
    else:
        # Получаем дополнительную информацию о категории
        category_info = None
        if stream_info.get("game_id"):
            category_info = await twitch_api.get_category_info(stream_info["game_id"])
        
        result = {
            "online": True,
            "title": stream_info.get("title", ""),
            "game_id": stream_info.get("game_id", ""),
            "game": stream_info.get("game_name", ""),
            "viewer_count": stream_info.get("viewer_count", 0),
            "started_at": stream_info.get("started_at", ""),
            "category_info": category_info
        }
    
    # Кэшируем результат на 30 секунд
    cache_key = f"stream_info_{twitch_username}"
    connection_manager.update_twitch_cache(cache_key, result)
    
    logger.info(f"Stream info for {twitch_username}: {result}")
    return result

@app.get("/api/twitch/categories")
async def get_categories(search: str, user: dict = Depends(get_current_user)):
    categories = await twitch_api.search_categories(search)
    return categories  # Возвращаем массив напрямую

@app.post("/api/twitch/title")
async def update_stream_title(request: UpdateTitleRequest, user: dict = Depends(get_current_user)):
    success = await twitch_api.update_stream_title(user["id"], request.title)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update title")
    return {"message": "Title updated successfully"}

@app.post("/api/twitch/stream/title")
async def update_stream_title_alt(request: UpdateTitleRequest, user: dict = Depends(get_current_user)):
    """Альтернативный endpoint для обновления названия стрима"""
    success = await twitch_api.update_stream_title(user["id"], request.title)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update title")
    return {"success": True, "message": "Title updated successfully"}

@app.post("/api/twitch/category")
async def update_stream_category(request: UpdateCategoryRequest, user: dict = Depends(get_current_user)):
    logger.info(f"Update category request: {request}")
    logger.info(f"CategoryId: {request.categoryId}")
    logger.info(f"User ID: {user['id']}")
    
    success = await twitch_api.update_stream_category(user["id"], request.categoryId)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update category")
    return {"success": True, "message": "Category updated successfully"}

@app.get("/api/stream/history")
async def get_stream_history(
    hours_back: int = 24,
    user: dict = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Получить историю стрима с аналитикой"""
    from services.analytics_service import AnalyticsService
    
    analytics_service = AnalyticsService()
    
    # Получаем полную аналитику стрима
    analytics = analytics_service.get_stream_analytics(user["id"], hours_back, db)
    
    # Получаем информацию о пиках
    peak_info = analytics_service.get_analytics_message(user["id"], db=db)
    
    # Получаем статистику по категориям
    category_analytics = analytics_service.get_category_analytics(user["id"], db=db)

    return {
        "history": analytics.get('all_data', []),
        "data": analytics.get('data', []),
        "twitch_history": analytics.get('twitch_data', []),
        "vk_history": analytics.get('vk_data', []),
        "current_viewers": 0,  # Будет обновлено в real-time
        "peak_viewers": analytics.get('peak_viewers', 0),
        "avg_viewers": analytics.get('avg_viewers', 0),
        "categories": analytics.get('categories', []),
        "peak_info": peak_info,
        "category_analytics": category_analytics,
        "status": "offline"  # Будет обновлено в real-time
    }

# --- VK Live API Endpoints ---
@app.get("/api/vk/stream-info")
async def get_vk_stream_info(user: dict = Depends(get_current_user), force: bool = False):
    """Получить информацию о стриме VK Live"""
    try:
        user_id = user["id"]
        logger.info(f"VK stream info request for user {user_id}, force={force}")
        
        logger.info(f"Getting VK stream info for user {user_id}")
        
        stream_info = await vk_api.get_stream_info(user_id)
        if not stream_info:
            logger.info(f"No VK stream info found for user {user_id}, returning default")
            stream_info = {"online": False, "viewer_count": 0}
        
        logger.info(f"Returning VK stream info for user {user_id}: {stream_info}")
        return stream_info
        
    except Exception as e:
        logger.error(f"Error in get_vk_stream_info for user {user.get('id', 'unknown')}: {e}")
        logger.error(f"Exception details: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error getting VK stream info: {str(e)}")

@app.get("/api/vk/viewers")
async def get_vk_viewers(user: dict = Depends(get_current_user)):
    """Получить количество зрителей VK Live"""
    viewer_count = await vk_api.get_viewer_count(user["id"])
    return {"viewer_count": viewer_count}

@app.post("/api/vk/update-title")
async def update_vk_stream_title(request: UpdateTitleRequest, user: dict = Depends(get_current_user)):
    """Обновить название стрима VK Live"""
    logger.info(f"Received VK title update request for user {user['id']}. Payload: {request.model_dump()}")

    if not request.title or not request.title.strip():
        logger.warning(f"Validation failed: Title is empty for user {user['id']}")
        raise HTTPException(status_code=400, detail="Title cannot be empty")
        
    success = await vk_api.update_stream_title(user["id"], request.title)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update VK Live title")
    return {"success": True, "message": "VK Live title updated successfully"}

@app.get("/api/vk/categories")
async def get_vk_categories(search: str = "", user: dict = Depends(get_current_user)):
    """Получить категории VK Live"""
    categories = await vk_api.search_categories(search, user["id"])
    return {"data": categories or []}

@app.post("/api/vk/update-category")
async def update_vk_stream_category(request: UpdateCategoryRequest, user: dict = Depends(get_current_user)):
    """Обновить категорию стрима VK Live"""
    success = await vk_api.update_stream_category(user["id"], request.categoryId)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update VK Live category")
    return {"success": True, "message": "VK Live category updated successfully"}

# --- Unified Stream Management ---
@app.post("/api/stream/update")
async def update_stream(request: StreamUpdateRequest, user: dict = Depends(get_current_user)):
    """Unified endpoint to update stream title and category for multiple platforms."""
    logger.info(f"Received unified stream update for user {user['id']}: {request.model_dump()}")
    
    success_flags = []
    error_messages = []

    # --- Update Twitch ---
    if request.twitch and user.get("integrations", {}).get("twitch"):
        twitch_user_id = user["id"]  # Use unified user ID from our database, not platform_user_id
        platform_user_id = user["integrations"]["twitch"].get("platform_user_id")
        if platform_user_id:
            if request.twitch.title is not None:
                logger.info(f"Updating Twitch title for unified user {twitch_user_id} (platform user {platform_user_id}) to: {request.twitch.title}")
                success = await twitch_api.update_stream_title(twitch_user_id, request.twitch.title)
                success_flags.append(success)
                if not success:
                    error_messages.append("Failed to update Twitch title.")
            
            if request.twitch.category_id is not None:
                logger.info(f"Updating Twitch category for unified user {twitch_user_id} (platform user {platform_user_id}) to: {request.twitch.category_id}")
                success = await twitch_api.update_stream_category(twitch_user_id, request.twitch.category_id)
                success_flags.append(success)
                if not success:
                    error_messages.append("Failed to update Twitch category.")

    # --- Update VK Live ---
    if request.vk and user.get("integrations", {}).get("vk"):
        vk_user_id = user["id"] # VK uses the main user ID
        if vk_user_id:
            if request.vk.title is not None:
                logger.info(f"Updating VK Live title for user {vk_user_id} to: {request.vk.title}")
                success = await vk_api.update_stream_title(vk_user_id, request.vk.title)
                success_flags.append(success)
                if not success:
                    error_messages.append("Failed to update VK Live title.")
            
            if request.vk.category_id is not None:
                logger.info(f"Updating VK Live category for user {vk_user_id} to: {request.vk.category_id}")
                success = await vk_api.update_stream_category(vk_user_id, request.vk.category_id)
                success_flags.append(success)
                if not success:
                    error_messages.append("Failed to update VK Live category.")

    if not success_flags:
        raise HTTPException(status_code=400, detail="No valid update data provided for any active integration.")

    if all(success_flags):
        return {"success": True, "message": "Stream updated successfully."}
    else:
        # Return a 207 Multi-Status if some updates failed
        raise HTTPException(status_code=207, detail={"message": "Some updates failed.", "errors": error_messages})

# --- TTS Endpoints ---
@app.post("/api/tts/youtube-settings")
async def set_youtube_settings(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Установить настройки YouTube (режим воспроизведения: browser/obs)"""
    data = await request.json()
    playback_mode = data.get("playback_mode", "browser")  # browser или obs
    volume_level = data.get("volume_level", 50.0)
    
    try:
        from core.database import TTSSettings
        
        twitch_username = get_platform_username(user, "twitch")
        if not twitch_username:
            raise HTTPException(status_code=400, detail="No Twitch integration found")
        
        # Сохраняем в ConnectionManager для текущей сессии
        connection_manager.set_youtube_settings(twitch_username, playback_mode, volume_level)
        
        # Сохраняем в базу данных
        tts_settings = db.query(TTSSettings).filter(
            TTSSettings.user_id == user['id'],
            TTSSettings.channel_name == twitch_username
        ).first()
        
        if not tts_settings:
            tts_settings = TTSSettings(
                user_id=user['id'],
                channel_name=twitch_username,
                voice_settings={"youtube_playback_mode": playback_mode, "youtube_volume": volume_level}
            )
            db.add(tts_settings)
        else:
            voice_settings = tts_settings.voice_settings or {}
            voice_settings.update({"youtube_playback_mode": playback_mode, "youtube_volume": volume_level})
            tts_settings.voice_settings = voice_settings
        
        db.commit()
        
        logger.info(f"YouTube settings saved for {twitch_username}: {playback_mode} mode, volume {volume_level}%")
        return {"success": True, "playback_mode": playback_mode, "volume_level": volume_level}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving YouTube settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to save YouTube settings")

@app.get("/api/tts/youtube-settings")
async def get_youtube_settings(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить настройки YouTube для пользователя"""
    try:
        from core.database import TTSSettings
        
        twitch_username = get_platform_username(user, "twitch")
        if not twitch_username:
            return {"playback_mode": "browser", "volume_level": 50.0}
        
        tts_settings = db.query(TTSSettings).filter(
            TTSSettings.user_id == user['id'],
            TTSSettings.channel_name == twitch_username
        ).first()
        
        if tts_settings and tts_settings.voice_settings:
            voice_settings = tts_settings.voice_settings
            playback_mode = voice_settings.get("youtube_playback_mode", "browser")
            volume_level = voice_settings.get("youtube_volume", 50.0)
            
            # Синхронизируем с ConnectionManager
            connection_manager.set_youtube_settings(twitch_username, playback_mode, volume_level)
            
            return {"playback_mode": playback_mode, "volume_level": volume_level}
        
        return {"playback_mode": "browser", "volume_level": 50.0}
        
    except Exception as e:
        logger.error(f"Error loading YouTube settings: {e}")
        return {"playback_mode": "browser", "volume_level": 50.0}

@app.post("/api/tts/voice-volume")
async def set_voice_volume(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Установить индивидуальную громкость для кастомного голоса (приоритет выше общей)"""
    data = await request.json()
    voice_name = data.get("voice_name")
    volume_level = data.get("volume_level", 50.0)
    
    if not voice_name:
        raise HTTPException(status_code=400, detail="Voice name required")
    
    # Ограничиваем значение от 0 до 100
    volume_level = max(0.0, min(100.0, float(volume_level)))
    
    try:
        from core.database import TTSSettings
        
        twitch_username = get_platform_username(user, "twitch")
        if not twitch_username:
            raise HTTPException(status_code=400, detail="No Twitch integration found")
        
        # Сохраняем в ConnectionManager для текущей сессии
        connection_manager.set_voice_volume(twitch_username, voice_name, volume_level)
        
        # Сохраняем в базу данных
        tts_settings = db.query(TTSSettings).filter(
            TTSSettings.user_id == user['id'],
            TTSSettings.channel_name == twitch_username
        ).first()
        
        if not tts_settings:
            tts_settings = TTSSettings(
                user_id=user['id'],
                channel_name=twitch_username,
                voice_settings={"custom_voice_volumes": {voice_name: volume_level}}
            )
            db.add(tts_settings)
        else:
            voice_settings = tts_settings.voice_settings or {}
            custom_volumes = voice_settings.get("custom_voice_volumes", {})
            custom_volumes[voice_name] = volume_level
            voice_settings["custom_voice_volumes"] = custom_volumes
            tts_settings.voice_settings = voice_settings
        
        db.commit()
        
        logger.info(f"Custom voice volume saved for {twitch_username}: {voice_name} = {volume_level}%")
        return {"success": True, "voice_name": voice_name, "volume_level": volume_level}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving voice volume: {e}")
        raise HTTPException(status_code=500, detail="Failed to save voice volume")

@app.get("/api/tts/voice-volume/{voice_name}")
async def get_voice_volume(voice_name: str, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить индивидуальную громкость для кастомного голоса"""
    try:
        from core.database import TTSSettings
        
        twitch_username = get_platform_username(user, "twitch")
        if not twitch_username:
            return {"volume_level": 50.0}
        
        tts_settings = db.query(TTSSettings).filter(
            TTSSettings.user_id == user['id'],
            TTSSettings.channel_name == twitch_username
        ).first()
        
        if tts_settings and tts_settings.voice_settings:
            custom_volumes = tts_settings.voice_settings.get("custom_voice_volumes", {})
            volume_level = custom_volumes.get(voice_name, 50.0)
            
            # Синхронизируем с ConnectionManager
            connection_manager.set_voice_volume(twitch_username, voice_name, volume_level)
            
            return {"volume_level": volume_level}
        
        return {"volume_level": 50.0}
        
    except Exception as e:
        logger.error(f"Error loading voice volume: {e}")
        return {"volume_level": 50.0}

@app.post("/api/tts/volume")
async def set_tts_volume(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Установить общую громкость TTS для пользователя (сохраняется в БД и памяти)"""
    data = await request.json()
    volume_level = data.get("volume_level", 50.0)
    listening_mode = data.get("listening_mode", "website")  # website или obs
    
    # Ограничиваем значение от 0 до 100
    volume_level = max(0.0, min(100.0, float(volume_level)))
    
    try:
        from core.database import TTSSettings
        import json
        
        # Получаем канал пользователя (Twitch или VK)
        twitch_username = get_platform_username(user, "twitch")
        if not twitch_username:
            raise HTTPException(status_code=400, detail="No Twitch integration found")
        
        # Сохраняем в ConnectionManager для текущей сессии
        connection_manager.set_tts_volume(twitch_username, volume_level)
        
        # Сохраняем в базу данных для постоянного хранения
        tts_settings = db.query(TTSSettings).filter(
            TTSSettings.user_id == user['id'],
            TTSSettings.channel_name == twitch_username
        ).first()
        
        if not tts_settings:
            # Создаем новую запись
            tts_settings = TTSSettings(
                user_id=user['id'],
                channel_name=twitch_username,
                voice_settings={"volume_level": volume_level, "listening_mode": listening_mode}
            )
            db.add(tts_settings)
        else:
            # Обновляем существующую запись
            voice_settings = tts_settings.voice_settings or {}
            voice_settings.update({"volume_level": volume_level, "listening_mode": listening_mode})
            tts_settings.voice_settings = voice_settings
        
        db.commit()
        
        logger.info(f"TTS volume saved to DB and memory for {twitch_username}: {volume_level}% ({listening_mode} mode)")
        return {"success": True, "volume_level": volume_level, "listening_mode": listening_mode}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving TTS volume: {e}")
        raise HTTPException(status_code=500, detail="Failed to save volume settings")

@app.get("/api/tts/volume")
async def get_tts_volume(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить текущую громкость TTS для пользователя (из БД)"""
    try:
        from core.database import TTSSettings
        
        twitch_username = get_platform_username(user, "twitch")
        if not twitch_username:
            return {"volume_level": 50.0, "listening_mode": "website"}
        
        # Сначала проверяем базу данных
        tts_settings = db.query(TTSSettings).filter(
            TTSSettings.user_id == user['id'],
            TTSSettings.channel_name == twitch_username
        ).first()
        
        if tts_settings and tts_settings.voice_settings:
            voice_settings = tts_settings.voice_settings
            volume_level = voice_settings.get("volume_level", 50.0)
            listening_mode = voice_settings.get("listening_mode", "website")
            
            # Синхронизируем с ConnectionManager
            connection_manager.set_tts_volume(twitch_username, volume_level)
            
            return {"volume_level": volume_level, "listening_mode": listening_mode}
        
        # Fallback: проверяем ConnectionManager
        volume_level = connection_manager.get_tts_volume(twitch_username)
        return {"volume_level": volume_level, "listening_mode": "website"}
        
    except Exception as e:
        logger.error(f"Error loading TTS volume: {e}")
        return {"volume_level": 50.0, "listening_mode": "website"}

@app.post("/api/tts/enable")
async def enable_tts(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Проверяем whitelist для TTS
    from core.database import WhitelistedChannel
    from sqlalchemy import func
    twitch_username = get_platform_username(user, "twitch")
    if not twitch_username:
        raise HTTPException(status_code=400, detail="Twitch integration not found")
    
    whitelisted = db.query(WhitelistedChannel).filter(
        func.lower(WhitelistedChannel.channel_name) == twitch_username.lower()
    ).first()
    
    if not whitelisted:
        raise HTTPException(status_code=403, detail="Channel not whitelisted for TTS")
    
    success = await tts_api.enable_tts(twitch_username)
    if success:
        connection_manager.enable_tts(twitch_username, 'twitch')
    return {"enabled": success}

@app.post("/api/tts/disable")
async def disable_tts(user: dict = Depends(get_current_user)):
    twitch_username = get_platform_username(user, "twitch")
    if not twitch_username:
        raise HTTPException(status_code=400, detail="Twitch integration not found")
    
    success = await tts_api.disable_tts(twitch_username)
    if success:
        connection_manager.disable_tts(twitch_username, 'twitch')
    return {"enabled": not success}

@app.get("/api/tts/status")
async def get_tts_status(request: Request, user: dict = Depends(get_current_user_optional)):
    # Получаем channel_name из query параметров для гостевых пользователей
    channel_name = request.query_params.get("channel_name")
    
    if user and not user.get("is_guest"):
        # Авторизованный пользователь
        twitch_username = get_platform_username(user, "twitch")
        if not twitch_username:
            return {"enabled": False, "is_whitelisted": False}
        
        is_enabled = connection_manager.is_tts_enabled(twitch_username, 'twitch')
        is_whitelisted = connection_manager.is_channel_whitelisted(twitch_username)
        return {"enabled": is_enabled, "is_whitelisted": is_whitelisted}
    elif channel_name:
        # Гостевой пользователь с указанным каналом
        is_enabled = connection_manager.is_tts_enabled(channel_name.lower(), 'twitch')
        is_whitelisted = connection_manager.is_channel_whitelisted(channel_name.lower())
        return {"enabled": is_enabled, "is_whitelisted": is_whitelisted}
    else:
        # Недостаточно данных для определения статуса
        raise HTTPException(status_code=400, detail="Channel name required for guest users")

# --- VK Live TTS Endpoints ---
@app.post("/api/tts/vk/enable")
async def enable_vk_tts(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Проверяем whitelist для TTS
    from core.database import WhitelistedChannel
    from sqlalchemy import func
    vk_username = get_platform_username(user, "vk")
    if not vk_username:
        raise HTTPException(status_code=400, detail="VK Live integration not found")
    
    whitelisted = db.query(WhitelistedChannel).filter(
        func.lower(WhitelistedChannel.channel_name) == vk_username.lower()
    ).first()
    
    if not whitelisted:
        raise HTTPException(status_code=403, detail="Channel not whitelisted for TTS")
    
    # Для VK Live пока просто включаем в connection_manager
    connection_manager.enable_tts(vk_username, 'vk')
    return {"enabled": True}

@app.post("/api/tts/vk/disable")
async def disable_vk_tts(user: dict = Depends(get_current_user)):
    vk_username = get_platform_username(user, "vk")
    if not vk_username:
        raise HTTPException(status_code=400, detail="VK Live integration not found")
    
    connection_manager.disable_tts(vk_username, 'vk')
    return {"enabled": False}

@app.get("/api/tts/vk/status")
async def get_vk_tts_status(request: Request, user: dict = Depends(get_current_user_optional)):
    # Получаем channel_name из query параметров для гостевых пользователей
    channel_name = request.query_params.get("channel_name")
    
    if user and not user.get("is_guest"):
        # Авторизованный пользователь
        vk_username = get_platform_username(user, "vk")
        if not vk_username:
            return {"enabled": False}
        
        is_enabled = connection_manager.is_tts_enabled(vk_username, 'vk')
        return {"enabled": is_enabled}
    elif channel_name:
        # Гостевой пользователь с указанным каналом
        is_enabled = connection_manager.is_tts_enabled(channel_name.lower(), 'vk')
        return {"enabled": is_enabled}
    else:
        # Недостаточно данных для определения статуса
        raise HTTPException(status_code=400, detail="Channel name required for guest users")

# --- Guest TTS Endpoints ---
@app.post("/api/tts/guest/enable")
async def enable_tts_guest(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    channel_name = data.get("channel_name", "").lower()
    
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name required")
    
    # Проверяем whitelist для TTS
    from core.database import WhitelistedChannel
    from sqlalchemy import func
    whitelisted = db.query(WhitelistedChannel).filter(
        func.lower(WhitelistedChannel.channel_name) == channel_name
    ).first()
    
    if not whitelisted:
        raise HTTPException(status_code=403, detail="Channel not whitelisted for TTS")
    
    success = await tts_api.enable_tts(channel_name)
    if success:
        connection_manager.enable_tts(channel_name)
    return {"enabled": success}

@app.post("/api/tts/guest/disable")
async def disable_tts_guest(request: Request):
    data = await request.json()
    channel_name = data.get("channel_name", "").lower()
    
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name required")
    
    success = await tts_api.disable_tts(channel_name)
    if success:
        connection_manager.disable_tts(channel_name)
    return {"enabled": not success}

@app.get("/api/tts/guest/status")
async def get_tts_guest_status(channel_name: str):
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name required")
    
    is_enabled = connection_manager.is_tts_enabled(channel_name.lower())
    return {"enabled": is_enabled}

@app.get("/api/tts/obs-url")
async def get_obs_url(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить существующий OBS URL для пользователя"""
    try:
        user_record = db.query(User).filter(User.id == user["id"]).first()
        if user_record and user_record.obs_token:
            return {"obs_token": user_record.obs_token}
        return {"obs_token": None}
    except Exception as e:
        logger.error(f"Error getting OBS URL: {e}")
        return {"obs_token": None}

@app.post("/api/tts/generate-obs-url")
async def generate_obs_url(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Генерировать URL для OBS WebSocket"""
    try:
        # Проверяем, есть ли уже сохраненный токен
        user_record = db.query(User).filter(User.id == user['id']).first()
        
        if user_record and user_record.obs_token:
            # Возвращаем существующий токен
            return ObsUrlResponse(obs_token=user_record.obs_token)
        else:
            # Создаем новый токен и сохраняем в базе данных
            obs_token = create_jwt_token(user['id'])
            
            if user_record:
                user_record.obs_token = obs_token
            else:
                # Создаем новую запись пользователя (на случай, если её нет)
                user_record = User(
                    id=user['id'],
                    display_name=user.get('display_name', 'User'),
                    obs_token=obs_token
                )
                db.add(user_record)
            
            db.commit()
            return ObsUrlResponse(obs_token=obs_token)
            
    except Exception as e:
        logger.error(f"Error generating OBS URL: {e}")
        db.rollback()
        # Fallback: создаем временный токен без сохранения
        obs_token = create_jwt_token(user['id'])
        return ObsUrlResponse(obs_token=obs_token)

@app.post("/api/youtube/obs-action")
async def youtube_obs_action(request: Request, user: dict = Depends(get_current_user)):
    """Отправить действие в YouTube OBS (play, pause, next, volume, etc.)"""
    try:
        data = await request.json()
        action = data.get("action")
        
        # Получаем канал пользователя
        twitch_username = get_platform_username(user, "twitch")
        if not twitch_username:
            raise HTTPException(status_code=400, detail="No Twitch integration found")
        
        # Отправляем команду в OBS
        await connection_manager.send_youtube_to_obs(
            channel_name=twitch_username,
            action=action,
            data=data
        )
        
        logger.info(f"YouTube OBS action sent for {twitch_username}: {action}")
        return {"success": True, "action": action}
        
    except Exception as e:
        logger.error(f"Error sending YouTube OBS action: {e}")
        raise HTTPException(status_code=500, detail="Failed to send YouTube OBS action")

@app.post("/api/youtube/generate-obs-url")
async def generate_youtube_obs_url(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Генерировать URL для YouTube OBS WebSocket"""
    try:
        # Используем тот же токен, что и для TTS
        user_record = db.query(User).filter(User.id == user['id']).first()
        
        if user_record and user_record.obs_token:
            obs_token = user_record.obs_token
        else:
            # Создаем новый токен
            obs_token = create_jwt_token(user['id'])
            
            if user_record:
                user_record.obs_token = obs_token
            else:
                user_record = User(
                    id=user['id'],
                    display_name=user.get('display_name', 'User'),
                    obs_token=obs_token
                )
                db.add(user_record)
            
            db.commit()
            
        # Возвращаем URL для YouTube OBS
        youtube_obs_url = f"http://localhost:5173/youtube-obs/{obs_token}"
        return {"youtube_obs_url": youtube_obs_url, "obs_token": obs_token}
            
    except Exception as e:
        logger.error(f"Error generating YouTube OBS URL: {e}")
        db.rollback()
        obs_token = create_jwt_token(user['id'])
        youtube_obs_url = f"http://localhost:5173/youtube-obs/{obs_token}"
        return {"youtube_obs_url": youtube_obs_url, "obs_token": obs_token}

# --- Backup Management API ---
@app.get("/api/admin/backups/info")
async def get_backup_info(current_user: dict = Depends(get_admin_user)):
    """Получить информацию о бэкапах"""
    try:
        backup_info = bot_backup_manager.get_backup_info()
        return {
            "success": True,
            "backups": backup_info,
            "service": "bot_service"
        }
    except Exception as e:
        logger.error(f"Error getting backup info: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения информации о бэкапах")

@app.post("/api/admin/backups/create")
async def create_manual_backup(
    backup_type: str,
    current_user: dict = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Создать ручной бэкап"""
    try:
        if backup_type == "database":
            db_path = "core/data/app_data.db"
            backup_path = bot_backup_manager.create_database_backup(db_path)
        elif backup_type == "config":
            config_files = [".env", "alembic.ini"]
            backup_path = bot_backup_manager.create_config_backup(config_files)
        elif backup_type == "logs":
            backup_path = bot_backup_manager.create_logs_backup("logs")
        elif backup_type == "full":
            # Полный бэкап
            db_path = "core/data/app_data.db"
            bot_backup_manager.create_database_backup(db_path)
            config_files = [".env", "alembic.ini"]
            bot_backup_manager.create_config_backup(config_files)
            bot_backup_manager.create_logs_backup("logs")
            backup_path = "Full backup completed"
        else:
            raise HTTPException(status_code=400, detail="Неверный тип бэкапа")
        
        if backup_path:
            return {
                "success": True,
                "message": f"Бэкап {backup_type} создан успешно",
                "backup_path": backup_path
            }
        else:
            raise HTTPException(status_code=500, detail="Ошибка создания бэкапа")
            
    except Exception as e:
        logger.error(f"Error creating manual backup: {e}")
        raise HTTPException(status_code=500, detail="Ошибка создания бэкапа")

@app.post("/api/admin/backups/cleanup")
async def cleanup_old_backups(current_user: dict = Depends(get_admin_user)):
    """Очистить старые бэкапы"""
    try:
        bot_backup_manager.cleanup_old_backups()
        return {
            "success": True,
            "message": "Очистка старых бэкапов завершена"
        }
    except Exception as e:
        logger.error(f"Error cleaning up backups: {e}")
        raise HTTPException(status_code=500, detail="Ошибка очистки бэкапов")

# --- System Monitoring API ---
@app.get("/api/admin/monitoring/current")
async def get_current_monitoring():
    """Получить текущую статистику мониторинга"""
    try:
        stats = bot_monitor.get_current_stats()
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        logger.error(f"Error getting monitoring stats: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения статистики мониторинга")

@app.get("/api/admin/monitoring/summary")
async def get_monitoring_summary():
    """Получить сводку мониторинга за 24 часа"""
    try:
        summary = bot_monitor.get_monitoring_summary()
        return {
            "success": True,
            "data": summary
        }
    except Exception as e:
        logger.error(f"Error getting monitoring summary: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения сводки мониторинга")

@app.get("/api/admin/monitoring/status")
async def get_monitoring_status():
    """Получить статус мониторинга"""
    try:
        return {
            "success": True,
            "monitoring_active": bot_monitor.is_monitoring,
            "data_points": len(bot_monitor.monitoring_data),
            "service": "bot_service"
        }
    except Exception as e:
        logger.error(f"Error getting monitoring status: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения статуса мониторинга")

@app.post("/api/tts/regenerate-obs-url")
async def regenerate_obs_url(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Перегенерировать URL для OBS WebSocket"""
    try:
        # Создаем новый токен
        obs_token = create_jwt_token(user['id'])
        
        # Обновляем или создаем запись пользователя
        user_record = db.query(User).filter(User.id == user['id']).first()
        
        if user_record:
            user_record.obs_token = obs_token
        else:
            # Создаем новую запись пользователя
            user_record = User(
                id=user['id'],
                display_name=user.get('display_name', 'User'),
                obs_token=obs_token
            )
            db.add(user_record)
        
        db.commit()
        return ObsUrlResponse(obs_token=obs_token)
        
    except Exception as e:
        logger.error(f"Error regenerating OBS URL: {e}")
        db.rollback()
        # Fallback: создаем временный токен без сохранения
    obs_token = create_jwt_token(user['id'])
    return ObsUrlResponse(obs_token=obs_token)

# --- YouTube Endpoints ---
@app.get("/api/youtube/queue")
async def get_youtube_queue(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        from services.queue_service import QueueService
        queue_service = QueueService(connection_manager=connection_manager)
        
        # Получаем очередь из базы данных
        queue_items_raw = queue_service.get_queue(user["id"], db)
        
        # Преобразуем данные в формат, совместимый с YouTubeVideoPublic
        def format_queue_item(item):
            from datetime import datetime
            return {
                'id': item['id'],
                'video_id': item['video_id'],  # YouTube video ID для плеера
                'title': item['title'],
                'url': item['url'],
                'duration': 0,  # Временно 0, если duration строка
                'thumbnail_url': item['thumbnail_url'] or '',
                'added_at': datetime.fromisoformat(item['added_at']) if item['added_at'] else datetime.now(),
                'user_id': str(user["id"]),
                'requester_name': item.get('requester_name', 'Unknown'),  # Имя заказчика
                'channel_title': item.get('channel_name', '')  # Канал YouTube
            }
        
        queue_items = [format_queue_item(item) for item in queue_items_raw]
        
        # Первое видео в очереди становится текущим
        current_video = queue_items[0] if queue_items else None
        
        # Остальные видео остаются в очереди
        pending_queue = queue_items[1:] if len(queue_items) > 1 else []
        
        return QueueResponse(
            current_video=current_video,
            queue=pending_queue,
            is_playing=bool(current_video)
        )
        
    except Exception as e:
        logger.error(f"Error getting YouTube queue: {e}")
        # Fallback к старому способу
        queue = connection_manager.get_youtube_queue(user["id"])
        current_video_data = connection_manager.get_current_video(user["id"])
        current_video = current_video_data if current_video_data else None
        
        # Преобразуем в правильный формат для fallback
        formatted_queue = []
        if queue:
            for item in queue:
                formatted_queue.append({
                    'id': item.get('id', 0),
                    'video_id': item.get('video_id', ''),
                    'title': item.get('title', 'Unknown'),
                    'url': item.get('url', ''),
                    'duration': item.get('duration', 0),
                    'thumbnail_url': item.get('thumbnail_url', ''),
                    'added_at': item.get('added_at', datetime.now()),
                    'user_id': str(user["id"])
                })
    
    return QueueResponse(
        current_video=current_video,
            queue=formatted_queue,
        is_playing=bool(current_video)
    )

@app.post("/api/youtube/queue")
async def add_to_youtube_queue(request: dict, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    url = request.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL required")
    
    try:
        from services.queue_service import QueueService
        queue_service = QueueService(connection_manager=connection_manager)
        
        # Получаем информацию о видео
        video_info = youtube_api.get_video_info(url)
        if not video_info:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
        # Добавляем в базу данных через QueueService
        result = queue_service.add_video_to_queue(
            user_id=user["id"],
            video_url=url,
            video_id=video_info.get("video_id", ""),
            title=video_info.get("title", "Unknown"),
            duration=video_info.get("duration", "0"),
            thumbnail_url=video_info.get("thumbnail_url", ""),
            channel_name="web",  # Заказ через веб-интерфейс
            platform="web",
            requester_name=user.get("display_name", "Unknown"),
            requester_id=str(user["id"]),
            db=db
        )
        
        # Отправляем событие обновления очереди
        await connection_manager.send_youtube_event_to_user(
            user_id=str(user["id"]),
            event_type="queue_updated",
            data={"action": "video_added", "video": result}
        )
        
        return {"message": "Video added to queue", "video": result}
        
    except Exception as e:
        logger.error(f"Error adding video to queue: {e}")
        # Fallback к старому способу
        video_info = youtube_api.get_video_info(url)
        if not video_info:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
        connection_manager.add_to_youtube_queue(user["id"], video_info)
        return {"message": "Video added to queue (fallback)"}

@app.post("/api/youtube/player/next")
async def youtube_player_next(user: dict = Depends(get_current_user)):
    next_video = connection_manager.next_youtube_video(user["id"])
    
    # Получаем канал пользователя для OBS
    twitch_username = get_platform_username(user, "twitch")
    
    if next_video:
        # Отправляем команду в OBS если настроен режим OBS
        if twitch_username:
            await connection_manager.send_youtube_to_obs(
                channel_name=twitch_username,
                action="play",
                data={"video": next_video}
            )
        
        # Синхронизируем состояние с фронтендом через WebSocket
        await connection_manager.send_youtube_state_to_user(
            user_id=user["id"],
            action="next_video",
            data={"current_video": next_video}
        )
        
        return {"success": True, "message": "Switched to next video", "current_video": next_video}
    else:
        # Отправляем команду остановки в OBS
        if twitch_username:
            await connection_manager.send_youtube_to_obs(
                channel_name=twitch_username,
                action="clear"
            )
        
        # Синхронизируем состояние с фронтендом
        await connection_manager.send_youtube_state_to_user(
            user_id=user["id"],
            action="queue_empty",
            data={}
        )
        
        return {"success": False, "message": "No videos in queue"}

@app.post("/api/youtube/player/play")
async def youtube_player_play(
    request: dict,
    user: dict = Depends(get_current_user)
):
    """Переключиться на конкретное видео"""
    try:
        video_id = request.get("video_id")
        queue_id = request.get("queue_id")
        
        if not video_id:
            raise HTTPException(status_code=400, detail="video_id is required")
        
        # Получаем информацию о видео из очереди
        db = next(get_db())
        queue_item = db.query(YouTubeQueue).filter(
            YouTubeQueue.id == queue_id,
            YouTubeQueue.user_id == user["id"]
        ).first()
        
        if not queue_item:
            raise HTTPException(status_code=404, detail="Video not found in queue")
        
        # Создаем объект видео
        video_data = {
            "video_id": queue_item.video_id,
            "title": queue_item.title,
            "duration": queue_item.duration,
            "thumbnail_url": queue_item.thumbnail_url,
            "url": queue_item.video_url,
            "requester_name": queue_item.requester_name
        }
        
        # Устанавливаем как текущее видео
        connection_manager.set_current_video(user["id"], video_data)
        
        # Получаем канал пользователя для OBS
        twitch_username = get_platform_username(user, "twitch")
        
        # Отправляем команду в OBS
        if twitch_username:
            await connection_manager.send_youtube_to_obs(
                channel_name=twitch_username,
                action="play",
                data={"video": video_data}
            )
        
        # Уведомляем WebSocket клиентов
        await connection_manager.broadcast_to_user(
            user["id"], 
            {
                "type": "youtube_event",
                "event": "video_played",
                "data": {"video": video_data}
            }
        )
        
        return {"success": True, "message": "Video started", "current_video": video_data}
        
    except Exception as e:
        logger.error(f"Error playing video: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/youtube/clear")
async def youtube_queue_clear(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        # Очищаем ConnectionManager (in-memory)
        connection_manager.clear_youtube_queue(user["id"])
        
        # Очищаем базу данных
        from services.queue_service import QueueService
        queue_service = QueueService(connection_manager=connection_manager)
        queue_service.clear_queue(user["id"], db)
        
        # Отправляем событие очистки очереди
        await connection_manager.send_youtube_event_to_user(
            user_id=str(user["id"]),
            event_type="queue_updated",
            data={"action": "queue_cleared"}
        )
        
        # Отправляем команду очистки в OBS
        twitch_username = get_platform_username(user, "twitch")
        if twitch_username:
            await connection_manager.send_youtube_to_obs(
                channel_name=twitch_username,
                action="clear"
            )
        
        return {"message": "Queue cleared"}
        
    except Exception as e:
        logger.error(f"Error clearing YouTube queue: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear queue")

# --- Admin Endpoints ---
@app.get("/api/admin/whitelist")
async def get_whitelist(user: dict = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.get_whitelist(db)

@app.post("/api/admin/whitelist")
async def add_to_whitelist(request: AddToWhitelistRequest, user: dict = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.add_to_whitelist(request, db)

@app.delete("/api/admin/whitelist")
async def remove_from_whitelist(request: AddToWhitelistRequest, user: dict = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.remove_from_whitelist(request, db)

@app.post("/api/admin/whitelist/add")
async def add_to_whitelist_add(request: AddToWhitelistRequest, user: dict = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.add_to_whitelist(request, db)

@app.delete("/api/admin/whitelist/remove")
async def remove_from_whitelist_remove(request: AddToWhitelistRequest, user: dict = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.remove_from_whitelist(request, db)

@app.get("/api/admin/blocked-bots")
async def get_blocked_bots(user: dict = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.get_blocked_bots(db)

@app.post("/api/admin/blocked-bots")
async def add_blocked_bot(request: AddBlockedBotRequest, user: dict = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.add_blocked_bot(request, db)

@app.delete("/api/admin/blocked-bots/{bot_name}")
async def remove_blocked_bot(bot_name: str, user: dict = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.remove_blocked_bot(bot_name, db)

@app.get("/api/admin/users")
async def get_users(user: dict = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.get_users(db)

# --- User Management Endpoints ---
@app.put("/api/admin/users/{user_id}")
async def update_user(user_id: int, request: dict, user: dict = Depends(get_admin_user), db: Session = Depends(get_db)):
    """Обновить пользователя"""
    return await admin_api.update_user(user_id, request, db)

@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: int, user: dict = Depends(get_admin_user), db: Session = Depends(get_db)):
    """Удалить пользователя"""
    # Нельзя удалить самого себя
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    return await admin_api.delete_user(user_id, db)

@app.post("/api/admin/users/{user_id}/block")
async def block_user(user_id: int, request: dict, user: dict = Depends(get_admin_user), db: Session = Depends(get_db)):
    """Заблокировать пользователя"""
    return await admin_api.block_user(user_id, request, db)

@app.post("/api/admin/users/{user_id}/unblock")
async def unblock_user(user_id: int, user: dict = Depends(get_admin_user), db: Session = Depends(get_db)):
    """Разблокировать пользователя"""
    return await admin_api.unblock_user(user_id, db)

# --- Bot Control Endpoints ---
@app.get("/api/admin/bots/status")
async def get_bots_status(user: dict = Depends(get_admin_user)):
    """Получить статус всех ботов"""
    return await admin_api.get_bots_status(connection_manager)

@app.post("/api/admin/bots/{bot_name}/restart")
async def restart_bot(bot_name: str, user: dict = Depends(get_admin_user)):
    """Перезапустить бота"""
    return await admin_api.restart_bot(bot_name)

@app.get("/api/admin/bots/logs")
async def get_bots_logs(user: dict = Depends(get_admin_user)):
    """Получить логи ботов"""
    return await admin_api.get_bots_logs()

@app.post("/api/admin/tts/restart")
async def restart_tts_engine(user: dict = Depends(get_admin_user)):
    """Перезагрузить TTS движок"""
    return await admin_api.restart_tts_engine()

@app.post("/api/admin/bot-service/restart")
async def restart_bot_service(user: dict = Depends(get_admin_user)):
    """Перезагрузить весь Bot Service"""
    return await admin_api.restart_bot_service()

# --- System Logs Endpoints ---
@app.get("/api/admin/logs")
async def get_system_logs(
    level: str = None,
    search: str = None,
    limit: int = 100,
    user: dict = Depends(get_admin_user)
):
    """Получить системные логи с фильтрацией"""
    return await admin_api.get_system_logs(level, search, limit)

@app.get("/api/admin/logs/export")
async def export_system_logs(
    level: str = None,
    search: str = None,
    user: dict = Depends(get_admin_user)
):
    """Экспортировать системные логи"""
    return await admin_api.export_system_logs(level, search)

@app.get("/api/admin/list")
async def get_admin_list():
    """Получить список админов из переменной окружения"""
    admin_users = os.getenv("ADMIN_USERS", "")
    if not admin_users:
        return {"admins": []}
    
    # Разделяем по запятым и очищаем от пробелов
    admins = [admin.strip() for admin in admin_users.split(",") if admin.strip()]
    return {"admins": admins}

# --- Session Management Endpoints ---
@app.get("/api/admin/sessions")
async def get_active_sessions(db: Session = Depends(get_db)):
    """Получить список активных сессий"""
    sessions = []
    
    try:
        # Получаем активные сессии из базы данных
        from core.database import User
        from datetime import datetime, timedelta
        
        # Получаем всех пользователей
        all_users = db.query(User).all()
        logger.info(f"Total users in database: {len(all_users)}")
        
        # Показываем всех пользователей как активные сессии
        active_users = all_users
        
        for user in active_users:
            # Пока что у нас нет информации о платформах в модели User
            # В будущем можно будет добавить отдельные таблицы для связей пользователей с платформами
            platforms = []
            
            sessions.append({
                "user_id": user.id,
                "display_name": user.display_name,
                "platforms": platforms,
                "is_admin": user.is_admin,
                "last_activity": datetime.utcnow().isoformat(),  # Используем текущее время как активность
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "session_type": "active_user"
            })
        
        # Также добавляем pending verifications
        for channel, verification in connection_manager.pending_verifications.items():
            is_verified = channel in connection_manager.verified_sessions
            sessions.append({
                "channel": channel,
                "is_verified": is_verified,
                "code": verification.get("code", ""),
                "timestamp": verification.get("timestamp", 0),
                "created_at": datetime.fromtimestamp(verification.get("timestamp", 0)).isoformat() if verification.get("timestamp") else None,
                "session_type": "pending_verification"
            })
        
        # Сортируем по последней активности
        sessions.sort(key=lambda x: x.get('last_activity', x.get('created_at', '')), reverse=True)
        
    except Exception as e:
        logger.error(f"Error getting active sessions: {e}")
        # В случае ошибки возвращаем пустой список
        sessions = []
    
    return {
        "sessions": sessions,
        "total": len(sessions),
        "active_users": len([s for s in sessions if s.get('session_type') == 'active_user']),
        "pending_verifications": len([s for s in sessions if s.get('session_type') == 'pending_verification'])
    }

@app.delete("/api/admin/sessions/{channel}")
async def clear_session(channel: str):
    """Очистить сессию для конкретного канала"""
    channel = channel.lower()
    
    # Очищаем из pending_verifications
    if channel in connection_manager.pending_verifications:
        del connection_manager.pending_verifications[channel]
    
    # Очищаем из verified_sessions
    connection_manager.clear_verified_session(channel)
    
    # Очищаем из базы данных
    try:
        from core.database import get_db, GuestVerification
        db_gen = get_db()
        db = next(db_gen)
        try:
            db.query(GuestVerification).filter(
                GuestVerification.channel_name == channel
            ).delete()
            db.commit()
            logger.info(f"Cleared session data from database for channel: {channel}")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to clear session data from database: {e}")
    
    # Отключаем бота от канала
    global bot_instance
    if bot_instance and bot_instance.is_connected_to_channel(channel):
        await bot_instance.leave_channel(channel)
        logger.info(f"Bot disconnected from channel: {channel}")
    
    return {"message": f"Session cleared for channel: {channel}"}

@app.delete("/api/admin/sessions/user/{user_id}")
async def clear_user_session(user_id: int, db: Session = Depends(get_db)):
    """Очистить сессию для конкретного пользователя"""
    try:
        from core.database import User
        
        # Находим пользователя
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": "User not found"}
        
        # Получаем активные каналы перед удалением пользователя
        active_channels = connection_manager.get_active_channels()
        logger.info(f"Active channels before user deletion: {active_channels}")
        
        # Отключаем ботов от всех активных каналов
        global bot_instance, vk_live_bot_instance
        for channel in active_channels:
            # Отключаем Twitch бота
            if bot_instance and bot_instance.is_connected_to_channel(channel):
                await bot_instance.leave_channel(channel)
                logger.info(f"Disconnected Twitch bot from channel: {channel}")
            
            # Отключаем VK Live бота
            if channel in connection_manager.active_vk_bots:
                vk_bot = connection_manager.active_vk_bots[channel]
                if vk_bot:
                    await vk_bot.stop()
                    del connection_manager.active_vk_bots[channel]
                    logger.info(f"Disconnected VK Live bot from channel: {channel}")
        
        # Очищаем активные каналы из ConnectionManager
        connection_manager.clear_all_channels()
        logger.info("Cleared all active channels from ConnectionManager")
        
        # Удаляем пользователя из базы данных
        db.delete(user)
        db.commit()
        
        logger.info(f"User session terminated and user deleted: {user_id}")
        return {"message": f"User session terminated: {user_id}"}
        
    except Exception as e:
        logger.error(f"Error terminating user session {user_id}: {e}")
        return {"error": f"Failed to terminate user session: {str(e)}"}

@app.delete("/api/admin/sessions")
async def clear_all_sessions():
    """Очистить все активные сессии"""
    cleared_count = 0
    
    # Получаем список каналов для очистки
    channels_to_clear = list(connection_manager.pending_verifications.keys())
    
    for channel in channels_to_clear:
        # Очищаем из pending_verifications
        if channel in connection_manager.pending_verifications:
            del connection_manager.pending_verifications[channel]
        
        # Очищаем из verified_sessions
        connection_manager.clear_verified_session(channel)
        cleared_count += 1
    
    # Очищаем все из базы данных
    try:
        from core.database import get_db, GuestVerification
        db_gen = get_db()
        db = next(db_gen)
        try:
            deleted_count = db.query(GuestVerification).delete()
            db.commit()
            logger.info(f"Cleared {deleted_count} sessions from database")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to clear sessions from database: {e}")
    
    # Отключаем бота от всех каналов
    global bot_instance
    if bot_instance:
        for channel in channels_to_clear:
            if bot_instance.is_connected_to_channel(channel):
                await bot_instance.leave_channel(channel)
                logger.info(f"Bot disconnected from channel: {channel}")
    
    return {"message": f"Cleared {cleared_count} sessions", "cleared_count": cleared_count}

# --- Blocked Channels Management Endpoints ---
@app.get("/api/admin/blocked-channels")
async def get_blocked_channels():
    """Получить список заблокированных каналов"""
    try:
        from core.database import get_db, BlockedChannel
        db_gen = get_db()
        db = next(db_gen)
        try:
            blocked_channels = db.query(BlockedChannel).filter(
                BlockedChannel.is_active == True
            ).all()
            
            channels = []
            for channel in blocked_channels:
                channels.append({
                    "id": channel.id,
                    "channel_name": channel.channel_name,
                    "reason": channel.reason,
                    "blocked_by": channel.blocked_by,
                    "created_at": channel.created_at.isoformat() if channel.created_at else None
                })
            
            return {"blocked_channels": channels}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to get blocked channels: {e}")
        raise HTTPException(status_code=500, detail="Failed to get blocked channels")

@app.post("/api/admin/blocked-channels")
async def block_channel(request: Request):
    """Заблокировать канал"""
    try:
        data = await request.json()
        channel_name = data.get("channel_name", "").lower()
        reason = data.get("reason", "")
        blocked_by = data.get("blocked_by", "admin")
        
        if not channel_name:
            raise HTTPException(status_code=400, detail="Channel name required")
        
        from core.database import get_db, BlockedChannel
        db_gen = get_db()
        db = next(db_gen)
        try:
            # Проверяем, не заблокирован ли уже канал
            existing = db.query(BlockedChannel).filter(
                BlockedChannel.channel_name == channel_name,
                BlockedChannel.is_active == True
            ).first()
            
            if existing:
                raise HTTPException(status_code=400, detail="Channel already blocked")
            
            # Создаем новую запись о блокировке
            blocked_channel = BlockedChannel(
                channel_name=channel_name,
                reason=reason,
                blocked_by=blocked_by
            )
            db.add(blocked_channel)
            db.commit()
            
            logger.info(f"Channel {channel_name} blocked by {blocked_by}: {reason}")
            return {"message": f"Channel {channel_name} blocked successfully"}
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to block channel: {e}")
        raise HTTPException(status_code=500, detail="Failed to block channel")

@app.delete("/api/admin/blocked-channels/{channel_name}")
async def unblock_channel(channel_name: str):
    """Разблокировать канал"""
    try:
        channel_name = channel_name.lower()
        
        from core.database import get_db, BlockedChannel
        db_gen = get_db()
        db = next(db_gen)
        try:
            # Находим активную блокировку
            blocked_channel = db.query(BlockedChannel).filter(
                BlockedChannel.channel_name == channel_name,
                BlockedChannel.is_active == True
            ).first()
            
            if not blocked_channel:
                raise HTTPException(status_code=404, detail="Channel not found in blocked list")
            
            # Деактивируем блокировку
            blocked_channel.is_active = False
            db.commit()
            
            logger.info(f"Channel {channel_name} unblocked")
            return {"message": f"Channel {channel_name} unblocked successfully"}
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to unblock channel: {e}")
        raise HTTPException(status_code=500, detail="Failed to unblock channel")

@app.get("/api/admin/check-blocked-channel/{channel_name}")
async def check_channel_blocked(channel_name: str):
    """Проверить, заблокирован ли канал"""
    try:
        channel_name = channel_name.lower()
        
        from core.database import get_db, BlockedChannel
        db_gen = get_db()
        db = next(db_gen)
        try:
            blocked_channel = db.query(BlockedChannel).filter(
                BlockedChannel.channel_name == channel_name,
                BlockedChannel.is_active == True
            ).first()
            
            is_blocked = blocked_channel is not None
            return {
                "is_blocked": is_blocked,
                "reason": blocked_channel.reason if blocked_channel else None,
                "blocked_by": blocked_channel.blocked_by if blocked_channel else None,
                "blocked_at": blocked_channel.created_at.isoformat() if blocked_channel and blocked_channel.created_at else None
            }
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to check if channel is blocked: {e}")
        raise HTTPException(status_code=500, detail="Failed to check channel status")

# --- Active Channels Endpoint ---
@app.get("/api/active-channels")
async def get_active_channels(request: Request, db: Session = Depends(get_db)):
    """Получить список активных каналов"""
    try:
        # Получаем каналы с активными сессиями из ConnectionManager
        active_channels = connection_manager.get_active_channels()
        
        logger.info(f"Active channels from ConnectionManager: {active_channels}")
        
        channels = []
        for channel_name in active_channels:
            # Ищем информацию о канале в базе данных
            from core.database import User, UserToken
            
            # Ищем токен пользователя по имени канала на платформе
            user_token = db.query(UserToken).filter(
                UserToken.platform_display_name.ilike(channel_name)
            ).first()
            
            if user_token:
                # Получаем связанного пользователя
                user = db.query(User).filter(User.id == user_token.user_id).first()
                
                channels.append({
                    "username": user_token.platform_display_name,
                    "display_name": user.display_name if user else user_token.platform_display_name,
                    "platform": user_token.platform,
                    "is_online": True,  # Если канал в active_sessions, значит он активен
                    "avatar": user_token.avatar_url
                })
            else:
                # Если пользователь не найден в БД (например, гостевой режим)
                channels.append({
                    "username": channel_name,
                    "display_name": channel_name,
                    "platform": "unknown",
                    "is_online": True,
                    "avatar": None
                })
        
        return channels
    except Exception as e:
        logger.error(f"Error getting active channels: {e}")
        return []

# --- Health Check ---
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# --- Bot Commands API ---
@app.get("/api/commands")
async def get_bot_commands(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все команды бота для текущего пользователя"""
    user_id = current_user["id"]
    
    # Базовые команды (одинаковые для всех)
    basic_commands = [
        {
            "command_name": "sr",
            "command_type": "basic",
            "description": "Заказать YouTube видео",
            "usage": "!sr <URL>",
            "is_enabled": True,
            "platforms": "twitch,vk",
            "allowed_roles": "all",
            "cooldown_seconds": 10,
            "editable": True
        },
        {
            "command_name": "queue",
            "command_type": "basic", 
            "description": "Показать очередь видео",
            "usage": "!queue",
            "is_enabled": True,
            "platforms": "twitch,vk",
            "allowed_roles": "all",
            "cooldown_seconds": 5,
            "editable": True
        },
        {
            "command_name": "next",
            "command_type": "basic",
            "description": "Переключить на следующее видео",
            "usage": "!next",
            "is_enabled": True,
            "platforms": "twitch,vk", 
            "allowed_roles": "broadcaster,moderator,owner,moderator_vk",
            "cooldown_seconds": 0,
            "editable": True
        },
        {
            "command_name": "clear",
            "command_type": "basic",
            "description": "Очистить очередь видео",
            "usage": "!clear",
            "is_enabled": True,
            "platforms": "twitch,vk",
            "allowed_roles": "broadcaster,moderator,owner,moderator_vk",
            "cooldown_seconds": 0,
            "editable": True
        },
        {
            "command_name": "tts",
            "command_type": "basic",
            "description": "Включить/выключить TTS (озвучку сообщений чата)",
            "usage": "!tts",
            "is_enabled": True,
            "platforms": "twitch,vk",
            "allowed_roles": "all",
            "cooldown_seconds": 5,
            "editable": True
        },
        {
            "command_name": "voice",
            "command_type": "basic",
            "description": "Выбрать голос для TTS по номеру или случайный голос",
            "usage": "!voice <номер> или !voice random",
            "is_enabled": True,
            "platforms": "twitch,vk",
            "allowed_roles": "all",
            "cooldown_seconds": 5,
            "editable": True
        },
        {
            "command_name": "help",
            "command_type": "basic",
            "description": "Показать список всех доступных команд",
            "usage": "!help",
            "is_enabled": True,
            "platforms": "twitch,vk",
            "allowed_roles": "all",
            "cooldown_seconds": 10,
            "editable": True
        }
    ]
    
    # Получаем пользовательские настройки базовых команд
    user_commands = db.query(BotCommand).filter(BotCommand.user_id == user_id).all()
    
    # Создаем словарь для быстрого поиска
    user_command_dict = {cmd.command_name: cmd for cmd in user_commands}
    
    # Применяем пользовательские настройки к базовым командам
    for cmd in basic_commands:
        if cmd["command_name"] in user_command_dict:
            user_cmd = user_command_dict[cmd["command_name"]]
            cmd.update({
                "is_enabled": user_cmd.is_enabled,
                "platforms": user_cmd.platforms,
                "allowed_roles": user_cmd.allowed_roles,
                "cooldown_seconds": user_cmd.cooldown_seconds,
                "usage_count": user_cmd.usage_count
            })
    
    # Получаем кастомные команды
    custom_commands = [
        {
            "id": cmd.id,
            "command_name": cmd.command_name,
            "command_type": "custom",
            "response_text": cmd.response_text,
            "description": f"Кастомная команда: {cmd.response_text[:50]}...",
            "usage": f"!{cmd.command_name}",
            "is_enabled": cmd.is_enabled,
            "platforms": cmd.platforms,
            "allowed_roles": cmd.allowed_roles,
            "cooldown_seconds": cmd.cooldown_seconds,
            "usage_count": cmd.usage_count,
            "created_at": cmd.created_at.isoformat(),
            "editable": True
        }
        for cmd in user_commands if cmd.command_type == 'custom'
    ]
    
    return {
        "basic_commands": basic_commands,
        "custom_commands": custom_commands
    }

@app.post("/api/commands")
async def create_custom_command(
    command_data: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новую кастомную команду"""
    user_id = current_user["id"]
    
    # Валидация данных
    command_name = command_data.get("command_name", "").strip().lower()
    response_text = command_data.get("response_text", "").strip()
    
    if not command_name or not response_text:
        raise HTTPException(status_code=400, detail="Command name and response text are required")
    
    # Убираем ! если есть
    if command_name.startswith("!"):
        command_name = command_name[1:]
    
    # Проверяем, что команда не существует
    existing = db.query(BotCommand).filter(
        BotCommand.user_id == user_id,
        BotCommand.command_name == command_name
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Command already exists")
    
    # Создаем команду
    new_command = BotCommand(
        user_id=user_id,
        channel_name=current_user.get("username", ""),
        command_name=command_name,
        command_type="custom",
        response_text=response_text,
        is_enabled=command_data.get("is_enabled", True),
        platforms=command_data.get("platforms", "twitch,vk"),
        allowed_roles=command_data.get("allowed_roles", "all"),
        cooldown_seconds=command_data.get("cooldown_seconds", 0)
    )
    
    db.add(new_command)
    db.commit()
    db.refresh(new_command)
    
    return {"message": "Custom command created successfully", "command_id": new_command.id}

@app.put("/api/commands/{command_name}")
async def update_command(
    command_name: str,
    command_data: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить настройки команды"""
    user_id = current_user["id"]
    
    # Ищем команду
    command = db.query(BotCommand).filter(
        BotCommand.user_id == user_id,
        BotCommand.command_name == command_name
    ).first()
    
    if not command:
        # Создаем новую запись для базовой команды
        command = BotCommand(
            user_id=user_id,
            channel_name=current_user.get("username", ""),
            command_name=command_name,
            command_type="basic"
        )
        db.add(command)
    
    # Обновляем настройки
    command.is_enabled = command_data.get("is_enabled", command.is_enabled)
    command.platforms = command_data.get("platforms", command.platforms)
    command.allowed_roles = command_data.get("allowed_roles", command.allowed_roles)
    command.cooldown_seconds = command_data.get("cooldown_seconds", command.cooldown_seconds)
    
    if command.command_type == "custom":
        command.response_text = command_data.get("response_text", command.response_text)
    
    db.commit()
    
    return {"message": "Command updated successfully"}

@app.delete("/api/commands/{command_id}")
async def delete_custom_command(
    command_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить кастомную команду"""
    user_id = current_user["id"]
    
    command = db.query(BotCommand).filter(
        BotCommand.id == command_id,
        BotCommand.user_id == user_id,
        BotCommand.command_type == "custom"
    ).first()
    
    if not command:
        raise HTTPException(status_code=404, detail="Custom command not found")
    
    db.delete(command)
    db.commit()
    
    return {"message": "Custom command deleted successfully"}

# --- Background Tasks ---
async def cleanup_task():
    """Фоновая задача для очистки неактивных каналов"""
    while True:
        try:
            await asyncio.sleep(60)  # Проверяем каждую минуту
            await connection_manager.cleanup_inactive_channels()
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")

@app.on_event("startup")
async def startup_event():
    """Запуск фоновых задач при старте приложения"""
    # Запускаем фоновую задачу очистки
    asyncio.create_task(cleanup_task())
    logger.info("🚀 Background cleanup task started")

# --- Points & Rewards API ---
@app.get("/api/points/rewards/{platform}")
async def get_platform_rewards(
    platform: str,
    current_user: dict = Depends(get_current_user)
):
    """Получить награды с выбранной платформы (twitch/vk)"""
    try:
        if platform == "twitch":
            # Здесь будет интеграция с Twitch API для получения Channel Points наград
            return {"rewards": []}
        elif platform == "vk":
            # Здесь будет интеграция с VK Live API для получения наград
            return {"rewards": []}
        else:
            raise HTTPException(status_code=400, detail="Unsupported platform")
    except Exception as e:
        logger.error(f"Error getting {platform} rewards: {e}")
        return {"rewards": []}

@app.post("/api/points/rewards/{platform}/create")
async def create_platform_reward(
    platform: str,
    name: str = Form(...),
    description: str = Form(...),
    price: int = Form(...),
    sound: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    """Создать награду на платформе"""
    try:
        if platform == "twitch":
            # Интеграция с Twitch API для создания Channel Points награды
            return {"success": True, "message": "Twitch reward created"}
        elif platform == "vk":
            # Интеграция с VK Live API для создания награды
            return {"success": True, "message": "VK reward created"}
        else:
            raise HTTPException(status_code=400, detail="Unsupported platform")
    except Exception as e:
        logger.error(f"Error creating {platform} reward: {e}")
        raise HTTPException(status_code=500, detail="Failed to create reward")

@app.delete("/api/points/rewards/{platform}/{reward_id}")
async def delete_platform_reward(
    platform: str,
    reward_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Удалить награду с платформы"""
    try:
        if platform == "twitch":
            # Интеграция с Twitch API для удаления Channel Points награды
            return {"success": True, "message": "Twitch reward deleted"}
        elif platform == "vk":
            # Интеграция с VK Live API для удаления награды
            return {"success": True, "message": "VK reward deleted"}
        else:
            raise HTTPException(status_code=400, detail="Unsupported platform")
    except Exception as e:
        logger.error(f"Error deleting {platform} reward: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete reward")

# --- DonationAlerts Integration ---
@app.post("/api/donationalerts/connect")
async def connect_donationalerts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Подключение к DonationAlerts через OAuth"""
    try:
        import aiohttp
        import secrets
        
        # Генерируем state для безопасности
        state = secrets.token_urlsafe(32)
        
        # Сохраняем state в сессии пользователя
        from core.database import User
        user = db.query(User).filter(User.id == current_user["id"]).first()
        if user:
            # Временно сохраняем state (в реальном приложении лучше использовать Redis)
            user.temp_oauth_state = state
            db.commit()
        
        # Параметры OAuth
        client_id = os.getenv("DONATIONALERTS_CLIENT_ID")
        redirect_uri = f"{os.getenv('BASE_URL', 'http://localhost:8000')}/api/donationalerts/callback"
        scope = "oauth-donation-subscribe"
        
        if not client_id:
            raise HTTPException(status_code=500, detail="DonationAlerts Client ID not configured")
        
        auth_url = f"https://www.donationalerts.com/oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}&state={state}"
        
        return {
            "success": True,
            "auth_url": auth_url,
            "message": "Redirect to DonationAlerts for authorization"
        }
    except Exception as e:
        logger.error(f"Error connecting DonationAlerts: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect DonationAlerts")

@app.get("/api/donationalerts/callback")
async def donationalerts_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db)
):
    """Callback для OAuth DonationAlerts"""
    try:
        import aiohttp
        
        # Находим пользователя по state
        from core.database import User
        user = db.query(User).filter(User.temp_oauth_state == state).first()
        if not user:
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        # Обмениваем код на токен
        client_id = os.getenv("DONATIONALERTS_CLIENT_ID")
        client_secret = os.getenv("DONATIONALERTS_CLIENT_SECRET")
        redirect_uri = f"{os.getenv('BASE_URL', 'http://localhost:8000')}/api/donationalerts/callback"
        
        if not client_id or not client_secret:
            raise HTTPException(status_code=500, detail="DonationAlerts credentials not configured")
        
        async with aiohttp.ClientSession() as session:
            token_data = {
                "grant_type": "authorization_code",
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "code": code
            }
            
            async with session.post("https://www.donationalerts.com/oauth/token", data=token_data) as response:
                if response.status == 200:
                    token_response = await response.json()
                    
                    # Сохраняем токены
                    user.donationalerts_access_token = token_response.get("access_token")
                    user.donationalerts_refresh_token = token_response.get("refresh_token")
                    user.donationalerts_token_expires = datetime.utcnow() + timedelta(seconds=token_response.get("expires_in", 3600))
                    user.temp_oauth_state = None  # Очищаем временный state
                    db.commit()
                    
                    # Перенаправляем обратно на фронтенд
                    return RedirectResponse(url="/dashboard/points?connected=true")
                else:
                    logger.error(f"DonationAlerts token exchange failed: {response.status}")
                    return RedirectResponse(url="/dashboard/points?error=token_exchange_failed")
                    
    except Exception as e:
        logger.error(f"Error in DonationAlerts callback: {e}")
        return RedirectResponse(url="/dashboard/points?error=callback_failed")

@app.post("/api/donationalerts/disconnect")
async def disconnect_donationalerts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Отключение от DonationAlerts"""
    try:
        from core.database import User
        user = db.query(User).filter(User.id == current_user["id"]).first()
        if user:
            # Очищаем токены DonationAlerts
            user.donationalerts_access_token = None
            user.donationalerts_refresh_token = None
            user.donationalerts_token_expires = None
            db.commit()
            
            return {"success": True, "message": "DonationAlerts отключен"}
        else:
            raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        logger.error(f"Error disconnecting DonationAlerts: {e}")
        raise HTTPException(status_code=500, detail="Failed to disconnect DonationAlerts")

@app.get("/api/donationalerts/status")
async def get_donationalerts_status(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Проверить статус подключения к DonationAlerts"""
    try:
        from core.database import User
        user = db.query(User).filter(User.id == current_user["id"]).first()
        
        # Проверяем есть ли токены и не истекли ли они
        is_connected = (
            user and 
            user.donationalerts_access_token and 
            user.donationalerts_token_expires and 
            user.donationalerts_token_expires > datetime.utcnow()
        )
        
        return {
            "connected": is_connected,
            "message": "DonationAlerts connected" if is_connected else "Not connected"
        }
    except Exception as e:
        logger.error(f"Error checking DonationAlerts status: {e}")
        return {"connected": False, "message": "Error checking status"}

@app.get("/api/donationalerts/donations")
async def get_recent_donations(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить последние донаты от DonationAlerts"""
    try:
        import aiohttp
        
        from core.database import User
        user = db.query(User).filter(User.id == current_user["id"]).first()
        
        if not user or not user.donationalerts_access_token:
            return {"donations": []}
        
        # Проверяем не истек ли токен
        if user.donationalerts_token_expires <= datetime.utcnow():
            # Здесь нужно обновить токен
            return {"donations": [], "error": "Token expired"}
        
        # Запрос к API DonationAlerts
        headers = {
            "Authorization": f"Bearer {user.donationalerts_access_token}",
            "Content-Type": "application/json"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get("https://www.donationalerts.com/api/v1/alerts/donations", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    donations = []
                    
                    for item in data.get("data", []):
                        donations.append({
                            "id": item["id"],
                            "username": item["username"],
                            "message": item["message"] or "Без сообщения",
                            "amount": float(item["amount"]),
                            "currency": item["currency"],
                            "created_at": item["created_at"]
                        })
                    
                    return {"donations": donations}
                else:
                    logger.error(f"DonationAlerts API error: {response.status}")
                    return {"donations": [], "error": "API request failed"}
                    
    except Exception as e:
        logger.error(f"Error getting donations: {e}")
        return {"donations": [], "error": str(e)}

# --- Support Tickets API ---
@app.post("/api/support/tickets")
async def create_support_ticket(
    subject: str = Form(...),
    message: str = Form(...),
    user_name: str = Form(None),
    user_email: str = Form(None),
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Создать новый тикет поддержки"""
    try:
        # Валидация длины сообщения
        if len(message) > 500:
            raise HTTPException(status_code=400, detail="Message too long. Maximum 500 characters.")
        
        if len(subject) > 100:
            raise HTTPException(status_code=400, detail="Subject too long. Maximum 100 characters.")
        
        # Создаем тикет
        from core.database import SupportTicket
        ticket = SupportTicket(
            user_id=current_user["id"] if current_user else None,
            user_name=user_name or (current_user["display_name"] if current_user else "Anonymous"),
            user_email=user_email,
            subject=subject,
            message=message,
            status="open",
            priority="medium"
        )
        
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        
        logger.info(f"New support ticket created: ID {ticket.id} by {ticket.user_name}")
        
        return {
            "success": True,
            "ticket_id": ticket.id,
            "message": "Ticket created successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating support ticket: {e}")
        raise HTTPException(status_code=500, detail="Failed to create ticket")

@app.get("/api/admin/support/tickets")
async def get_support_tickets(
    status: str = "all",
    current_user: dict = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Получить все тикеты поддержки (только для админов)"""
    try:
        from core.database import SupportTicket
        
        query = db.query(SupportTicket)
        
        if status != "all":
            query = query.filter(SupportTicket.status == status)
        
        tickets = query.order_by(SupportTicket.created_at.desc()).all()
        
        result = []
        for ticket in tickets:
            result.append({
                "id": ticket.id,
                "user_name": ticket.user_name,
                "user_email": ticket.user_email,
                "subject": ticket.subject,
                "message": ticket.message,
                "status": ticket.status,
                "priority": ticket.priority,
                "admin_notes": ticket.admin_notes,
                "is_archived": getattr(ticket, 'is_archived', False),  # Безопасное получение поля
                "created_at": ticket.created_at.isoformat(),
                "updated_at": ticket.updated_at.isoformat(),
                "closed_at": ticket.closed_at.isoformat() if ticket.closed_at else None
            })
        
        return {"tickets": result}
        
    except Exception as e:
        logger.error(f"Error getting support tickets: {e}")
        raise HTTPException(status_code=500, detail="Failed to get tickets")

@app.put("/api/admin/support/tickets/{ticket_id}")
async def update_support_ticket(
    ticket_id: int,
    status: str = Form(...),
    admin_notes: str = Form(None),
    current_user: dict = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Обновить статус тикета (только для админов)"""
    try:
        from core.database import SupportTicket
        
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        ticket.status = status
        if admin_notes:
            ticket.admin_notes = admin_notes
        
        if status == "closed":
            ticket.closed_at = datetime.utcnow()
        
        ticket.updated_at = datetime.utcnow()
        
        db.commit()
        
        logger.info(f"Support ticket {ticket_id} updated to status: {status}")
        
        return {"success": True, "message": "Ticket updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating support ticket: {e}")
        raise HTTPException(status_code=500, detail="Failed to update ticket")

@app.put("/api/admin/support/tickets/{ticket_id}/archive")
async def archive_support_ticket(
    ticket_id: int,
    current_user: dict = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Архивировать тикет (только для админов)"""
    try:
        from core.database import SupportTicket
        
        # Проверяем существование тикета
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Архивируем тикет
        ticket.is_archived = True
        db.commit()
        
        return {"success": True, "message": "Ticket archived successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error archiving support ticket: {e}")
        raise HTTPException(status_code=500, detail="Failed to archive ticket")

@app.put("/api/admin/support/tickets/{ticket_id}/unarchive")
async def unarchive_support_ticket(
    ticket_id: int,
    current_user: dict = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Извлечь тикет из архива (только для админов)"""
    try:
        from core.database import SupportTicket
        
        # Проверяем существование тикета
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Извлекаем тикет из архива
        ticket.is_archived = False
        db.commit()
        
        return {"success": True, "message": "Ticket unarchived successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unarchiving support ticket: {e}")
        raise HTTPException(status_code=500, detail="Failed to unarchive ticket")

@app.post("/api/admin/support/tickets/{ticket_id}/respond")
async def respond_to_ticket(
    ticket_id: int,
    message: str = Form(...),
    current_user: dict = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Ответить на тикет (только для админов)"""
    try:
        from core.database import SupportTicket, TicketResponse
        
        # Проверяем существование тикета
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Создаем ответ
        response = TicketResponse(
            ticket_id=ticket_id,
            author_id=current_user["id"],
            author_name=current_user["display_name"],
            message=message,
            is_admin_response=True,
            is_read=False
        )
        
        db.add(response)
        
        # Обновляем статус тикета на "in_progress" если он был "open"
        if ticket.status == "open":
            ticket.status = "in_progress"
            ticket.updated_at = datetime.utcnow()
        
        db.commit()
        
        logger.info(f"Admin {current_user['display_name']} responded to ticket {ticket_id}")
        
        return {"success": True, "message": "Response sent successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error responding to ticket: {e}")
        raise HTTPException(status_code=500, detail="Failed to send response")

@app.get("/api/support/tickets/{ticket_id}/responses")
async def get_ticket_responses(
    ticket_id: int,
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Получить ответы на тикет"""
    try:
        from core.database import SupportTicket, TicketResponse
        
        # Проверяем существование тикета
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Проверяем права доступа
        if current_user and ticket.user_id and ticket.user_id != current_user["id"]:
            # Пользователь может видеть только свои тикеты
            raise HTTPException(status_code=403, detail="Access denied")
        elif not current_user and ticket.user_id:
            # Анонимный пользователь не может видеть тикеты зарегистрированных пользователей
            raise HTTPException(status_code=403, detail="Authentication required")
        
        # Получаем ответы
        responses = db.query(TicketResponse).filter(
            TicketResponse.ticket_id == ticket_id
        ).order_by(TicketResponse.created_at.asc()).all()
        
        result = []
        for response in responses:
            result.append({
                "id": response.id,
                "author_name": response.author_name,
                "message": response.message,
                "is_admin_response": response.is_admin_response,
                "is_read": response.is_read,
                "created_at": response.created_at.isoformat()
            })
        
        # Отмечаем ответы как прочитанные (если пользователь аутентифицирован)
        if current_user and ticket.user_id == current_user["id"]:
            for response in responses:
                if response.is_admin_response and not response.is_read:
                    response.is_read = True
            db.commit()
        
        return {"responses": result}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting ticket responses: {e}")
        raise HTTPException(status_code=500, detail="Failed to get responses")

@app.get("/api/support/my-tickets")
async def get_my_tickets(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить тикеты текущего пользователя"""
    try:
        from core.database import SupportTicket, TicketResponse
        
        # Получаем тикеты пользователя
        tickets = db.query(SupportTicket).filter(
            SupportTicket.user_id == current_user["id"]
        ).order_by(SupportTicket.created_at.desc()).all()
        
        result = []
        for ticket in tickets:
            # Получаем количество непрочитанных ответов
            unread_count = db.query(TicketResponse).filter(
                TicketResponse.ticket_id == ticket.id,
                TicketResponse.is_admin_response == True,
                TicketResponse.is_read == False
            ).count()
            
            result.append({
                "id": ticket.id,
                "subject": ticket.subject,
                "message": ticket.message,
                "status": ticket.status,
                "priority": ticket.priority,
                "created_at": ticket.created_at.isoformat(),
                "updated_at": ticket.updated_at.isoformat(),
                "unread_responses": unread_count
            })
        
        return {"tickets": result}
        
    except Exception as e:
        logger.error(f"Error getting user tickets: {e}")
        raise HTTPException(status_code=500, detail="Failed to get tickets")

@app.post("/api/support/tickets/{ticket_id}/respond")
async def user_respond_to_ticket(
    ticket_id: int,
    message: str = Form(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ответ пользователя на тикет"""
    try:
        from core.database import SupportTicket, TicketResponse
        
        # Проверяем существование тикета и права доступа
        ticket = db.query(SupportTicket).filter(
            SupportTicket.id == ticket_id,
            SupportTicket.user_id == current_user["id"]
        ).first()
        
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found or access denied")
        
        # Создаем ответ пользователя
        response = TicketResponse(
            ticket_id=ticket_id,
            author_id=current_user["id"],
            author_name=current_user["display_name"],
            message=message,
            is_admin_response=False,
            is_read=True  # Ответ пользователя считается прочитанным сразу
        )
        
        db.add(response)
        
        # Обновляем время обновления тикета
        ticket.updated_at = datetime.utcnow()
        
        db.commit()
        
        logger.info(f"User {current_user['display_name']} responded to ticket {ticket_id}")
        
        return {"success": True, "message": "Response sent successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error responding to ticket: {e}")
        raise HTTPException(status_code=500, detail="Failed to send response")

# --- Main ---
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
