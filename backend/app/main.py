import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, bot_controls, voices, settings, commands, twitch_api, vk_api, bot_control, chat
from app.core.config import settings as app_settings
from app.bot import Bot
from app.services.state_service import StateService
from app.services.tts_service import TTSService
from app.services.audio_service import AudioService
from app.core.exceptions import http_exception_handler

# Basic logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    logger.info("Initializing services...")
    state_service = StateService()
    await state_service.initialize()  # Asynchronously load state
    
    # Принудительно сохраняем состояние при запуске
    await state_service._save_state_to_disk()
    logger.info("State service initialized and saved to disk")

    # TTS будет загружаться по требованию
    tts_service = None
    audio_service = AudioService()
    logger.info("TTS service will be loaded on demand")

    # Create the Bot instance within the lifespan context
    bot_instance = Bot(
        state_service=state_service,
        tts_service=tts_service,
        audio_service=audio_service,
    )

    app.state.state_service = state_service
    app.state.tts_service = tts_service
    app.state.audio_service = audio_service
    app.state.bot = bot_instance
    
    logger.info("Twitch bot is starting...")
    # Use bot.start() for integration with an existing asyncio loop
    bot_task = asyncio.create_task(bot_instance.start())
    
    # Rejoin channels from the previous session only if Twitch integration is enabled
    all_channels = state_service.get_all_channels()
    logger.info(f"All channels found: {all_channels}")
    
    channels_to_join = []
    for channel in all_channels:
        integrations = state_service.get_integrations(channel)
        logger.info(f"Channel {channel} integrations: {integrations}")
        if integrations.get("twitch_enabled"):
            channels_to_join.append(channel)
    
    if channels_to_join:
        logger.info(f"Rejoining channels with active Twitch integration: {channels_to_join}")
        # Give the bot a moment to connect before trying to join channels
        await asyncio.sleep(2) 
        await bot_instance.join_channels(channels_to_join)
    else:
        logger.info("No channels to rejoin")

    yield

    # Shutdown
    logger.info("Application shutdown: stopping Twitch bot.")
    await bot_instance.close()
    if not bot_task.done():
        bot_task.cancel()

app = FastAPI(title=app_settings.PROJECT_NAME, lifespan=lifespan)

# Add exception handlers
app.add_exception_handler(Exception, http_exception_handler)

# CORS Middleware - This needs to be defined BEFORE routes for some edge cases
origins = [
    app_settings.CLIENT_ORIGIN,
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth.router)
app.include_router(bot_controls.router)
app.include_router(voices.router)
app.include_router(settings.router)
app.include_router(commands.router)
app.include_router(twitch_api.router, prefix="/api/twitch", tags=["twitch"])
app.include_router(vk_api.router, prefix="/api/vk", tags=["vk"])
app.include_router(bot_control.router, prefix="/api/bot", tags=["bot"])
app.include_router(chat.router)

@app.get("/")
async def root():
    return {"message": "TTS_TTV API is running"}

@app.get("/api/status/{channel_name}")
async def get_status(channel_name: str):
    """Simple status endpoint for frontend compatibility."""
    return {"channel_name": channel_name, "is_enabled": True}
