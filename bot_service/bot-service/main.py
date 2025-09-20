import os
import asyncio
import aiohttp
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import RedirectResponse
import uvicorn
from dotenv import load_dotenv
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from twitchio.ext import commands
from pytube import YouTube
from pytube.exceptions import PytubeError
import re
from urllib.error import URLError
import time # Добавляем импорт time
from starlette.websockets import WebSocketDisconnect
from websockets.exceptions import ConnectionClosedOK


# --- Local Imports ---
from database import User, get_db, init_db, StreamData, YouTubeVideo, WhitelistedChannel

# Load .env file from the root directory
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

# --- Logging Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Pydantic Models ---
class WhitelistedChannelPublic(BaseModel):
    id: int
    channel_name: str
    is_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AddToWhitelistRequest(BaseModel):
    username: str
    
class WhitelistResponse(BaseModel):
    whitelist_users: List[WhitelistedChannelPublic]


class YouTubeVideoPublic(BaseModel):
    id: int
    video_id: str
    title: str
    thumbnail: str
    duration: int
    requested_by: str
    url: str
    added_at: datetime

    class Config:
        from_attributes = True

class QueueResponse(BaseModel):
    current_video: Optional[YouTubeVideoPublic] = None
    queue: List[YouTubeVideoPublic] = []
    is_playing: bool = False


class UserPublic(BaseModel):
    id: str
    username: str
    display_name: Optional[str] = None
    avatar: Optional[str] = None
    platform: str
    is_admin: bool = False
    settings: Optional[Dict[str, Any]] = {}

    class Config:
        from_attributes = True

class UpdateTitleRequest(BaseModel):
    title: str

class UpdateCategoryRequest(BaseModel):
    category_id: str

# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"WebSocket connected for user {user_id}")

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"WebSocket for user {user_id} disconnected and removed from manager.")
        else:
            logger.warning(f"Attempted to disconnect WebSocket for user {user_id}, but they were not in manager.")

    async def broadcast(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            try:
                await websocket.send_json(message)
            except (WebSocketDisconnect, ConnectionClosedOK):
                logger.warning(f"Client '{user_id}' disconnected, could not send message. Removing connection.")
                self.disconnect(user_id)

manager = ConnectionManager()

# --- Twitch Bot ---
class Bot(commands.Bot):
    def __init__(self, token, initial_channels, manager_ref):
        super().__init__(token=token, prefix='!', initial_channels=initial_channels)
        self.manager = manager_ref

    async def event_ready(self):
        logger.info(f'Twitch bot logged in as | {self.nick}')
        if not self.connected_channels:
            logger.info('Twitch bot is not connected to any channels initially.')
        else:
            channel_names = [ch.name for ch in self.connected_channels]
            logger.info(f'Twitch bot is listening to channels: {", ".join(channel_names)}')

    async def event_message(self, message):
        if message.echo:
            return
        
        message_data = {
            "type": "chat_message",
            "author": {
                "name": message.author.display_name,
                "color": message.author.color,
                "is_subscriber": message.author.is_subscriber,
                "is_mod": message.author.is_mod,
            },
            "content": message.content,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # This is a simplification. A robust system would map channel names to user IDs.
        # For now, we broadcast to all connected WebSocket clients.
        for user_id in list(self.manager.active_connections.keys()):
            await self.manager.broadcast(message_data, user_id)
        
        await self.handle_commands(message)

    @commands.command(name='sr')
    async def song_request(self, ctx: commands.Context, *, url: str):
        logger.info(f"--- Command !sr triggered by {ctx.author.name} with content: '{url}' ---")
        logger.info(f"--- Channel: {ctx.channel.name}, Bot connected channels: {[ch.name for ch in self.connected_channels]} ---")
        db = next(get_db())
        try:
            channel_owner = db.query(User).filter(User.username == ctx.channel.name.lower()).first()
            if not channel_owner:
                logger.warning(f"Could not find channel owner '{ctx.channel.name.lower()}' in the database for !sr command.")
                await ctx.send("Не удалось найти владельца канала в базе данных.")
                return

            # --- РЕЖИМ ТЕСТИРОВАНИЯ ---
            if url.strip().lower() == 'test':
                logger.info("--- Entering SR Test Mode ---")
                fake_video_data = {
                    'video_id': f'fake_{int(time.time())}',
                    'title': 'Это тестовое видео для проверки очереди',
                    'thumbnail_url': 'https://via.placeholder.com/480x360.png?text=Test+Video',
                    'length': 123,
                    'watch_url': 'https://example.com'
                }
                
                new_video = YouTubeVideo(
                    user_id=channel_owner.id,
                    video_id=fake_video_data['video_id'],
                    title=fake_video_data['title'],
                    thumbnail=fake_video_data['thumbnail_url'],
                    duration=fake_video_data['length'],
                    requested_by=ctx.author.name,
                    url=fake_video_data['watch_url']
                )
                db.add(new_video)
                db.commit()
                
                await ctx.send(f"@{ctx.author.name}, тестовое видео '{fake_video_data['title']}' добавлено в очередь!")
                
                logger.info(f"Broadcasting 'youtube_queue_update' to user_id: {channel_owner.id}")
                await self.manager.broadcast(
                    {"type": "youtube_queue_update"}, 
                    user_id=str(channel_owner.id)
                )
                return # Выходим после обработки тестового случая

            # --- ОБЫЧНАЯ ЛОГИКА ---
            if not re.match(r'^(https?://)?(www\.)?(youtube\.com|youtu\.be)/.+$', url):
                await ctx.send(f"@{ctx.author.name}, ссылка не похожа на YouTube видео.")
                return

            try:
                yt = YouTube(url)
                
                # Проверка на длительность (например, не больше 10 минут)
                if yt.length > 600:
                    await ctx.send(f"@{ctx.author.name}, видео слишком длинное! (макс. 10 минут).")
                    return

                new_video = YouTubeVideo(
                    user_id=channel_owner.id,
                    video_id=yt.video_id,
                    title=yt.title,
                    thumbnail=yt.thumbnail_url,
                    duration=yt.length,
                    requested_by=ctx.author.name,
                    url=yt.watch_url
                )
                db.add(new_video)
                db.commit()
                
                await ctx.send(f"@{ctx.author.name}, видео '{yt.title}' добавлено в очередь!")
                
                # Оповещаем фронтен-д через WebSocket
                logger.info(f"Broadcasting 'youtube_queue_update' to user_id: {channel_owner.id}")
                await self.manager.broadcast(
                    {"type": "youtube_queue_update"}, 
                    user_id=str(channel_owner.id) # Убедимся, что user_id это строка
                )

            except PytubeError as e:
                logger.error(f"Pytube error for url {url}: {e}")
                await ctx.send(f"@{ctx.author.name}, не удалось обработать ссылку. Возможно, видео недоступно.")
            except URLError as e:
                logger.error(f"Network error while contacting YouTube: {e}")
                await ctx.send(f"@{ctx.author.name}, не удалось связаться с сервисами YouTube. Проверьте сетевое соединение и попробуйте позже.")
            except Exception as e:
                logger.error(f"Error adding video to queue: {e}")
                await ctx.send(f"@{ctx.author.name}, произошла внутренняя ошибка при добавлении видео.")

        finally:
            db.close()


# --- Global Bot Instance ---
bot_instance: Optional[Bot] = None
bot_task: Optional[asyncio.Task] = None


# --- Background Tasks ---
async def collect_stream_stats():
    while True:
        await asyncio.sleep(30)
        logger.info("Collecting stream stats...")
        db: Session = next(get_db())
        try:
            client_id = os.getenv("TWITCH_CLIENT_ID")
            client_secret = os.getenv("TWITCH_CLIENT_SECRET")
            users = db.query(User).filter(User.twitch_access_token.isnot(None)).all()
            if not users:
                logger.info("No authenticated users to check for stats.")
                continue
            
            async with aiohttp.ClientSession() as session:
                for user in users:
                    access_token = user.twitch_access_token
                    headers = {"Authorization": f"Bearer {access_token}", "Client-Id": client_id}
                    async with session.get(f"https://api.twitch.tv/helix/streams?user_id={user.id}", headers=headers) as response:
                        if response.status == 401 and user.twitch_refresh_token:
                            logger.info(f"Refreshing token for {user.username}")
                            refresh_params = {'client_id': client_id, 'client_secret': client_secret, 'grant_type': 'refresh_token', 'refresh_token': user.twitch_refresh_token}
                            async with session.post("https://id.twitch.tv/oauth2/token", data=refresh_params) as refresh_resp:
                                if refresh_resp.status == 200:
                                    new_tokens = await refresh_resp.json()
                                    user.twitch_access_token = new_tokens['access_token']
                                    user.twitch_refresh_token = new_tokens['refresh_token']
                                    db.commit()
                                    logger.info(f"Token for {user.username} refreshed.")
                                    continue
                                else:
                                    logger.error(f"Failed to refresh token for {user.username}")
                                    continue
                        
                        if response.status == 200:
                            data = await response.json()
                            if data.get("data"):
                                stream_info = data["data"][0]
                                new_data = StreamData(
                                    user_id=user.id,
                                    platform=user.platform,
                                    stream_id=stream_info.get("id"),
                                    viewer_count=stream_info.get("viewer_count"),
                                    category_name=stream_info.get("game_name"),
                                    timestamp=datetime.utcnow()
                                )
                                db.add(new_data)
                                logger.info(f"Saved stats for {user.username}: {stream_info.get('viewer_count')} viewers")
                            else:
                                logger.info(f"{user.username} is offline.")
                        else:
                            logger.error(f"Error fetching stream data for {user.username}: {response.status}")
            db.commit()
        except Exception as e:
            logger.error(f"Error collecting stream stats: {e}")
            db.rollback()
        finally:
            db.close()

# --- Lifespan Manager ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global bot_instance, bot_task
    logger.info("--- Bot service starting up ---")
    init_db()
    logger.info("Database initialized.")
    
    stats_task = asyncio.create_task(collect_stream_stats())
    logger.info("Stream stats collector task started.")

    bot_token = os.getenv("TWITCH_BOT_ACCESS_TOKEN")
    if bot_token:
        bot_instance = Bot(token=bot_token, initial_channels=[], manager_ref=manager)
        bot_task = asyncio.create_task(bot_instance.start())
        logger.info("Twitch bot task started.")
    else:
        logger.warning("TWITCH_BOT_ACCESS_TOKEN not found. Twitch bot will not be started.")
    
    yield
    
    logger.info("--- Bot service shutting down ---")
    stats_task.cancel()
    if bot_task and not bot_task.done():
        logger.info("Stopping Twitch bot task...")
        if bot_instance:
            await bot_instance.close()
            bot_task.cancel()
            logger.info("Twitch bot task stopped.")

# --- FastAPI App Initialization ---
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not set in the .env file.")
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

# --- Dependencies ---
async def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user_id = request.session.get("user", {}).get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        request.session.clear()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found in database")
    return user

# --- WebSocket Endpoint ---
@app.websocket("/ws/chat/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    logger.info(f"Incoming WebSocket connection for user_id: {user_id}")
    try:
        await manager.connect(websocket, user_id)
        logger.info(f"Successfully accepted WebSocket connection for user {user_id}")
        try:
            while True:
                # Keep the connection alive
                await websocket.receive_text()
        except WebSocketDisconnect:
            logger.info(f"WebSocket for user {user_id} gracefully disconnected.")
            manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"An exception occurred in WebSocket endpoint for user {user_id}: {e}", exc_info=True)
        manager.disconnect(user_id)

# --- Admin Endpoints ---
@app.get("/api/admin/whitelist", response_model=WhitelistResponse)
async def get_whitelist(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin")
    
    whitelist = db.query(WhitelistedChannel).all()
    return {"whitelist_users": whitelist}

@app.post("/api/admin/whitelist/add")
async def add_to_whitelist(request: AddToWhitelistRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin")
    
    channel_name = request.username.lower()
    existing = db.query(WhitelistedChannel).filter(WhitelistedChannel.channel_name == channel_name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Channel already in whitelist")

    new_channel = WhitelistedChannel(channel_name=channel_name)
    db.add(new_channel)
    db.commit()
    return {"success": True, "message": f"Channel {channel_name} added to whitelist"}

@app.delete("/api/admin/whitelist/remove")
async def remove_from_whitelist(request: AddToWhitelistRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin")

    channel_name = request.username.lower()
    channel_to_delete = db.query(WhitelistedChannel).filter(WhitelistedChannel.channel_name == channel_name).first()
    
    if not channel_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found in whitelist")
        
    db.delete(channel_to_delete)
    db.commit()
    return {"success": True, "message": f"Channel {channel_name} removed from whitelist"}

# --- Authentication Endpoints ---
@app.get("/api/auth/twitch/login")
async def login_twitch():
    client_id = os.getenv("TWITCH_CLIENT_ID")
    redirect_uri = os.getenv("TWITCH_REDIRECT_URI")
    scopes = "user:read:email channel:manage:broadcast"
    url = f"https://id.twitch.tv/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scopes.replace(' ', '%20')}"
    return RedirectResponse(url=url)

@app.get("/api/auth/twitch/callback")
async def auth_twitch_callback(code: str, request: Request, db: Session = Depends(get_db)):
    client_id = os.getenv("TWITCH_CLIENT_ID")
    client_secret = os.getenv("TWITCH_CLIENT_SECRET")
    redirect_uri = os.getenv("TWITCH_REDIRECT_URI")
    params = {"client_id": client_id, "client_secret": client_secret, "code": code, "grant_type": "authorization_code", "redirect_uri": redirect_uri}
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post("https://id.twitch.tv/oauth2/token", data=params) as response:
                response.raise_for_status()
                token_data = await response.json()
                access_token = token_data.get("access_token")
                refresh_token = token_data.get("refresh_token")

            headers = {"Authorization": f"Bearer {access_token}", "Client-Id": client_id}
            async with session.get("https://api.twitch.tv/helix/users", headers=headers) as user_response:
                user_response.raise_for_status()
                user_data = (await user_response.json())["data"][0]
                user_id = user_data["id"]

                user = db.query(User).filter(User.id == user_id).first()
                if not user:
                    user = User(id=user_id, username=user_data["login"])
                    db.add(user)
                
                # Обновляем админ статус при каждом входе
                admin_users_str = os.getenv("ADMIN_USERS", "")
                admin_users = [u.strip().lower() for u in admin_users_str.split(",") if u.strip()]
                user.is_admin = user_data["login"].lower() in admin_users
                
                user.twitch_access_token = access_token
                user.twitch_refresh_token = refresh_token
                user.username = user_data["login"]
                user.display_name = user_data["display_name"]
                user.avatar = user_data.get("profile_image_url")
                user.platform = 'twitch'
                db.commit()
                request.session["user"] = {"id": user.id}

    except Exception as e:
        logger.error(f"Error during Twitch callback: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during authentication.")
    
    return RedirectResponse(url=f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/auth/callback")

@app.post("/api/auth/logout")
async def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out successfully"}

@app.get("/api/auth/user/me", response_model=UserPublic)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# --- Bot Control Endpoints ---
@app.post("/api/chat/connect")
async def connect_bot(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not bot_instance:
        raise HTTPException(status_code=503, detail="Twitch bot is not running.")
    
    channel_name = user.username.lower()
    logger.info(f"Connect bot request for channel: {channel_name}")
    
    # Получаем список текущих каналов
    current_channels = [ch.name for ch in bot_instance.connected_channels]
    logger.info(f"Current connected channels: {current_channels}")
    
    if channel_name not in current_channels:
        logger.info(f"Attempting to join channel: {channel_name}")
        await bot_instance.join_channels([channel_name])
        logger.info(f"Bot joined channel: {channel_name}")
        
        # Проверяем, что бот действительно присоединился
        await asyncio.sleep(1)  # Небольшая задержка для стабилизации
        updated_channels = [ch.name for ch in bot_instance.connected_channels]
        logger.info(f"Channels after join attempt: {updated_channels}")
        
        return {"message": f"Bot connected to {channel_name}"}
    
    return {"message": f"Bot is already in channel {channel_name}"}

@app.post("/api/chat/disconnect")
async def disconnect_bot(user: User = Depends(get_current_user)):
    if not bot_instance:
        raise HTTPException(status_code=503, detail="Twitch bot is not running.")
    
    channel_to_leave = user.username.lower()
    if channel_to_leave in [ch.name for ch in bot_instance.connected_channels]:
        await bot_instance.part_channels([channel_to_leave])
        logger.info(f"Bot left channel: {channel_to_leave}")
        return {"message": f"Bot disconnected from {channel_to_leave}"}
    return {"message": f"Bot was not in channel {channel_to_leave}"}

@app.get("/api/chat/status")
async def get_bot_status(user: User = Depends(get_current_user)):
    if not bot_instance:
        return {"is_connected": False}
    channel_name = user.username.lower()
    is_connected = channel_name in [ch.name for ch in bot_instance.connected_channels]
    return {"is_connected": is_connected}

# --- Twitch Stream Management Endpoints ---
@app.get("/api/twitch/stream-info")
async def get_stream_info(user: User = Depends(get_current_user)):
    client_id = os.getenv("TWITCH_CLIENT_ID")
    headers = {"Authorization": f"Bearer {user.twitch_access_token}", "Client-Id": client_id}
    stream_info = {}
    channel_info = {}
    async with aiohttp.ClientSession() as session:
        async with session.get(f"https://api.twitch.tv/helix/channels?broadcaster_id={user.id}", headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                if data.get("data"):
                    channel_info = data["data"][0]
        async with session.get(f"https://api.twitch.tv/helix/streams?user_id={user.id}", headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                if data.get("data"):
                    stream_info = data["data"][0]
    return {
        "title": channel_info.get("title", stream_info.get("title", "")),
        "game_id": channel_info.get("game_id", stream_info.get("game_id", "")),
        "game": channel_info.get("game_name", stream_info.get("game_name", "")),
        "viewers": stream_info.get("viewer_count", 0),
        "is_live": bool(stream_info)
    }

@app.get("/api/twitch/categories")
async def get_categories(search: str, user: User = Depends(get_current_user)):
    client_id = os.getenv("TWITCH_CLIENT_ID")
    headers = {"Authorization": f"Bearer {user.twitch_access_token}", "Client-Id": client_id}
    async with aiohttp.ClientSession() as session:
        if search and search != 'true':
            url = "https://api.twitch.tv/helix/search/categories"
            params = {"query": search}
        else:
            url = "https://api.twitch.tv/helix/games/top"
            params = {}
        async with session.get(url, headers=headers, params=params) as response:
            if response.status == 200:
                return (await response.json()).get("data", [])
    return []

@app.post("/api/twitch/stream/title")
async def update_stream_title(request: UpdateTitleRequest, user: User = Depends(get_current_user)):
    client_id = os.getenv("TWITCH_CLIENT_ID")
    headers = {"Authorization": f"Bearer {user.twitch_access_token}", "Client-Id": client_id, "Content-Type": "application/json"}
    if not request.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty.")
    async with aiohttp.ClientSession() as session:
        async with session.patch(f"https://api.twitch.tv/helix/channels?broadcaster_id={user.id}", headers=headers, json={"title": request.title}) as response:
            if response.status == 204:
                return {"success": True, "message": "Title updated successfully"}
            else:
                error_text = await response.text()
                logger.error(f"Failed to update title for {user.username}: {error_text}")
                raise HTTPException(status_code=response.status, detail=f"Twitch API Error: {error_text}")

@app.post("/api/twitch/stream/category")
async def update_stream_category(request: UpdateCategoryRequest, user: User = Depends(get_current_user)):
    client_id = os.getenv("TWITCH_CLIENT_ID")
    headers = {"Authorization": f"Bearer {user.twitch_access_token}", "Client-Id": client_id, "Content-Type": "application/json"}
    async with aiohttp.ClientSession() as session:
        async with session.patch(f"https://api.twitch.tv/helix/channels?broadcaster_id={user.id}", headers=headers, json={"game_id": request.category_id}) as response:
            if response.status == 204:
                return {"success": True, "message": "Category updated successfully"}
            else:
                error_text = await response.text()
                logger.error(f"Failed to update category for {user.username}: {error_text}")
                raise HTTPException(status_code=response.status, detail=f"Twitch API Error: {error_text}")

# --- Stream History and Stats ---
@app.get("/api/stream/history")
async def get_stream_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    last_entry = db.query(StreamData).filter(StreamData.user_id == user.id).order_by(StreamData.timestamp.desc()).first()
    if not last_entry or not last_entry.stream_id:
        return []
    history = db.query(StreamData).filter(
        StreamData.user_id == user.id,
        StreamData.stream_id == last_entry.stream_id
    ).order_by(StreamData.timestamp.asc()).all()
    return [{
        "time": entry.timestamp.strftime("%H:%M"),
        "viewers": entry.viewer_count,
        "category": entry.category_name,
        "timestamp": entry.timestamp.isoformat() # Добавляем полный timestamp
    } for entry in history]

# --- YouTube Queue Endpoints ---
@app.get("/api/youtube/queue", response_model=QueueResponse)
async def get_youtube_queue(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Возвращает текущее видео и очередь для пользователя."""
    queue_items = db.query(YouTubeVideo).filter(YouTubeVideo.user_id == user.id).order_by(YouTubeVideo.added_at.asc()).all()
    
    current_video = queue_items[0] if queue_items else None
    rest_of_queue = queue_items[1:] if len(queue_items) > 1 else []

    return {
        "current_video": current_video,
        "queue": rest_of_queue,
        "is_playing": current_video is not None
    }

@app.post("/api/youtube/player/next")
async def youtube_player_next(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Удаляет текущее видео из очереди (переключает на следующее)."""
    current_video = db.query(YouTubeVideo).filter(YouTubeVideo.user_id == user.id).order_by(YouTubeVideo.added_at.asc()).first()
    
    if current_video:
        db.delete(current_video)
        db.commit()
        # Оповещаем фронтенд
        await manager.broadcast({"type": "youtube_queue_update"}, user_id=user.id)
        return {"success": True, "message": "Next video"}
    
    return {"success": False, "message": "Queue is empty"}

@app.post("/api/youtube/queue/clear")
async def youtube_queue_clear(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Полностью очищает очередь видео для пользователя."""
    try:
        deleted_count = db.query(YouTubeVideo).filter(YouTubeVideo.user_id == user.id).delete()
        db.commit()
        logger.info(f"Cleared {deleted_count} videos from queue for user {user.username}")
        # Оповещаем фронтенд
        await manager.broadcast({"type": "youtube_queue_update"}, user_id=user.id)
        return {"success": True, "message": "Queue cleared"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error clearing queue for {user.username}: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear queue")


# --- Basic Health Check Endpoint ---
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# --- Main Entry Point ---
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("DEBUG", "false").lower() == "true"
    )
