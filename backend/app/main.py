import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, controls, voices
from app.services.tts_service import tts_service_instance
from app.services.audio_service import audio_service_instance
from app.services.state_service import state_service_instance
from app.bot import Bot

# Basic logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

bot_instance = None
bot_task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global bot_instance, bot_task
    logger.info("Starting application lifespan...")
    
    # Initialize services
    state_service = state_service_instance
    
    # Create bot instance and store it on the app state
    bot_instance = Bot(
        tts_service=tts_service_instance,
        audio_service=audio_service_instance,
        state_service=state_service
    )
    app.state.bot_instance = bot_instance

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
        # Unregister all channels before closing
        current_channels = state_service.get_registered_channels()
        for channel in current_channels:
             # This is optional, but good practice if you want a clean state on next startup
             # state_service.unregister_channel(channel)
             pass
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
app.include_router(auth.router, tags=["Authentication"])
app.include_router(controls.router, prefix="/api", tags=["Controls"])
app.include_router(voices.router, prefix="/api", tags=["Voices"])

@app.get("/")
async def root():
    return {"message": "TTS_TTV API is running"}
