import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, controls, voices, settings
from app.services.tts_service import TTSService
from app.services.audio_service import AudioService
from app.services.state_service import StateService
from app.bot import Bot
from app.services.seventv_service import SevenTVService

# Basic logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting application lifespan...")
    
    # Initialize services
    state_service = StateService()
    audio_service = AudioService()
    tts_service = TTSService(state_service=state_service)
    seventv_service = SevenTVService()
    
    # Create bot instance and store it on the app state
    bot_instance = Bot(
        tts_service=tts_service,
        audio_service=audio_service,
        state_service=state_service,
        seventv_service=seventv_service
    )
    
    # Store instances on the app state to make them accessible from endpoints
    app.state.bot = bot_instance
    app.state.state_service = state_service
    app.state.tts_service = tts_service
    app.state.audio_service = audio_service


    # Start the bot in a background task
    bot_task = asyncio.create_task(bot_instance.start())
    logger.info("Twitch bot is starting...")
    
    # Wait for the bot to connect before trying to join channels
    await asyncio.sleep(5)  
    
    # Rejoin channels from the previous session
    registered_channels = state_service.get_registered_channels()
    if registered_channels:
        logger.info(f"Rejoining channels from previous session: {registered_channels}")
        for channel in registered_channels:
            # We use create_task to avoid blocking the startup process
            asyncio.create_task(bot_instance.add_channel(channel))
    else:
        logger.info("No channels from previous session to rejoin.")
    
    yield
    
    logger.info("Shutting down application lifespan...")
    if bot_instance:
        logger.info("Stopping Twitch bot...")
        await bot_instance.close()
    
    if bot_task and not bot_task.done():
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            logger.info("Bot task cancelled successfully.")

app = FastAPI(title="TTS_TTV", version="0.0.1", lifespan=lifespan)

# CORS Configuration
origins = ["http://localhost:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api", tags=["Authentication"])
app.include_router(controls.router, prefix="/api", tags=["Controls"])
app.include_router(voices.router, prefix="/api", tags=["Voices"])
app.include_router(settings.router, prefix="/api", tags=["Settings"])

@app.get("/")
async def root():
    return {"message": "TTS_TTV API is running"}
