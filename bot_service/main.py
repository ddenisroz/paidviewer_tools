import os
import uvicorn
from bot_service.database import User, get_db, init_db, StreamData, YouTubeVideo, WhitelistedChannel, BlockedBot

if __name__ == "__main__":
    uvicorn.run(
        "bot_service.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("DEBUG", "false").lower() == "true"
    )
