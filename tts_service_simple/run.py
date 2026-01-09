#!/usr/bin/env python3
import uvicorn
from app.core.config import config
import os

if __name__ == "__main__":
    # Allow override port via env
    port = int(os.getenv("PORT", config.get('port', 8000)))
    host = os.getenv("HOST", config.get('host', "0.0.0.0"))
    
    print(f"Starting TTS Service on {host}:{port}")
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=True
    )
