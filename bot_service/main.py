# bot_service/main.py
import os
import asyncio
import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends, WebSocket, WebSocketDisconnect, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import RedirectResponse
import uvicorn
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
from logging_config import setup_logging, log_system_info, log_service_start, log_service_stop, log_error, log_api_call, log_websocket_event, log_bot_event

from bot_service.database import get_db, init_db, User, GuestVerification, StreamData
from bot_service.session_manager import session_manager
from bot_service.models import *
from bot_service.connection_manager import ConnectionManager
from bot_service.auth import get_current_user, get_current_user_optional, get_admin_user, create_jwt_token
from bot_service.twitch_api import TwitchAPI
from bot_service.vk_auth import router as vk_auth_router
from bot_service.tts_api import TTSAPI
from bot_service.youtube_api import YouTubeAPI
from bot_service.admin_api import AdminAPI
from bot_service.bot import Bot

# Load .env file - сначала из bot_service, потом из корня
bot_service_env = os.path.join(os.path.dirname(__file__), '.env')
root_env = os.path.join(os.path.dirname(__file__), '..', '.env')

# Загружаем сначала bot_service/.env, потом корневой .env (корневой перезаписывает)
if os.path.exists(bot_service_env):
    load_dotenv(dotenv_path=bot_service_env)
    print(f"✅ Загружен .env из bot_service: {bot_service_env}")
else:
    print(f"⚠️  .env не найден в bot_service: {bot_service_env}")

if os.path.exists(root_env):
    load_dotenv(dotenv_path=root_env, override=True)
    print(f"✅ Загружен .env из корня: {root_env}")
else:
    print(f"⚠️  .env не найден в корне: {root_env}")

# --- Logging Configuration ---
log_level = os.getenv("LOG_LEVEL", "DEBUG")
logger = setup_logging("bot_service", log_level)
logger.info("=== BOT SERVICE STARTED ===")

# --- Global Variables ---
connection_manager = ConnectionManager()
twitch_api = TwitchAPI(connection_manager)
tts_api = TTSAPI()
youtube_api = YouTubeAPI()
admin_api = AdminAPI()

bot_instance = None
bot_task = None

# --- Background Tasks ---
async def collect_stream_stats():
    """Сбор статистики стримов для активных пользователей"""
    while True:
        await asyncio.sleep(60)  # Каждую минуту
        try:
            db = next(get_db())
            if not db:
                continue

            # Получаем всех пользователей, у которых есть токен (т.е. они авторизованы)
            active_users = db.query(User).filter(User.twitch_access_token.isnot(None)).all()
            
            for user in active_users:
                try:
                    stream_info = await twitch_api.get_stream_info(user.username)
                    
                    # Если стрим онлайн, сохраняем данные
                    if stream_info and stream_info.get('type') == 'live':
                        new_data = StreamData(
                            user_id=user.id,
                            platform='twitch',
                            stream_id=stream_info.get('id'),
                            viewer_count=stream_info.get('viewer_count', 0),
                            category_name=stream_info.get('game_name', ''),
                            timestamp=datetime.utcnow()
                        )
                        db.add(new_data)
                    else:
                        # Можно добавить логику для оффлайн статуса, если нужно
                        pass

                except Exception as e:
                    logger.error(f"Error collecting stats for user {user.username}: {e}")
            
            db.commit()

        except Exception as e:
            logger.error(f"Error in collect_stream_stats task: {e}")
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
    log_system_info(logger)
    log_service_start(logger, "bot_service", 8000)
    
    # Инициализация базы данных
    init_db()
    
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
    log_service_stop(logger, "bot_service")
    
    if bot_instance:
        await bot_instance.stop_bot()
    
    if bot_task:
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            pass

# --- FastAPI App ---
app = FastAPI(
    title="Bot Service API",
    description="API для управления ботом и интеграциями",
    version="1.0.0",
    lifespan=lifespan
)

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Include Routers ---
app.include_router(vk_auth_router)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SECRET_KEY", "your-secret-key")
)

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

@app.websocket("/ws/obs/{token}")
async def websocket_obs_endpoint(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    await connection_manager.connect_obs(websocket, token)
    try:
        while True:
            data = await websocket.receive_text()
            # Обработка OBS сообщений
    except WebSocketDisconnect:
        await connection_manager.disconnect_obs(token)

# --- Auth Endpoints ---
@app.get("/auth/twitch")
async def login_twitch():
    client_id = os.getenv("TWITCH_CLIENT_ID")
    redirect_uri = "http://localhost:8000/auth/twitch/callback"
    scope = "user:read:email channel:manage:broadcast"
    
    auth_url = f"https://id.twitch.tv/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}"
    return RedirectResponse(url=auth_url)

@app.get("/api/auth/twitch/login")
async def api_login_twitch():
    """API endpoint для Twitch login (для совместимости с фронтендом)"""
    client_id = os.getenv("TWITCH_CLIENT_ID")
    redirect_uri = "http://localhost:8000/auth/twitch/callback"
    scope = "user:read:email channel:manage:broadcast"
    
    auth_url = f"https://id.twitch.tv/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}"
    return {"auth_url": auth_url}

@app.get("/auth/twitch/callback")
async def auth_twitch_callback(code: str, request: Request, db: Session = Depends(get_db)):
    
    # Получаем access token
    token_data = await twitch_api.get_user_access_token(code)
    if not token_data:
        raise HTTPException(status_code=400, detail="Failed to get access token")
    
    # Получаем информацию о пользователе
    user_data = await twitch_api.get_user_from_token(token_data["access_token"])
    if not user_data:
        raise HTTPException(status_code=400, detail="Failed to get user data")
    
    # Создаем или обновляем пользователя в БД
    user = db.query(User).filter(User.id == user_data["id"]).first()
    
    if not user:
        user = User(
            id=user_data["id"],
            username=user_data["login"],
            display_name=user_data["display_name"],
            platform="twitch",
            twitch_access_token=token_data["access_token"],
            twitch_refresh_token=token_data.get("refresh_token"),
            is_admin=False
        )
        db.add(user)
    else:
        user.twitch_access_token = token_data["access_token"]
        user.twitch_refresh_token = token_data.get("refresh_token")
        user.last_login = datetime.utcnow()
    
    db.commit()
    
    # Создаем новую сессию
    session_id = session_manager.create_session(
        user_id=user_data["id"],
        platform="twitch",
        device_info={
            "user_agent": request.headers.get("user-agent"),
            "ip": request.client.host
        }
    )
    
    # Сохраняем токены в новой системе
    expires_at = None
    if "expires_in" in token_data:
        expires_at = datetime.utcnow() + timedelta(seconds=token_data["expires_in"])
    
    session_manager.save_user_tokens(
        user_id=user_data["id"],
        platform="twitch",
        access_token=token_data["access_token"],
        refresh_token=token_data.get("refresh_token"),
        expires_at=expires_at
    )
    
    # Создаем JWT токен
    jwt_token = create_jwt_token(user.id)
    
    # Устанавливаем cookie с session_id
    response = RedirectResponse(f"http://localhost:5173/dashboard?token={jwt_token}")
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=86400  # 24 часа
    )
    
    return response

@app.post("/auth/logout")
async def logout(request: Request, response: Response):
    
    # Завершаем сессию
    session_id = request.cookies.get("session_id")
    if session_id:
        session_manager.terminate_session(session_id, "logout")
        response.delete_cookie("session_id")
    
    # Очищаем старую сессию
    request.session.clear()
    return {"message": "Logged out successfully"}

@app.post("/api/auth/logout")
async def api_logout(request: Request, response: Response):
    """API endpoint для logout (для совместимости с фронтендом)"""
    
    # Завершаем сессию
    session_id = request.cookies.get("session_id")
    if session_id:
        session_manager.terminate_session(session_id, "logout")
        response.delete_cookie("session_id")
    
    # Очищаем старую сессию
    request.session.clear()
    return {"message": "Logged out successfully"}

@app.get("/api/auth/user/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.get("/api/auth/session/status")
async def get_session_status(request: Request):
    """Получить статус текущей сессии"""
    from bot_service.auth import get_session_data, is_guest_session, get_active_platforms
    
    session_data = get_session_data(request)
    if not session_data:
        return {"authenticated": False}
    
    return {
        "authenticated": True,
        "is_guest": is_guest_session(request),
        "platforms": get_active_platforms(request),
        "user": {
            "id": session_data["user_id"],
            "username": session_data["username"],
            "display_name": session_data["display_name"],
            "is_admin": session_data["is_admin"]
        }
    }

# --- Bot Management Endpoints ---
@app.post("/api/chat/connect")
async def connect_bot(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    global bot_instance, bot_task
    
    if not bot_instance:
        # Создаем нового бота
        bot_token = os.getenv("TWITCH_BOT_TOKEN")
        if not bot_token:
            raise HTTPException(status_code=500, detail="TWITCH_BOT_TOKEN not configured")
        
        bot_instance = Bot(bot_token, [user.username], connection_manager)
        bot_task = asyncio.create_task(bot_instance.start_bot())
        
        # Ждем подключения
        await asyncio.sleep(2)
    
    # Подключаемся к каналу (whitelist проверка только для TTS функций)
    success = await bot_instance.join_channel(user.username)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to connect to channel")
    
    return {"message": f"Bot connected to {user.username}"}

@app.post("/api/chat/disconnect")
async def disconnect_bot(user: User = Depends(get_current_user)):
    global bot_instance
    
    if not bot_instance:
        raise HTTPException(status_code=400, detail="Bot not running")
    
    success = await bot_instance.leave_channel(user.username)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to disconnect from channel")
    
    return {"message": f"Bot disconnected from {user.username}"}

@app.get("/api/chat/status")
async def get_bot_status(user: User = Depends(get_current_user)):
    if not bot_instance:
        return {"connected": False, "message": "Bot not running"}
    
    is_connected = bot_instance.is_connected_to_channel(user.username)
    return {"connected": is_connected, "message": f"Bot {'connected' if is_connected else 'not connected'} to {user.username}"}

@app.post("/api/chat/reconnect")
async def reconnect_bot(user: User = Depends(get_current_user)):
    """Принудительное переподключение к каналу"""
    global bot_instance
    
    if not bot_instance:
        raise HTTPException(status_code=400, detail="Bot not running")
    
    # Сначала отключаемся
    await bot_instance.leave_channel(user.username)
    await asyncio.sleep(1)
    
    # Затем подключаемся заново
    success = await bot_instance.join_channel(user.username)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to reconnect to channel")
    
    return {"message": f"Bot reconnected to {user.username}"}

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
            
        except Exception as e:
            logger.error(f"Error checking verification age: {e}")
            raise HTTPException(status_code=400, detail="Verification check failed")
        
        # Канал верифицирован и недавно, разрешаем переподключение
        logger.info(f"Reconnecting to verified channel: {channel_name}")
        return {
            "message": f"Reconnected to {channel_name}",
            "verification_required": False,
            "verified": True
        }
    
    # Если канал не верифицирован, возвращаем ошибку
    raise HTTPException(status_code=400, detail="Channel not verified")

@app.post("/api/chat/guest/connect")
async def connect_bot_guest(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    channel_name = data.get("channel_name", "").lower()
    
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name required")
    
    # Проверяем, не заблокирован ли канал
    try:
        from bot_service.database import get_db, BlockedChannel
        db_gen = get_db()
        db = next(db_gen)
        try:
            blocked_channel = db.query(BlockedChannel).filter(
                BlockedChannel.channel_name == channel_name,
                BlockedChannel.is_active == True
            ).first()
            
            if blocked_channel:
                logger.warning(f"Attempt to connect to blocked channel: {channel_name}")
                raise HTTPException(
                    status_code=403, 
                    detail=f"Channel {channel_name} is blocked. Reason: {blocked_channel.reason or 'No reason provided'}"
                )
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to check if channel is blocked: {e}")
        # В случае ошибки проверки блокировки, продолжаем (не блокируем подключение)
    
    # Проверяем, нет ли активных авторизованных сессий для этого канала
    try:
        from bot_service.database import get_db, User
        db_gen = get_db()
        db = next(db_gen)
        try:
            # Ищем авторизованных пользователей с таким каналом
            authorized_users = db.query(User).filter(
                User.username == channel_name,
                User.twitch_access_token.isnot(None)  # У пользователя есть активный токен
            ).all()
            
            if authorized_users:
                logger.warning(f"Guest attempt to connect to channel with active authorized session: {channel_name}")
                
                # Отправляем уведомление авторизованным пользователям о попытке гостевого входа
                try:
                    from bot_service.websocket_manager import websocket_manager
                    websocket_manager.broadcast_to_channel(channel_name, {
                        "type": "session_conflict",
                        "data": {
                            "message": f"Попытка гостевого входа в канал {channel_name}",
                            "channel": channel_name,
                            "timestamp": time.time()
                        }
                    })
                except Exception as e:
                    logger.error(f"Failed to send session conflict notification: {e}")
                
                # Возвращаем специальный код для обработки конфликта сессий
                return {
                    "message": f"Channel {channel_name} has an active authorized session",
                    "conflict": True,
                    "authorized_users": [user.username for user in authorized_users],
                    "verification_required": True,
                    "verification_code": "CONFLICT_SESSION",  # Специальный код для конфликта
                    "timeout": 60
                }
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to check for session conflicts: {e}")
        # В случае ошибки проверки конфликтов, продолжаем (не блокируем подключение)
    
    # Подключаемся к каналу (whitelist проверка только для TTS функций)
    global bot_instance
    if not bot_instance:
        logger.info("Creating new bot instance...")
        bot_token = os.getenv("TWITCH_BOT_TOKEN")
        if not bot_token:
            raise HTTPException(status_code=500, detail="TWITCH_BOT_TOKEN not configured")
        
        bot_instance = Bot(bot_token, [], connection_manager)
        logger.info("Bot instance created, starting bot...")
        asyncio.create_task(bot_instance.start_bot())
        await asyncio.sleep(2)
        logger.info("Bot startup task created")
    else:
        logger.info("Bot instance already exists")
    
    # Проверяем, не подключен ли уже бот к каналу
    if channel_name in connection_manager.pending_verifications:
        # Очищаем старую верифицированную сессию для безопасности
        connection_manager.clear_verified_session(channel_name)
        
        # Бот уже подключен, но для безопасности всегда требуем новую верификацию
        # Это предотвращает вход с других устройств без верификации
        logger.info(f"Bot already connected to channel: {channel_name}, requiring new verification for security")
        
        # Генерируем новый код верификации
        import secrets
        verification_code = secrets.token_urlsafe(8)
        
        # Обновляем существующую запись верификации
        connection_manager.pending_verifications[channel_name] = {
            "channel": channel_name,
            "code": verification_code,
            "timestamp": time.time(),
            "verified": False
        }
        
        return {
            "message": f"Bot already connected to {channel_name}, new verification required",
            "verification_required": True,
            "verification_code": verification_code,
            "timeout": 60
        }
    
    logger.info(f"Attempting to join channel: {channel_name}")
    success = await bot_instance.join_channel(channel_name)
    if not success:
        logger.error(f"Failed to connect to channel: {channel_name}")
        raise HTTPException(status_code=500, detail="Failed to connect to channel")
    
    # Генерируем код верификации
    import secrets
    verification_code = secrets.token_urlsafe(8)
    
    # Сохраняем код верификации в connection_manager для доступа из бота
    verification_data = {
        "channel": channel_name,
        "code": verification_code,
        "timestamp": time.time(),
        "verified": False
    }
    
    # Сохраняем в connection_manager для доступа из бота
    connection_manager.pending_verifications[channel_name] = verification_data
    
    logger.info(f"Successfully connected to channel: {channel_name}, verification code: {verification_code}")
    return {
        "message": f"Bot connected to {channel_name}",
        "verification_required": True,
        "verification_code": verification_code,
        "timeout": 60
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
    
    # Очищаем данные верификации из базы данных
    try:
        verification = db.query(GuestVerification).filter(
            GuestVerification.channel_name == channel_name
        ).first()
        if verification:
            db.delete(verification)
            db.commit()
            logger.info(f"Cleared verification data from database for channel: {channel_name}")
    except Exception as e:
        logger.error(f"Failed to clear verification data from database: {e}")
    
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
    
    # Проверяем whitelist
    from bot_service.database import WhitelistedChannel
    from sqlalchemy import func
    whitelisted = db.query(WhitelistedChannel).filter(
        func.lower(WhitelistedChannel.channel_name) == channel_name
    ).first()
    
    # Проверяем верификацию
    is_verified = connection_manager.is_verified(channel_name)
    
    # Добавляем логирование для отладки
    logger.info(f"Guest status check for {channel_name}: connected={is_connected}, verified={is_verified}, pending_verifications={list(connection_manager.pending_verifications.keys())}")
    
    return {
        "connected": is_connected,
        "is_whitelisted": whitelisted is not None,
        "verified": is_verified
    }

@app.get("/api/chat/guest/check-blocked")
async def check_guest_blocked(channel_name: str, db: Session = Depends(get_db)):
    """Проверяет, заблокирован ли канал для гостевого режима"""
    channel_name = channel_name.lower()
    
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name required")
    
    # Проверяем, есть ли АКТИВНАЯ сессия с таким каналом
    
    # Проверяем активные сессии пользователей
    active_user_sessions = db.query(User).filter(
        User.username == channel_name,
        User.session_id.isnot(None)  # Есть активная сессия
    ).all()
    
    if active_user_sessions:
        return {
            "blocked": True,
            "message": "Этот канал заблокирован для гостевого режима. Пожалуйста, авторизуйтесь через Twitch."
        }
    
    return {
        "blocked": False,
        "message": "Канал доступен для гостевого режима"
    }


# --- Twitch API Endpoints ---
@app.get("/api/twitch/stream")
async def get_stream_info(user: User = Depends(get_current_user)):
    stream_info = await twitch_api.get_stream_info(user.username)
    return stream_info or {"online": False}

@app.get("/api/twitch/stream-info")
async def get_stream_info_detailed(user: User = Depends(get_current_user), force: bool = False):
    """Получить детальную информацию о стриме"""
    # Проверяем кэш, если не принудительное обновление
    if not force:
        cache_key = f"stream_info_{user.username}"
        cached = connection_manager.get_twitch_cache(cache_key)
        if cached:
            logger.info(f"Using cached stream info for {user.username}")
            return cached
    
    stream_info = await twitch_api.get_stream_info(user.username)
    
    # Если стрим офлайн, получаем информацию о канале
    if not stream_info:
        channel_info = await twitch_api.get_channel_info(user.username)
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
    cache_key = f"stream_info_{user.username}"
    connection_manager.update_twitch_cache(cache_key, result)
    
    logger.info(f"Stream info for {user.username}: {result}")
    return result

@app.get("/api/twitch/categories")
async def get_categories(search: str, user: User = Depends(get_current_user)):
    categories = await twitch_api.search_categories(search)
    return categories  # Возвращаем массив напрямую

@app.post("/api/twitch/title")
async def update_stream_title(request: UpdateTitleRequest, user: User = Depends(get_current_user)):
    success = await twitch_api.update_stream_title(user.id, user.twitch_access_token, request.title)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update title")
    return {"message": "Title updated successfully"}

@app.post("/api/twitch/stream/title")
async def update_stream_title_alt(request: UpdateTitleRequest, user: User = Depends(get_current_user)):
    """Альтернативный endpoint для обновления названия стрима"""
    success = await twitch_api.update_stream_title(user.id, user.twitch_access_token, request.title)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update title")
    return {"success": True, "message": "Title updated successfully"}

@app.post("/api/twitch/category")
async def update_stream_category(request: UpdateCategoryRequest, user: User = Depends(get_current_user)):
    logger.info(f"Update category request: {request}")
    logger.info(f"CategoryId: {request.categoryId}")
    logger.info(f"User ID: {user.id}")
    logger.info(f"User access token exists: {bool(user.twitch_access_token)}")
    
    # Получаем текущую категорию для сравнения
    current_stream_info = await twitch_api.get_stream_info(user.username)
    if current_stream_info and current_stream_info.get("game_id") == request.categoryId:
        logger.info(f"Category {request.categoryId} is already set, skipping update")
        return {"success": True, "message": "Category is already set"}
    
    success = await twitch_api.update_stream_category(user.id, user.twitch_access_token, request.categoryId)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update category")
    return {"success": True, "message": "Category updated successfully"}

@app.get("/api/stream/history")
async def get_stream_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить историю стрима"""
    from bot_service.database import StreamData
    last_entry = db.query(StreamData).filter(StreamData.user_id == user.id).order_by(StreamData.timestamp.desc()).first()
    
    if not last_entry:
        return {"history": [], "current_viewers": 0, "status": "offline"}
    
    # Получаем последние 100 записей
    history = db.query(StreamData).filter(
        StreamData.user_id == user.id
    ).order_by(StreamData.timestamp.desc()).limit(100).all()

    return {
        "history": [
            {
                "timestamp": entry.timestamp.isoformat(),
                "viewers": entry.viewers,
                "category": entry.category,
                "title": entry.title
            }
            for entry in history
        ],
        "current_viewers": last_entry.viewers,
        "status": "online" if last_entry.viewers > 0 else "offline"
    }

# --- TTS Endpoints ---
@app.post("/api/tts/enable")
async def enable_tts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Проверяем whitelist для TTS
    from bot_service.database import WhitelistedChannel
    from sqlalchemy import func
    whitelisted = db.query(WhitelistedChannel).filter(
        func.lower(WhitelistedChannel.channel_name) == user.username.lower()
    ).first()
    
    if not whitelisted:
        raise HTTPException(status_code=403, detail="Channel not whitelisted for TTS")
    
    success = await tts_api.enable_tts(user.username)
    if success:
        connection_manager.enable_tts(user.username)
    return {"enabled": success}

@app.post("/api/tts/disable")
async def disable_tts(user: User = Depends(get_current_user)):
    success = await tts_api.disable_tts(user.username)
    if success:
        connection_manager.disable_tts(user.username)
    return {"enabled": not success}

@app.get("/api/tts/status")
async def get_tts_status(request: Request, user: User = Depends(get_current_user_optional)):
    # Получаем channel_name из query параметров для гостевых пользователей
    channel_name = request.query_params.get("channel_name")
    
    if user and not user.is_guest:
        # Авторизованный пользователь
        is_enabled = connection_manager.is_tts_enabled(user.username)
        return {"enabled": is_enabled}
    elif channel_name:
        # Гостевой пользователь с указанным каналом
        is_enabled = connection_manager.is_tts_enabled(channel_name.lower())
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
    from bot_service.database import WhitelistedChannel
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

@app.post("/api/tts/generate-obs-url")
async def generate_obs_url(user: User = Depends(get_current_user)):
    """Генерировать URL для OBS WebSocket"""
    import jwt
    import time
    
    SECRET_KEY = os.getenv("SECRET_KEY")
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="SECRET_KEY not configured")
    
    # Создаем токен для OBS
    obs_token = jwt.encode({
        "user_id": user.id,
        "username": user.username,
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600  # 1 час
    }, SECRET_KEY, algorithm="HS256")
    
    return ObsUrlResponse(obs_token=obs_token)

# --- YouTube Endpoints ---
@app.get("/api/youtube/queue")
async def get_youtube_queue(user: User = Depends(get_current_user)):
    queue = connection_manager.get_youtube_queue(user.id)
    current_video = connection_manager.get_current_video(user.id)
    
    return QueueResponse(
        current_video=current_video,
        queue=queue,
        is_playing=bool(current_video)
    )

@app.post("/api/youtube/queue")
async def add_to_youtube_queue(request: dict, user: User = Depends(get_current_user)):
    url = request.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL required")
    
    video_info = youtube_api.get_video_info(url)
    if not video_info:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    connection_manager.add_to_youtube_queue(user.id, video_info)
    return {"message": "Video added to queue"}

@app.post("/api/youtube/next")
async def youtube_player_next(user: User = Depends(get_current_user)):
    next_video = connection_manager.next_youtube_video(user.id)
    if next_video:
        return {"message": "Switched to next video", "video": next_video}
    else:
        return {"message": "No videos in queue"}

@app.post("/api/youtube/clear")
async def youtube_queue_clear(user: User = Depends(get_current_user)):
    connection_manager.clear_youtube_queue(user.id)
    return {"message": "Queue cleared"}

# --- Admin Endpoints ---
@app.get("/api/admin/whitelist")
async def get_whitelist(user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.get_whitelist(db)

@app.post("/api/admin/whitelist")
async def add_to_whitelist(request: AddToWhitelistRequest, user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.add_to_whitelist(request, db)

@app.delete("/api/admin/whitelist")
async def remove_from_whitelist(request: AddToWhitelistRequest, user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.remove_from_whitelist(request, db)

@app.post("/api/admin/whitelist/add")
async def add_to_whitelist_add(request: AddToWhitelistRequest, user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.add_to_whitelist(request, db)

@app.delete("/api/admin/whitelist/remove")
async def remove_from_whitelist_remove(request: AddToWhitelistRequest, user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.remove_from_whitelist(request, db)

@app.get("/api/admin/blocked-bots")
async def get_blocked_bots(user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.get_blocked_bots(db)

@app.post("/api/admin/blocked-bots")
async def add_blocked_bot(request: AddBlockedBotRequest, user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.add_blocked_bot(request, db)

@app.delete("/api/admin/blocked-bots/{bot_name}")
async def remove_blocked_bot(bot_name: str, user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.remove_blocked_bot(bot_name, db)

@app.get("/api/admin/users")
async def get_users(user: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return await admin_api.get_users(db)

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
async def get_active_sessions():
    """Получить список активных сессий"""
    sessions = []
    
    # Получаем все pending verifications
    for channel, verification in connection_manager.pending_verifications.items():
        is_verified = channel in connection_manager.verified_sessions
        sessions.append({
            "channel": channel,
            "is_verified": is_verified,
            "code": verification.get("code", ""),
            "timestamp": verification.get("timestamp", 0),
            "created_at": datetime.fromtimestamp(verification.get("timestamp", 0)).isoformat() if verification.get("timestamp") else None
        })
    
    return {"sessions": sessions}

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
        from bot_service.database import get_db, GuestVerification
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
        from bot_service.database import get_db, GuestVerification
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
        from bot_service.database import get_db, BlockedChannel
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
        
        from bot_service.database import get_db, BlockedChannel
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
        
        from bot_service.database import get_db, BlockedChannel
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
        
        from bot_service.database import get_db, BlockedChannel
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
    current_user_id = request.session.get("user_id")
    if not current_user_id:
        return {"channels": []}
    
    # Получаем активных пользователей
    from bot_service.database import User, StreamData
    active_users = db.query(User).filter(User.id == current_user_id).all()
    
    channels = []
    for user in active_users:
        # Проверяем, есть ли недавние данные о стриме
        recent_stream = db.query(StreamData).filter(
            StreamData.user_id == user.id
        ).order_by(StreamData.timestamp.desc()).first()
        
        is_online = False
        if recent_stream:
            # Считаем онлайн, если последние данные были не более 5 минут назад
            five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
            is_online = recent_stream.timestamp > five_minutes_ago
        
        channels.append({
            "username": user.username,
            "display_name": user.display_name,
            "platform": user.platform,
            "is_online": is_online,
            "avatar": user.avatar
        })
    
    return {"channels": channels}

# --- Health Check ---
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# --- Main ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
