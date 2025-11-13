# Design Document: Application Stabilization and Optimization

## Overview

This design document outlines the technical approach for stabilizing and optimizing the TTS_TTV_0.02 streaming application. The optimization focuses on seven key areas: performance improvements, code cleanup, error handling, UI/UX enhancements, state synchronization, dependency management, and deployment portability. The design respects protected systems (TTS, Category Management) documented in `DO_NOT_TOUCH.md` while improving overall application quality.

### Key Requirements

1. **Deployment Portability:** Easy migration to different machines without hardcoded values
2. **Distributed Architecture:** TTS service (local PC + Cloudflare) separate from bot service (remote PC)
3. **WebSocket Optimization:** Single connection per browser (not per tab) with proper reconnection
4. **Resource Management:** Disable TTS generation when no active connections (OBS/website)
5. **Drops System Separation:** Business logic (probability calculation) separate from UI (animation widget)
6. **Platform Extensibility:** Architecture ready for adding new platforms (Kick, YouTube Live, etc.)
7. **Feature Scalability:** Code structure supports adding new features without major refactoring
8. **Error Resilience:** Application must never crash for end users - all errors handled gracefully
9. **Permission Isolation:** Admin and user functions strictly separated, even if similar (e.g., voice upload)
10. **Platform API Integration:** Commands, roles, and channel points properly synchronized with platform APIs (Twitch, VK)

## Architecture

### Current Architecture Analysis

**Frontend (React 19 + Vite):**
- Context API for global state (8 contexts)
- React Query for data fetching and caching
- SharedWebSocket with Leader Election pattern
- Component-based architecture with shadcn/ui
- TypeScript migration in progress (allowJs: true)

**Backend (FastAPI + Python 3.11):**
- RESTful API with dependency injection
- SQLAlchemy ORM with Alembic migrations
- WebSocket for real-time communication
- JWT + OAuth2 authentication
- Rate limiting with slowapi

**Key Issues Identified:**
1. No code splitting - entire app loads at once
2. Potential unused dependencies and dead code
3. Inconsistent error handling patterns
4. State synchronization gaps between frontend/backend
5. Missing validation in some API endpoints
6. Performance bottlenecks in re-renders

### Target Architecture

The optimized architecture maintains the current structure while introducing:
- Lazy loading and code splitting for non-critical routes
- Centralized error handling with consistent patterns
- Optimistic updates with automatic rollback
- Enhanced validation layer (frontend + backend)
- Performance monitoring and optimization hooks

## Components and Interfaces

### 0. Configuration and Deployment Layer

#### 0.1 Environment Configuration

**Configuration Structure:**
```
.env.example              # Template with all required variables
.env                      # Local configuration (gitignored)
.env.production          # Production overrides (gitignored)
docker-compose.yml       # Development setup
docker-compose.prod.yml  # Production setup
```

**Environment Variables (bot_service/.env):**
```bash
# === DATABASE ===
DATABASE_URL=sqlite:///./data/bot_service.db  # Dev
# DATABASE_URL=postgresql://user:pass@host:5432/dbname  # Prod

# === SERVICES ===
BOT_SERVICE_HOST=0.0.0.0
BOT_SERVICE_PORT=8000
TTS_SERVICE_URL=http://localhost:8001  # Local or remote TTS service
FRONTEND_URL=http://localhost:5173     # Dev
# FRONTEND_URL=https://yourdomain.com  # Prod

# === SECURITY ===
SECRET_KEY=your-secret-key-here  # Generate with: openssl rand -hex 32
JWT_SECRET_KEY=your-jwt-secret   # Generate with: openssl rand -hex 32
ENCRYPTION_KEY=your-fernet-key   # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# === OAUTH CREDENTIALS ===
TWITCH_CLIENT_ID=your-twitch-client-id
TWITCH_CLIENT_SECRET=your-twitch-secret
TWITCH_REDIRECT_URI=http://localhost:8000/auth/twitch/callback

VK_CLIENT_ID=your-vk-client-id
VK_CLIENT_SECRET=your-vk-secret
VK_REDIRECT_URI=http://localhost:8000/auth/vk/callback

DONATION_ALERTS_CLIENT_ID=your-da-client-id
DONATION_ALERTS_CLIENT_SECRET=your-da-secret
DONATION_ALERTS_REDIRECT_URI=http://localhost:8000/auth/donationalerts/callback

# === EXTERNAL APIS ===
GOOGLE_TTS_API_KEY=your-google-tts-key  # Optional, for Google TTS
YOUTUBE_API_KEY=your-youtube-key        # Optional, for YouTube features

# === RATE LIMITING ===
RATE_LIMIT_DEFAULT=60/minute
RATE_LIMIT_LOGIN=5/15minute
RATE_LIMIT_TTS=30/minute

# === LOGGING ===
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_FILE=logs/bot_service.log
```

**Environment Variables (tts_service/.env):**
```bash
# === SERVICE ===
TTS_SERVICE_HOST=0.0.0.0
TTS_SERVICE_PORT=8001
BOT_SERVICE_URL=http://localhost:8000  # Or remote bot service

# === TTS ENGINE SELECTION ===
TTS_ENGINE=f5  # Options: f5, simple, google
# f5 = F5-TTS (high quality, requires GPU)
# simple = tts_service_simple (lightweight, CPU-friendly)
# google = Google Cloud TTS (cloud-based)

# === F5-TTS CONFIGURATION (if TTS_ENGINE=f5) ===
F5_TTS_MODEL_PATH=./models/f5_tts
F5_TTS_DEVICE=cuda  # cuda, cpu, or mps (Mac)
F5_TTS_MAX_WORKERS=2

# === SIMPLE TTS CONFIGURATION (if TTS_ENGINE=simple) ===
SIMPLE_TTS_SERVICE_URL=http://localhost:8002  # tts_service_simple endpoint
SIMPLE_TTS_VOICE=ru  # Default voice
SIMPLE_TTS_SPEED=1.0  # Speech speed

# === GOOGLE TTS CONFIGURATION (if TTS_ENGINE=google) ===
GOOGLE_TTS_API_KEY=your-google-tts-key
GOOGLE_TTS_LANGUAGE=ru-RU

# === CLOUDFLARE TUNNEL (Production) ===
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token
# Tunnel will expose TTS service securely

# === SECURITY ===
ALLOWED_ORIGINS=http://localhost:8000,http://localhost:5173
# ALLOWED_ORIGINS=https://yourdomain.com  # Prod

# === LOGGING ===
LOG_LEVEL=INFO
LOG_FILE=logs/tts_service.log
```

**Environment Variables (tts_service_simple/.env):**
```bash
# === SERVICE ===
TTS_SIMPLE_HOST=0.0.0.0
TTS_SIMPLE_PORT=8001  # Same port as TTS Service

# === F5-TTS CONFIGURATION (same as TTS Service) ===
F5_TTS_MODEL_PATH=./models/f5_tts
F5_TTS_DEVICE=cuda  # cuda, cpu, or mps (Mac)
F5_TTS_MAX_WORKERS=2

# === VOICE STORAGE ===
VOICES_DIR=./voices
# Structure:
#   voices/user_{user_id}/  - User's custom voices
#   voices/global/          - Downloaded global voices

# === GLOBAL VOICE REPOSITORY ===
GLOBAL_VOICES_REPO=https://tts-voices.example.com
# Repository where global voice packs are hosted

# === AUDIO SETTINGS ===
SAMPLE_RATE=22050
AUDIO_FORMAT=wav

# === SECURITY ===
ALLOWED_ORIGINS=http://localhost:8000
# Only Bot Service can call this

# === CLOUDFLARE TUNNEL (Production) ===
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token

# === LOGGING ===
LOG_LEVEL=INFO
LOG_FILE=logs/tts_simple.log
```

**Frontend Environment (.env):**
```bash
# === API ENDPOINTS ===
VITE_API_URL=http://localhost:8000
VITE_TTS_SERVICE_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8000/ws

# Production:
# VITE_API_URL=https://api.yourdomain.com
# VITE_TTS_SERVICE_URL=https://tts.yourdomain.com
# VITE_WS_URL=wss://api.yourdomain.com/ws

# === FEATURES ===
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=true
```

**Configuration Loader (bot_service/core/config.py):**
```python
from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # Database
    database_url: str
    
    # Services
    bot_service_host: str = "0.0.0.0"
    bot_service_port: int = 8000
    tts_service_url: str
    frontend_url: str
    
    # Security
    secret_key: str
    jwt_secret_key: str
    encryption_key: str
    
    # OAuth
    twitch_client_id: str
    twitch_client_secret: str
    twitch_redirect_uri: str
    vk_client_id: str
    vk_client_secret: str
    vk_redirect_uri: str
    donation_alerts_client_id: Optional[str] = None
    donation_alerts_client_secret: Optional[str] = None
    donation_alerts_redirect_uri: Optional[str] = None
    
    # External APIs
    google_tts_api_key: Optional[str] = None
    youtube_api_key: Optional[str] = None
    
    # Rate Limiting
    rate_limit_default: str = "60/minute"
    rate_limit_login: str = "5/15minute"
    rate_limit_tts: str = "30/minute"
    
    # Logging
    log_level: str = "INFO"
    log_file: str = "logs/bot_service.log"
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Global settings instance
settings = Settings()

# Validate critical settings on startup
def validate_settings():
    required = [
        'secret_key', 'jwt_secret_key', 'encryption_key',
        'twitch_client_id', 'twitch_client_secret'
    ]
    missing = [key for key in required if not getattr(settings, key, None)]
    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

validate_settings()
```

**Usage in Code:**
```python
# Instead of hardcoded values
from core.config import settings

# API calls
async with aiohttp.ClientSession() as session:
    async with session.post(f"{settings.tts_service_url}/synthesize", ...) as resp:
        ...

# OAuth redirects
redirect_uri = settings.twitch_redirect_uri

# Database connection
engine = create_engine(settings.database_url)
```

#### 0.2 Distributed Architecture Setup

**Deployment Scenarios:**

**Scenario 1: Advanced Setup (F5-TTS)**
- **Machine 1 (Local PC with GPU):** TTS Service (F5-TTS) + Cloudflare Tunnel
- **Machine 2 (Remote Server):** Bot Service + Frontend + Database
- **Communication:** Bot Service → TTS Service via Cloudflare Tunnel URL

**Scenario 2: Simple Setup (Lightweight)**
- **Machine 1 (User's PC):** TTS Service Simple + Cloudflare Tunnel
- **Machine 2 (Remote Server):** Bot Service + Frontend + Database
- **Communication:** Bot Service → TTS Service Simple via Cloudflare Tunnel URL

**Scenario 3: Cloud Setup**
- **Machine 1 (Remote Server):** Bot Service + Frontend + Database + TTS Service (Google TTS)
- **No local machine needed**

**TTS Service vs TTS Service Simple:**

| Feature | TTS Service | TTS Service Simple |
|---------|-------------|-------------------|
| **Purpose** | Centralized TTS for multiple users | Personal TTS for single user |
| **Engine** | F5-TTS (same) | F5-TTS (same) |
| **Requirements** | GPU (CUDA), 8GB+ VRAM | GPU (CUDA), 8GB+ VRAM |
| **Voice Storage** | Centralized (all users) | Local (user's PC) |
| **Voice Cloning** | Yes (upload samples) | Yes (upload samples) |
| **Global Voices** | Managed by admin | Downloaded from global pack |
| **Quality** | Excellent | Excellent (same engine) |
| **Speed** | Moderate (GPU) | Moderate (GPU) |
| **Setup Complexity** | High (server deployment) | Medium (local deployment) |
| **Use Case** | Shared hosting, multiple streamers | Personal use, privacy |
| **Data Privacy** | Voices stored on server | Voices stored locally |

**Both services have identical API:**
```
POST /synthesize
  Request: { text, voice, speed, volume, language }
  Response: { audio_url, duration, format }

GET /voices
  Response: { voices: [...] }

GET /health
  Response: { status, engine_info }

POST /voices/upload
  Request: multipart/form-data with audio file
  Response: { voice_id, voice_name }

GET /voices/global
  Response: { voices: [...] }  # Available global voice packs

POST /voices/download/{voice_id}
  Downloads global voice to local storage
```

**Key Differences:**

1. **Voice Storage:**
   - TTS Service: `/app/voices/` (shared by all users)
   - TTS Service Simple: `/app/voices/user_{user_id}/` (isolated per user)

2. **Global Voice Packs:**
   - TTS Service: Admin uploads global voices, available to all
   - TTS Service Simple: User downloads global voice packs from repository

3. **Deployment:**
   - TTS Service: One instance serves multiple Bot Services
   - TTS Service Simple: One instance per user, connected to their Bot Service

**Bot Service doesn't care which TTS service is used** - it just sends requests to `TTS_SERVICE_URL` configured in `.env`

**Cloudflare Tunnel Setup (Machine 1 - TTS Service):**
```yaml
# cloudflared-config.yml
tunnel: your-tunnel-id
credentials-file: /path/to/credentials.json

ingress:
  - hostname: tts.yourdomain.com
    service: http://localhost:8001
  - service: http_status:404
```

**Docker Compose for TTS Service (Advanced - F5-TTS):**
```yaml
# docker-compose.tts-advanced.yml
version: '3.8'

services:
  tts_service:
    build: ./tts_service
    container_name: tts_service
    ports:
      - "8001:8001"
    volumes:
      - ./tts_service:/app
      - ./models/f5_tts:/app/models
      - ./voices:/app/voices  # User-uploaded voice samples
      - ./audio:/app/audio    # Generated audio files
      - ./logs:/app/logs
    env_file:
      - ./tts_service/.env
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared
    command: tunnel --config /etc/cloudflared/config.yml run
    volumes:
      - ./cloudflared-config.yml:/etc/cloudflared/config.yml:ro
      - ./cloudflared-credentials.json:/etc/cloudflared/credentials.json:ro
    restart: unless-stopped
    depends_on:
      - tts_service
```

**Docker Compose for TTS Service Simple (Local F5-TTS):**
```yaml
# docker-compose.tts-simple.yml
version: '3.8'

services:
  tts_service_simple:
    build: ./tts_service_simple
    container_name: tts_service_simple
    ports:
      - "8001:8001"  # Same port as TTS Service for compatibility
    volumes:
      - ./tts_service_simple:/app
      - ./models/f5_tts:/app/models  # F5-TTS models
      - ./voices:/app/voices         # User voices (local storage)
      - ./audio:/app/audio           # Generated audio files
      - ./logs:/app/logs
    env_file:
      - ./tts_service_simple/.env
    environment:
      - GLOBAL_VOICES_REPO=https://tts-voices.example.com
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]  # F5-TTS needs GPU

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared
    command: tunnel --config /etc/cloudflared/config.yml run
    volumes:
      - ./cloudflared-config.yml:/etc/cloudflared/config.yml:ro
      - ./cloudflared-credentials.json:/etc/cloudflared/credentials.json:ro
    restart: unless-stopped
    depends_on:
      - tts_service_simple
```

**Docker Compose for Bot Service (Machine 2):**
```yaml
# docker-compose.bot.yml
version: '3.8'

services:
  bot_service:
    build: ./bot_service
    container_name: bot_service
    ports:
      - "8000:8000"
    volumes:
      - ./bot_service:/app
      - ./data:/app/data
      - ./logs:/app/logs
    env_file:
      - ./bot_service/.env
    environment:
      - TTS_SERVICE_URL=https://tts.yourdomain.com  # Cloudflare Tunnel URL
    restart: unless-stopped
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    container_name: postgres
    environment:
      POSTGRES_DB: tts_bot
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  frontend:
    build: ./frontend
    container_name: frontend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    restart: unless-stopped
    depends_on:
      - bot_service

volumes:
  postgres_data:
```

**Migration Script:**
```bash
#!/bin/bash
# migrate.sh - Easy migration to new machine

echo "=== TTS Bot Migration Script ==="

# 1. Copy .env.example to .env
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ Created .env file. Please edit it with your configuration."
    exit 1
fi

# 2. Generate secrets if needed
if grep -q "your-secret-key-here" .env; then
    echo "Generating secrets..."
    SECRET_KEY=$(openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    
    sed -i "s/your-secret-key-here/$SECRET_KEY/" .env
    sed -i "s/your-jwt-secret/$JWT_SECRET/" .env
    sed -i "s/your-fernet-key/$ENCRYPTION_KEY/" .env
    echo "✓ Generated security keys"
fi

# 3. Create required directories
mkdir -p data logs models
echo "✓ Created directories"

# 4. Install dependencies
echo "Installing dependencies..."
cd bot_service && pip install -r requirements.txt
cd ../frontend && npm install
echo "✓ Installed dependencies"

# 5. Run database migrations
echo "Running database migrations..."
cd ../bot_service && alembic upgrade head
echo "✓ Database ready"

echo ""
echo "=== Migration Complete ==="
echo "Next steps:"
echo "1. Edit .env files with your OAuth credentials"
echo "2. For TTS service: Configure Cloudflare Tunnel"
echo "3. Run: docker-compose up -d"
```

#### 0.3 WebSocket Connection Management

**Current Issue:** SharedWebSocket creates connection per tab
**Solution:** Browser-level singleton with BroadcastChannel

**Enhanced SharedWebSocket (frontend/src/utils/sharedWebSocket.ts):**
```typescript
// Leader Election with BroadcastChannel
class SharedWebSocket {
  private static instance: SharedWebSocket | null = null;
  private ws: WebSocket | null = null;
  private isLeader: boolean = false;
  private leaderId: string = '';
  private myId: string = Math.random().toString(36);
  private channel: BroadcastChannel;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: number | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  
  private constructor() {
    // BroadcastChannel for cross-tab communication
    this.channel = new BroadcastChannel('websocket_channel');
    this.channel.onmessage = this.handleChannelMessage.bind(this);
    
    // Participate in leader election
    this.electLeader();
    
    // Listen for leader changes
    window.addEventListener('beforeunload', () => {
      if (this.isLeader) {
        this.channel.postMessage({ type: 'leader_leaving', id: this.myId });
      }
    });
  }
  
  static getInstance(): SharedWebSocket {
    if (!SharedWebSocket.instance) {
      SharedWebSocket.instance = new SharedWebSocket();
    }
    return SharedWebSocket.instance;
  }
  
  private electLeader() {
    // Request current leader
    this.channel.postMessage({ type: 'leader_request', id: this.myId });
    
    // If no response in 100ms, become leader
    setTimeout(() => {
      if (!this.leaderId) {
        this.becomeLeader();
      }
    }, 100);
  }
  
  private becomeLeader() {
    this.isLeader = true;
    this.leaderId = this.myId;
    this.channel.postMessage({ type: 'leader_announcement', id: this.myId });
    this.connect();
    console.log('[WebSocket] Became leader');
  }
  
  private handleChannelMessage(event: MessageEvent) {
    const { type, id, data } = event.data;
    
    switch (type) {
      case 'leader_request':
        if (this.isLeader) {
          this.channel.postMessage({ type: 'leader_announcement', id: this.myId });
        }
        break;
        
      case 'leader_announcement':
        if (id !== this.myId) {
          this.leaderId = id;
          this.isLeader = false;
        }
        break;
        
      case 'leader_leaving':
        if (id === this.leaderId) {
          this.leaderId = '';
          this.electLeader();
        }
        break;
        
      case 'ws_message':
        // Broadcast WebSocket message to all tabs
        this.notifyListeners(data);
        break;
    }
  }
  
  private connect() {
    if (!this.isLeader) return;
    
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
    const token = localStorage.getItem('token');
    
    this.ws = new WebSocket(`${wsUrl}?token=${token}`);
    
    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.channel.postMessage({ 
        type: 'ws_message', 
        data: { type: 'connected' } 
      });
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Broadcast to all tabs via BroadcastChannel
      this.channel.postMessage({ type: 'ws_message', data });
    };
    
    this.ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      this.stopHeartbeat();
      if (this.isLeader) {
        this.reconnect();
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };
  }
  
  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // 30 seconds
  }
  
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      this.channel.postMessage({ 
        type: 'ws_message', 
        data: { type: 'connection_failed' } 
      });
      return;
    }
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000
    );
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  public send(data: any) {
    if (this.isLeader && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      // Forward to leader via BroadcastChannel
      this.channel.postMessage({ type: 'send_request', data });
    }
  }
  
  public addEventListener(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }
  
  public removeEventListener(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }
  
  private notifyListeners(data: any) {
    const event = data.type;
    this.listeners.get(event)?.forEach(callback => callback(data));
    this.listeners.get('*')?.forEach(callback => callback(data));
  }
}

export default SharedWebSocket.getInstance();
```

**Backend Connection Tracking (bot_service/core/websocket_manager.py):**
```python
from fastapi import WebSocket
from typing import Dict, Set
import asyncio
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # user_id -> Set of WebSocket connections
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # Track last activity per user
        self.last_activity: Dict[int, float] = {}
        
    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        
        self.active_connections[user_id].add(websocket)
        self.last_activity[user_id] = asyncio.get_event_loop().time()
        
        logger.info(f"User {user_id} connected. Total connections: {len(self.active_connections[user_id])}")
        
        # Notify that user is now active
        await self.broadcast_to_user(user_id, {
            "type": "connection_status",
            "active": True,
            "connections": len(self.active_connections[user_id])
        })
    
    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            
            if not self.active_connections[user_id]:
                # No more connections for this user
                del self.active_connections[user_id]
                del self.last_activity[user_id]
                logger.info(f"User {user_id} fully disconnected")
                
                # Trigger cleanup (disable TTS generation, etc.)
                asyncio.create_task(self.handle_user_disconnect(user_id))
            else:
                logger.info(f"User {user_id} connection closed. Remaining: {len(self.active_connections[user_id])}")
    
    def is_user_connected(self, user_id: int) -> bool:
        """Check if user has any active connections"""
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0
    
    async def handle_user_disconnect(self, user_id: int):
        """Handle cleanup when user fully disconnects"""
        # Disable TTS generation for this user
        from services.tts_service import tts_queue_manager
        await tts_queue_manager.disable_for_user(user_id)
        logger.info(f"Disabled TTS generation for disconnected user {user_id}")
    
    async def broadcast_to_user(self, user_id: int, message: dict):
        """Send message to all connections of a user"""
        if user_id not in self.active_connections:
            return
        
        disconnected = set()
        for connection in self.active_connections[user_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending to user {user_id}: {e}")
                disconnected.add(connection)
        
        # Clean up failed connections
        for conn in disconnected:
            self.disconnect(conn, user_id)
    
    async def broadcast_to_all(self, message: dict):
        """Send message to all connected users"""
        for user_id in list(self.active_connections.keys()):
            await self.broadcast_to_user(user_id, message)

# Global instance
connection_manager = ConnectionManager()
```

**TTS Queue Manager with Connection Check:**
```python
# bot_service/services/tts_service/queue_manager.py
from core.websocket_manager import connection_manager
import logging

logger = logging.getLogger(__name__)

class TtsQueueManager:
    def __init__(self):
        self.disabled_users: Set[int] = set()
    
    async def add_to_queue(self, user_id: int, message: str, voice: str):
        # Check if user is connected
        if not connection_manager.is_user_connected(user_id):
            logger.info(f"Skipping TTS for user {user_id} - no active connections")
            return
        
        if user_id in self.disabled_users:
            logger.info(f"Skipping TTS for user {user_id} - disabled")
            return
        
        # Proceed with TTS generation
        logger.info(f"Adding TTS to queue for user {user_id}")
        await self.generate_and_send(user_id, message, voice)
    
    async def disable_for_user(self, user_id: int):
        """Disable TTS generation when user disconnects"""
        self.disabled_users.add(user_id)
        logger.info(f"Disabled TTS for user {user_id}")
    
    async def enable_for_user(self, user_id: int):
        """Re-enable TTS generation when user reconnects"""
        self.disabled_users.discard(user_id)
        logger.info(f"Enabled TTS for user {user_id}")

tts_queue_manager = TtsQueueManager()
```

### 0.4 TTS Service Abstraction

**Problem:** Bot Service hardcoded to specific TTS implementation
**Solution:** Unified TTS API that works with both TTS Service and TTS Service Simple

**Unified TTS API Contract:**
```
POST /synthesize
  Request: { text, voice, speed, volume, language }
  Response: { audio_url, duration, format }

GET /voices
  Response: { voices: [...] }

GET /health
  Response: { status, engine_info }

POST /voices/upload (optional - only TTS Service)
  Request: multipart/form-data with audio file
  Response: { voice_id, voice_name }
```

**TTS Service (Advanced - F5-TTS):**
```python
# tts_service/main.py
from fastapi import FastAPI, UploadFile
import f5_tts

app = FastAPI()

@app.post("/synthesize")
async def synthesize(request: dict):
    """Synthesize using F5-TTS with custom voices"""
    text = request['text']
    voice = request.get('voice', 'default')
    speed = request.get('speed', 1.0)
    volume = request.get('volume', 1.0)
    
    # Load custom voice model
    voice_model = load_voice_model(voice)
    
    # Generate with F5-TTS
    audio_path = await f5_tts.generate(
        text=text,
        voice_model=voice_model,
        speed=speed
    )
    
    # Apply volume
    if volume != 1.0:
        audio_path = adjust_volume(audio_path, volume)
    
    return {
        "audio_url": f"/audio/{audio_path}",
        "duration": get_duration(audio_path),
        "format": "wav"
    }

@app.post("/voices/upload")
async def upload_voice(file: UploadFile, voice_name: str):
    """Upload custom voice sample for cloning"""
    # Save voice sample
    voice_path = f"voices/{voice_name}.wav"
    save_file(file, voice_path)
    
    # Train F5-TTS model on voice sample
    voice_id = await f5_tts.clone_voice(voice_path, voice_name)
    
    return {
        "voice_id": voice_id,
        "voice_name": voice_name
    }

@app.get("/voices")
async def get_voices():
    """Get all available voices (custom + default)"""
    custom_voices = list_custom_voices()
    default_voices = ['default', 'male', 'female']
    return {
        "voices": custom_voices + default_voices
    }
```

**TTS Service Simple (Local F5-TTS):**
```python
# tts_service_simple/main.py
from fastapi import FastAPI, UploadFile
import f5_tts
import aiohttp
import os

app = FastAPI()

# User ID from Bot Service (passed in requests)
VOICES_DIR = "voices"
GLOBAL_VOICES_REPO = "https://tts-voices.example.com"  # Global voice pack repository

@app.post("/synthesize")
async def synthesize(request: dict):
    """Synthesize using F5-TTS (same as TTS Service)"""
    text = request['text']
    voice = request.get('voice', 'default')
    speed = request.get('speed', 1.0)
    volume = request.get('volume', 1.0)
    user_id = request.get('user_id')  # For voice isolation
    
    # Load voice model (from local storage)
    voice_path = f"{VOICES_DIR}/user_{user_id}/{voice}"
    if not os.path.exists(voice_path):
        # Try global voices
        voice_path = f"{VOICES_DIR}/global/{voice}"
    
    voice_model = load_voice_model(voice_path)
    
    # Generate with F5-TTS
    audio_path = await f5_tts.generate(
        text=text,
        voice_model=voice_model,
        speed=speed
    )
    
    # Apply volume
    if volume != 1.0:
        audio_path = adjust_volume(audio_path, volume)
    
    return {
        "audio_url": f"/audio/{audio_path}",
        "duration": get_duration(audio_path),
        "format": "wav"
    }

@app.post("/voices/upload")
async def upload_voice(file: UploadFile, voice_name: str, user_id: int):
    """Upload custom voice sample (stored locally per user)"""
    # Save to user-specific directory
    user_voices_dir = f"{VOICES_DIR}/user_{user_id}"
    os.makedirs(user_voices_dir, exist_ok=True)
    
    voice_path = f"{user_voices_dir}/{voice_name}.wav"
    save_file(file, voice_path)
    
    # Train F5-TTS model on voice sample
    voice_id = await f5_tts.clone_voice(voice_path, voice_name)
    
    return {
        "voice_id": voice_id,
        "voice_name": voice_name,
        "storage": "local"
    }

@app.get("/voices")
async def get_voices(user_id: int):
    """Get user's local voices + downloaded global voices"""
    # User's custom voices
    user_voices = list_voices(f"{VOICES_DIR}/user_{user_id}")
    
    # Downloaded global voices
    global_voices = list_voices(f"{VOICES_DIR}/global")
    
    return {
        "voices": {
            "custom": user_voices,
            "global": global_voices
        }
    }

@app.get("/voices/global")
async def get_global_voice_packs():
    """Get available global voice packs from repository"""
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{GLOBAL_VOICES_REPO}/packs") as resp:
            packs = await resp.json()
            return {"packs": packs}

@app.post("/voices/download/{voice_id}")
async def download_global_voice(voice_id: str):
    """Download global voice pack to local storage"""
    # Download voice pack from repository
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{GLOBAL_VOICES_REPO}/download/{voice_id}") as resp:
            voice_data = await resp.read()
    
    # Save to global voices directory
    global_voices_dir = f"{VOICES_DIR}/global"
    os.makedirs(global_voices_dir, exist_ok=True)
    
    voice_path = f"{global_voices_dir}/{voice_id}.model"
    with open(voice_path, 'wb') as f:
        f.write(voice_data)
    
    return {
        "voice_id": voice_id,
        "status": "downloaded",
        "path": voice_path
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "engine_info": {
            "type": "f5_tts",
            "version": "1.0.0",
            "mode": "local"
        }
    }
```

**Bot Service TTS Client (Works with Both):**
```python
# bot_service/services/tts_service/tts_client.py
import aiohttp
from core.config import settings

class TtsClient:
    """Client for TTS Service"""
    
    def __init__(self):
        self.tts_service_url = settings.tts_service_url
    
    async def synthesize(
        self,
        text: str,
        voice: str,
        speed: float = 1.0,
        volume: float = 1.0
    ) -> str:
        """
        Request TTS synthesis
        Returns audio URL
        """
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.tts_service_url}/synthesize",
                json={
                    "text": text,
                    "voice": voice,
                    "speed": speed,
                    "volume": volume
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                if resp.status != 200:
                    raise Exception(f"TTS service error: {resp.status}")
                
                result = await resp.json()
                return result['audio_url']
    
    async def health_check(self) -> bool:
        """Check if TTS service is available"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.tts_service_url}/health",
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as resp:
                    return resp.status == 200
        except:
            return False

tts_client = TtsClient()
```

**Benefits:**
1. Bot Service doesn't care which TTS engine is used
2. Easy to switch engines via environment variable
3. Can run lightweight Simple TTS on user's PC
4. Can upgrade to F5-TTS when GPU available
5. Can fallback to Google TTS if local engines fail

### 1. Performance Optimization Layer

#### 1.1 Code Splitting Strategy

**Frontend Route-Based Splitting:**
```typescript
// App.tsx - Lazy load non-critical routes
const HomePage = lazy(() => import('./pages/HomePage'));
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));
const DropsMainPage = lazy(() => import('./pages/drops/DropsMainPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));

// Critical routes load immediately (no lazy):
// - LoginPage
// - AuthCallbackPage
// - GuestPage
// - ChatWindow (core functionality)
```

**Component-Level Splitting:**
```typescript
// Heavy components split separately
const YouTubeQueueCarousel = lazy(() => import('./components/YouTubeQueueCarousel'));
const LootboxSystem = lazy(() => import('./components/LootboxSystem'));
const GlobalPlayer = lazy(() => import('./components/GlobalPlayer'));
```

**Loading Strategy:**
- Suspense boundaries with skeleton loaders
- Preload on hover for navigation links
- Priority loading for authenticated users

#### 1.2 React Performance Optimizations

**Memoization Strategy:**
```typescript
// Context providers - prevent unnecessary re-renders
const AuthProvider = memo(({ children }) => {
  const value = useMemo(() => ({
    user, login, logout, isAuthenticated
  }), [user, isAuthenticated]);
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
});

// Expensive computations
const filteredMessages = useMemo(() => 
  messages.filter(msg => msg.platform === selectedPlatform),
  [messages, selectedPlatform]
);

// Callback stability
const handleSave = useCallback(async (data) => {
  await saveSettings(data);
}, []);
```

**Component Optimization Targets:**
- ChatCard: Virtualize message list with @tanstack/react-virtual
- StreamCategoryCard: Debounce search input (already has 300ms)
- QuickActionsBar: Memo buttons to prevent re-renders
- TtsControlPanel: Optimize toggle handlers

#### 1.3 Backend Performance Optimizations

**Database Query Optimization:**
```python
# Connection pooling configuration
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600
)

# Eager loading for relationships
user = db.query(User).options(
    joinedload(User.tts_settings),
    joinedload(User.voice_settings)
).filter(User.id == user_id).first()

# Index optimization
class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index('idx_twitch_username_lower', func.lower(twitch_username)),
        Index('idx_vk_user_id', vk_user_id),
    )
```

**Async Operations:**
```python
# Parallel API calls
async def fetch_stream_data(user_id):
    async with aiohttp.ClientSession() as session:
        twitch_task = fetch_twitch_data(session, user_id)
        vk_task = fetch_vk_data(session, user_id)
        results = await asyncio.gather(twitch_task, vk_task, return_exceptions=True)
    return results
```

### 2. Code Cleanup Layer

#### 2.1 Dead Code Elimination

**Analysis Tools:**
```bash
# Frontend - Find unused exports
npx ts-prune

# Frontend - Find unused dependencies
npx depcheck

# Backend - Find unused imports
pylint --disable=all --enable=unused-import bot_service/

# Backend - Find unused code
vulture bot_service/
```

**Cleanup Targets:**
- Remove unused imports (identified by linters)
- Delete unreferenced utility functions
- Remove commented code blocks > 5 lines
- Consolidate duplicate functions

**Protected Files (DO NOT MODIFY):**
- `frontend/src/components/StreamCategoryCard.tsx` (893 lines)
- `frontend/src/constants/categoryMapping.ts`
- `frontend/src/constants/categoryAliases.ts`
- `frontend/src/components/TtsControlPanel.jsx`
- `frontend/src/components/TtsPlatformSelector.jsx`
- `bot_service/api/tts_api.py`
- All files listed in `docs/DO_NOT_TOUCH.md`

#### 2.2 Dependency Audit

**Frontend Dependencies to Review:**
```json
{
  "review": [
    "@tailwindcss/line-clamp",  // Check if used (Tailwind 3.4 has built-in)
    "recharts",                  // Check usage frequency
    "react-youtube"              // Verify necessity
  ],
  "update": [
    "All @radix-ui packages",    // Update to latest
    "axios",                     // Update to latest
    "zod"                        // Update to latest
  ]
}
```

**Backend Dependencies to Review:**
```python
# requirements.txt - Check usage
prometheus-client  # Verify if metrics are used
structlog          # Check if used vs standard logging
psutil             # Verify usage
cachetools         # Check if needed
```

### 3. Error Handling Layer

#### 3.1 Frontend Error Handling

**Error Boundary Strategy:**
```typescript
// Global error boundary
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>

// Route-level boundaries
<ErrorBoundary fallback={<PageError />}>
  <Suspense fallback={<PageSkeleton />}>
    <LazyPage />
  </Suspense>
</ErrorBoundary>

// Component-level boundaries for critical features
<ErrorBoundary fallback={<FeatureError />}>
  <TtsControlPanel />
</ErrorBoundary>
```

**API Error Handling:**
```typescript
// Centralized error handler
const handleApiError = (error: AxiosError) => {
  if (error.response) {
    // Server responded with error
    const status = error.response.status;
    const message = error.response.data?.detail || 'Ошибка сервера';
    
    if (status === 401) {
      // Redirect to login
      logout();
      navigate('/login');
    } else if (status === 403) {
      toast.error('Недостаточно прав');
    } else if (status >= 500) {
      toast.error('Ошибка сервера. Попробуйте позже');
    } else {
      toast.error(message);
    }
  } else if (error.request) {
    // No response received
    toast.error('Нет связи с сервером');
  } else {
    // Request setup error
    toast.error('Ошибка запроса');
  }
};

// Retry logic with exponential backoff
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000
});

apiClient.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config;
    if (!config || !config.retry) {
      config.retry = 0;
    }
    
    if (config.retry < 2 && error.response?.status >= 500) {
      config.retry += 1;
      const delay = Math.pow(2, config.retry) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return apiClient(config);
    }
    
    return Promise.reject(error);
  }
);
```

**WebSocket Reconnection:**
```typescript
// Enhanced reconnection logic
class SharedWebSocket {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  
  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      toast.error('Не удалось восстановить соединение');
      return;
    }
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000
    );
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  private onOpen() {
    this.reconnectAttempts = 0;
    toast.success('Соединение восстановлено');
  }
}
```

#### 3.2 Backend Error Handling

**Global Exception Handler:**
```python
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log full error with context
    logger.error(
        f"Unhandled exception: {exc}",
        extra={
            "path": request.url.path,
            "method": request.method,
            "user_id": getattr(request.state, "user_id", None)
        },
        exc_info=True
    )
    
    # Return generic error to client
    return JSONResponse(
        status_code=500,
        content={"detail": "Внутренняя ошибка сервера"}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(
        f"HTTP {exc.status_code}: {exc.detail}",
        extra={"path": request.url.path, "method": request.method}
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )
```

**Validation Error Handler:**
```python
from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"][1:])
        message = error["msg"]
        errors.append({"field": field, "message": message})
    
    return JSONResponse(
        status_code=422,
        content={"detail": "Ошибка валидации", "errors": errors}
    )
```

### 4. UI/UX Enhancement Layer

#### 4.1 Design System Consistency

**Spacing System (8px grid):**
```css
/* design-system.css */
:root {
  --spacing-1: 0.5rem;  /* 8px */
  --spacing-2: 1rem;    /* 16px */
  --spacing-3: 1.5rem;  /* 24px */
  --spacing-4: 2rem;    /* 32px */
  --spacing-5: 2.5rem;  /* 40px */
  --spacing-6: 3rem;    /* 48px */
}

/* Apply consistently */
.card {
  padding: var(--spacing-3);
  gap: var(--spacing-2);
}
```

**Loading States:**
```typescript
// Skeleton loaders for content
const CardSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
  </div>
);

// Button loading states
<Button disabled={isLoading}>
  {isLoading && <Spinner className="mr-2" />}
  Сохранить
</Button>
```

**Visual Feedback:**
```typescript
// Success animations
const handleSave = async () => {
  setIsSaving(true);
  try {
    await saveSettings(data);
    // Success feedback
    toast.success('Настройки сохранены');
    // Visual confirmation
    setShowCheckmark(true);
    setTimeout(() => setShowCheckmark(false), 2000);
  } finally {
    setIsSaving(false);
  }
};

// Hover and focus states
.button {
  @apply transition-all duration-200;
  @apply hover:scale-105 hover:shadow-md;
  @apply focus:ring-2 focus:ring-primary focus:outline-none;
}
```

**Accessibility:**
```typescript
// WCAG AA contrast ratios
const colors = {
  text: '#1a1a1a',      // 16:1 on white
  textMuted: '#666666',  // 5.7:1 on white
  primary: '#0066cc',    // 4.5:1 on white
};

// Keyboard navigation
<button
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
  aria-label="Сохранить настройки"
  tabIndex={0}
>
  Сохранить
</button>
```

#### 4.2 Form Improvements

**Inline Validation:**
```typescript
// Real-time validation with zod
const schema = z.object({
  title: z.string().min(1, 'Название обязательно').max(140, 'Максимум 140 символов'),
  category: z.string().min(1, 'Выберите категорию')
});

const { register, formState: { errors }, watch } = useForm({
  resolver: zodResolver(schema),
  mode: 'onChange'  // Validate on change
});

// Display errors inline
<Input {...register('title')} />
{errors.title && (
  <p className="text-sm text-red-500 mt-1">{errors.title.message}</p>
)}
```

**Auto-save Enhancement:**
```typescript
// Improved auto-save with status indicator
const { debouncedValue, isPending } = useDebounce(formData, 2000);

useEffect(() => {
  if (debouncedValue && !isPending) {
    saveSettings(debouncedValue);
  }
}, [debouncedValue, isPending]);

// Status indicator
{isPending && <span className="text-gray-500">Сохранение...</span>}
{!isPending && isSaved && <span className="text-green-500">✓ Сохранено</span>}
```

### 5. State Synchronization Layer

#### 5.1 Optimistic Updates with Rollback

**Pattern Implementation:**
```typescript
// React Query optimistic update
const updateSettingsMutation = useMutation({
  mutationFn: (data) => api.updateSettings(data),
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['settings'] });
    
    // Snapshot previous value
    const previousSettings = queryClient.getQueryData(['settings']);
    
    // Optimistically update
    queryClient.setQueryData(['settings'], newData);
    
    // Return context for rollback
    return { previousSettings };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(['settings'], context.previousSettings);
    toast.error('Не удалось сохранить настройки');
  },
  onSuccess: () => {
    toast.success('Настройки сохранены');
  },
  onSettled: () => {
    // Refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['settings'] });
  }
});
```

#### 5.2 WebSocket State Sync

**Bidirectional Synchronization:**
```typescript
// Frontend - Listen for backend updates
useEffect(() => {
  const handleSettingsUpdate = (event) => {
    const { settings } = event.detail;
    // Update local state
    queryClient.setQueryData(['settings'], settings);
    // Show notification
    toast.info('Настройки обновлены');
  };
  
  ws.addEventListener('settings_updated', handleSettingsUpdate);
  return () => ws.removeEventListener('settings_updated', handleSettingsUpdate);
}, []);

// Backend - Broadcast updates
async def update_settings(user_id: int, settings: dict, db: Session):
    # Save to database
    db_settings = db.query(Settings).filter(Settings.user_id == user_id).first()
    db_settings.update(settings)
    db.commit()
    
    # Broadcast to all user's connections
    await websocket_manager.broadcast_to_user(
        user_id,
        {
            "type": "settings_updated",
            "data": settings
        }
    )
```

#### 5.3 Reconnection State Reconciliation

**State Sync on Reconnect:**
```typescript
// Frontend - Fetch fresh state on reconnect
const handleReconnect = async () => {
  try {
    // Fetch all critical state
    const [settings, integrations, ttsConfig] = await Promise.all([
      api.getSettings(),
      api.getIntegrations(),
      api.getTtsConfig()
    ]);
    
    // Update all queries
    queryClient.setQueryData(['settings'], settings);
    queryClient.setQueryData(['integrations'], integrations);
    queryClient.setQueryData(['ttsConfig'], ttsConfig);
    
    toast.success('Состояние синхронизировано');
  } catch (error) {
    toast.error('Ошибка синхронизации');
  }
};
```

### 6. Validation Layer

#### 6.1 Frontend Validation

**Form Validation with Zod:**
```typescript
// Validation schemas
const streamTitleSchema = z.object({
  title: z.string()
    .min(1, 'Название обязательно')
    .max(140, 'Максимум 140 символов')
    .regex(/^[^<>]*$/, 'Недопустимые символы'),
  platform: z.enum(['twitch', 'vk', 'both'])
});

const ttsSettingsSchema = z.object({
  enabled_platforms: z.array(z.enum(['twitch', 'vk'])),
  volume: z.number().min(0).max(100),
  speed: z.number().min(0.5).max(2.0)
});

// Usage in forms
const { handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(streamTitleSchema)
});
```

**Input Sanitization:**
```typescript
// XSS prevention
const sanitizeInput = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Apply before sending to API
const handleSubmit = (data) => {
  const sanitized = {
    ...data,
    title: sanitizeInput(data.title),
    description: sanitizeInput(data.description)
  };
  api.updateStream(sanitized);
};
```

#### 6.2 Backend Validation

**Pydantic Models:**
```python
from pydantic import BaseModel, Field, validator
from typing import List, Optional

class StreamUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=140)
    category_id: Optional[str] = None
    platform: str = Field(..., regex='^(twitch|vk|both)$')
    
    @validator('title')
    def sanitize_title(cls, v):
        # Remove dangerous characters
        return v.replace('<', '').replace('>', '')
    
    @validator('category_id')
    def validate_category_id(cls, v, values):
        platform = values.get('platform')
        if platform == 'vk' and v:
            # VK requires UUID format
            import uuid
            try:
                uuid.UUID(v)
            except ValueError:
                raise ValueError('Invalid VK category ID format')
        return v

class TtsPlatformSettings(BaseModel):
    enabled_platforms: List[str] = Field(default_factory=list)
    
    @validator('enabled_platforms')
    def validate_platforms(cls, v):
        valid = {'twitch', 'vk'}
        if not all(p in valid for p in v):
            raise ValueError(f'Invalid platforms. Must be in {valid}')
        return v
```

**Input Sanitization:**
```python
from validators.input_validators import sanitize_input

@router.post("/stream/update")
async def update_stream(
    request: StreamUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Additional sanitization layer
    sanitized_title = sanitize_input(request.title)
    
    # Validate user has permission
    if not current_user.get('is_active'):
        raise HTTPException(403, "Account not active")
    
    # Process update
    result = await stream_service.update(
        user_id=current_user['id'],
        title=sanitized_title,
        category_id=request.category_id,
        platform=request.platform,
        db=db
    )
    
    return {"success": True, "data": result}
```

## Architectural Patterns for Scalability

### 1. Platform Abstraction Layer

**Problem:** Currently platform-specific code is scattered throughout the application
**Solution:** Abstract platform interface with concrete implementations

**Platform Interface (bot_service/platforms/base.py):**
```python
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from dataclasses import dataclass

@dataclass
class PlatformConfig:
    """Configuration for a streaming platform"""
    name: str  # 'twitch', 'vk', 'kick', 'youtube'
    display_name: str
    supports_oauth: bool
    supports_chat: bool
    supports_tts: bool
    supports_points: bool
    supports_categories: bool
    color: str  # Brand color for UI

class StreamingPlatform(ABC):
    """Abstract base class for streaming platforms"""
    
    def __init__(self, config: PlatformConfig):
        self.config = config
    
    @abstractmethod
    async def authenticate(self, code: str) -> Dict[str, Any]:
        """Handle OAuth authentication"""
        pass
    
    @abstractmethod
    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user information"""
        pass
    
    @abstractmethod
    async def update_stream_title(self, access_token: str, title: str) -> bool:
        """Update stream title"""
        pass
    
    @abstractmethod
    async def update_stream_category(self, access_token: str, category_id: str) -> bool:
        """Update stream category"""
        pass
    
    @abstractmethod
    async def search_categories(self, query: str) -> list:
        """Search for categories"""
        pass
    
    @abstractmethod
    async def get_stream_status(self, access_token: str) -> Dict[str, Any]:
        """Get current stream status"""
        pass
    
    @abstractmethod
    async def send_chat_message(self, access_token: str, message: str) -> bool:
        """Send message to chat"""
        pass
    
    # Optional methods (not all platforms support all features)
    async def create_reward(self, access_token: str, reward_data: Dict) -> Optional[str]:
        """Create channel points reward (if supported)"""
        return None
    
    async def update_reward(self, access_token: str, reward_id: str, reward_data: Dict) -> bool:
        """Update channel points reward (if supported)"""
        return False
```

**Concrete Implementations:**
```python
# bot_service/platforms/twitch.py
class TwitchPlatform(StreamingPlatform):
    def __init__(self):
        config = PlatformConfig(
            name='twitch',
            display_name='Twitch',
            supports_oauth=True,
            supports_chat=True,
            supports_tts=True,
            supports_points=True,
            supports_categories=True,
            color='#9146FF'
        )
        super().__init__(config)
    
    async def authenticate(self, code: str) -> Dict[str, Any]:
        # Twitch OAuth implementation
        ...
    
    async def update_stream_title(self, access_token: str, title: str) -> bool:
        # Twitch API call
        ...

# bot_service/platforms/vk.py
class VKPlatform(StreamingPlatform):
    def __init__(self):
        config = PlatformConfig(
            name='vk',
            display_name='VK Live',
            supports_oauth=True,
            supports_chat=True,
            supports_tts=True,
            supports_points=True,
            supports_categories=True,
            color='#0077FF'
        )
        super().__init__(config)
    
    async def authenticate(self, code: str) -> Dict[str, Any]:
        # VK OAuth implementation
        ...

# bot_service/platforms/kick.py (Future)
class KickPlatform(StreamingPlatform):
    def __init__(self):
        config = PlatformConfig(
            name='kick',
            display_name='Kick',
            supports_oauth=True,
            supports_chat=True,
            supports_tts=True,
            supports_points=False,  # Kick doesn't have points system
            supports_categories=True,
            color='#53FC18'
        )
        super().__init__(config)
    
    async def authenticate(self, code: str) -> Dict[str, Any]:
        # Kick OAuth implementation
        ...
```

**Platform Registry:**
```python
# bot_service/platforms/registry.py
from typing import Dict
from .base import StreamingPlatform
from .twitch import TwitchPlatform
from .vk import VKPlatform
# from .kick import KickPlatform  # Future

class PlatformRegistry:
    """Central registry for all streaming platforms"""
    
    def __init__(self):
        self._platforms: Dict[str, StreamingPlatform] = {}
        self._register_platforms()
    
    def _register_platforms(self):
        """Register all available platforms"""
        self.register(TwitchPlatform())
        self.register(VKPlatform())
        # self.register(KickPlatform())  # Future
    
    def register(self, platform: StreamingPlatform):
        """Register a new platform"""
        self._platforms[platform.config.name] = platform
    
    def get(self, name: str) -> Optional[StreamingPlatform]:
        """Get platform by name"""
        return self._platforms.get(name)
    
    def get_all(self) -> Dict[str, StreamingPlatform]:
        """Get all registered platforms"""
        return self._platforms.copy()
    
    def get_configs(self) -> list:
        """Get all platform configurations for frontend"""
        return [p.config for p in self._platforms.values()]

# Global registry instance
platform_registry = PlatformRegistry()
```

**Usage in API:**
```python
# bot_service/api/stream_info_api.py
from platforms.registry import platform_registry

@router.post("/stream/update")
async def update_stream(
    request: StreamUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    platform = platform_registry.get(request.platform)
    if not platform:
        raise HTTPException(400, f"Unknown platform: {request.platform}")
    
    # Use platform abstraction
    success = await platform.update_stream_title(
        access_token=current_user['access_token'],
        title=request.title
    )
    
    return {"success": success}
```

**Frontend Platform Configuration:**
```typescript
// frontend/src/constants/platforms.ts
export interface PlatformConfig {
  name: string;
  displayName: string;
  supportsOAuth: boolean;
  supportsChat: boolean;
  supportsTts: boolean;
  supportsPoints: boolean;
  supportsCategories: boolean;
  color: string;
  icon: string;
}

// Fetch from backend
export const usePlatforms = () => {
  return useQuery({
    queryKey: ['platforms'],
    queryFn: async () => {
      const response = await api.get('/api/platforms/config');
      return response.data as PlatformConfig[];
    },
    staleTime: Infinity  // Platform config rarely changes
  });
};

// Usage in components
const { data: platforms } = usePlatforms();

// Dynamically render platform toggles
{platforms?.map(platform => (
  <PlatformToggle
    key={platform.name}
    name={platform.displayName}
    color={platform.color}
    enabled={enabledPlatforms.includes(platform.name)}
    onToggle={() => handleToggle(platform.name)}
  />
))}
```

### 2. Drops System Architecture Separation

**Problem:** Business logic (probability) mixed with UI (animation)
**Solution:** Separate calculation service from presentation layer

**Drops Calculation Service (bot_service/services/drops_service.py):**
```python
from typing import Dict, Any, Optional
from dataclasses import dataclass
import random
import logging

logger = logging.getLogger(__name__)

@dataclass
class DropReward:
    """Reward from drops system"""
    id: str
    type: str  # 'common', 'rare', 'epic', 'legendary', 'mythic'
    name: str
    value: int
    icon: str

@dataclass
class DropResult:
    """Result of a drop calculation"""
    reward: DropReward
    roll: float  # The random roll (0-100)
    timestamp: float
    user_id: int

class DropsCalculationService:
    """Pure business logic for drops system"""
    
    def __init__(self):
        # Probability thresholds (configurable per user)
        self.default_probabilities = {
            'mythic': 0.1,    # 0.1%
            'legendary': 2.0,  # 2%
            'epic': 10.0,      # 10%
            'rare': 25.0,      # 25%
            'common': 62.9     # 62.9% (remaining)
        }
    
    def calculate_drop(
        self,
        user_id: int,
        probabilities: Optional[Dict[str, float]] = None
    ) -> DropResult:
        """
        Calculate drop result based on probability
        
        This is PURE business logic - no UI, no animation
        Returns the final result that UI will animate towards
        """
        if probabilities is None:
            probabilities = self.default_probabilities
        
        # Generate random roll (0-100)
        roll = random.uniform(0, 100)
        
        # Determine reward tier based on roll
        cumulative = 0
        reward_type = 'common'
        
        for tier in ['mythic', 'legendary', 'epic', 'rare', 'common']:
            cumulative += probabilities[tier]
            if roll <= cumulative:
                reward_type = tier
                break
        
        # Get reward from database
        reward = self._get_reward_for_tier(user_id, reward_type)
        
        result = DropResult(
            reward=reward,
            roll=roll,
            timestamp=time.time(),
            user_id=user_id
        )
        
        logger.info(
            f"Drop calculated for user {user_id}: "
            f"roll={roll:.2f}, tier={reward_type}, reward={reward.name}"
        )
        
        return result
    
    def _get_reward_for_tier(self, user_id: int, tier: str) -> DropReward:
        """Get a random reward from the specified tier"""
        # Query database for rewards of this tier
        # Return random reward
        ...
    
    def get_probabilities(self, user_id: int, db: Session) -> Dict[str, float]:
        """Get user's configured probabilities"""
        config = db.query(DropsConfig).filter(
            DropsConfig.user_id == user_id
        ).first()
        
        if not config:
            return self.default_probabilities
        
        return {
            'mythic': config.mythic_probability,
            'legendary': config.legendary_probability,
            'epic': config.epic_probability,
            'rare': config.rare_probability,
            'common': config.common_probability
        }
    
    def validate_probabilities(self, probabilities: Dict[str, float]) -> bool:
        """Validate that probabilities sum to 100%"""
        total = sum(probabilities.values())
        return abs(total - 100.0) < 0.01  # Allow small floating point error

drops_service = DropsCalculationService()
```

**Drops API Endpoint:**
```python
# bot_service/api/drops_api.py
from services.drops_service import drops_service

@router.post("/drops/spin")
async def spin_drops(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user['id']
    
    # Check if user can spin (cooldown, cost, etc.)
    can_spin, reason = await check_spin_eligibility(user_id, db)
    if not can_spin:
        raise HTTPException(400, reason)
    
    # Get user's probabilities
    probabilities = drops_service.get_probabilities(user_id, db)
    
    # Calculate result (PURE LOGIC - no animation here)
    result = drops_service.calculate_drop(user_id, probabilities)
    
    # Save result to database
    db_drop = DropsHistory(
        user_id=user_id,
        reward_id=result.reward.id,
        reward_type=result.reward.type,
        roll=result.roll,
        timestamp=datetime.utcnow()
    )
    db.add(db_drop)
    db.commit()
    
    # Broadcast to user's connections
    await connection_manager.broadcast_to_user(user_id, {
        "type": "drops_result",
        "data": {
            "reward": {
                "id": result.reward.id,
                "type": result.reward.type,
                "name": result.reward.name,
                "value": result.reward.value,
                "icon": result.reward.icon
            },
            "roll": result.roll
        }
    })
    
    # Return result to frontend
    return {
        "success": True,
        "result": {
            "reward": result.reward,
            "roll": result.roll
        }
    }
```

**Frontend Animation Widget (Separate from Logic):**
```typescript
// frontend/src/widgets/LootboxWidget/LootboxAnimation.tsx
interface DropResult {
  reward: {
    id: string;
    type: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
    name: string;
    value: number;
    icon: string;
  };
  roll: number;
}

export const LootboxAnimation = ({ result }: { result: DropResult }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayedReward, setDisplayedReward] = useState<Reward | null>(null);
  
  useEffect(() => {
    if (result) {
      // Start animation
      setIsSpinning(true);
      
      // Animate towards the ALREADY CALCULATED result
      animateToResult(result).then(() => {
        setIsSpinning(false);
        setDisplayedReward(result.reward);
      });
    }
  }, [result]);
  
  const animateToResult = async (result: DropResult) => {
    // Pure UI animation - result is already determined
    // Animate slot machine, wheel, or whatever UI
    // End animation at the predetermined result
    
    const duration = 3000; // 3 seconds animation
    const items = generateAnimationItems(result.reward.type);
    
    // Animate through items, ending at result.reward
    await animateSlotMachine(items, result.reward, duration);
  };
  
  return (
    <div className="lootbox-animation">
      {isSpinning ? (
        <SlotMachine items={animationItems} />
      ) : displayedReward ? (
        <RewardDisplay reward={displayedReward} />
      ) : (
        <SpinButton onClick={handleSpin} />
      )}
    </div>
  );
};

// Separate component for triggering spin
export const LootboxTrigger = () => {
  const spinMutation = useMutation({
    mutationFn: () => api.post('/api/drops/spin'),
    onSuccess: (data) => {
      // Result is already calculated by backend
      // Just show animation towards that result
      showAnimation(data.result);
    }
  });
  
  return (
    <button onClick={() => spinMutation.mutate()}>
      Крутить
    </button>
  );
};
```

**Benefits of Separation:**
1. Business logic testable without UI
2. Can change animation without touching probability
3. Can add new reward types without changing animation
4. Backend controls fairness (client can't cheat)
5. Easy to add different animation styles

### 3. Feature Module Pattern

**Problem:** Features scattered across codebase
**Solution:** Self-contained feature modules

**Feature Module Structure:**
```
bot_service/features/
├── __init__.py
├── base.py              # Base feature interface
├── tts/
│   ├── __init__.py
│   ├── api.py          # TTS endpoints
│   ├── service.py      # TTS business logic
│   ├── models.py       # TTS database models
│   └── config.py       # TTS configuration
├── drops/
│   ├── __init__.py
│   ├── api.py
│   ├── service.py
│   ├── models.py
│   └── config.py
├── points/
│   ├── __init__.py
│   ├── api.py
│   ├── service.py
│   ├── models.py
│   └── config.py
└── youtube/
    ├── __init__.py
    ├── api.py
    ├── service.py
    ├── models.py
    └── config.py
```

**Base Feature Interface:**
```python
# bot_service/features/base.py
from abc import ABC, abstractmethod
from fastapi import APIRouter

class Feature(ABC):
    """Base class for application features"""
    
    def __init__(self, name: str):
        self.name = name
        self.enabled = True
    
    @abstractmethod
    def get_router(self) -> APIRouter:
        """Get FastAPI router for this feature"""
        pass
    
    @abstractmethod
    async def initialize(self):
        """Initialize feature (called on startup)"""
        pass
    
    @abstractmethod
    async def cleanup(self):
        """Cleanup feature (called on shutdown)"""
        pass
    
    def enable(self):
        """Enable this feature"""
        self.enabled = True
    
    def disable(self):
        """Disable this feature"""
        self.enabled = False
```

**Feature Registration:**
```python
# bot_service/main.py
from features.tts import TtsFeature
from features.drops import DropsFeature
from features.points import PointsFeature
from features.youtube import YouTubeFeature

# Register features
features = [
    TtsFeature(),
    DropsFeature(),
    PointsFeature(),
    YouTubeFeature()
]

# Initialize all features
@app.on_event("startup")
async def startup():
    for feature in features:
        await feature.initialize()
        if feature.enabled:
            app.include_router(feature.get_router())

# Cleanup on shutdown
@app.on_event("shutdown")
async def shutdown():
    for feature in features:
        await feature.cleanup()
```

**Adding New Feature (Example: Kick Platform):**
```python
# bot_service/features/kick/__init__.py
from features.base import Feature
from fastapi import APIRouter

class KickFeature(Feature):
    def __init__(self):
        super().__init__("kick")
    
    def get_router(self) -> APIRouter:
        from .api import router
        return router
    
    async def initialize(self):
        # Initialize Kick bot, connections, etc.
        pass
    
    async def cleanup(self):
        # Cleanup Kick connections
        pass

# Just add to features list in main.py:
# features.append(KickFeature())
```

## Data Models

```python
# bot_service/models/metrics.py
from sqlalchemy import Column, Integer, String, Float, DateTime
from core.database import Base
from datetime import datetime

class PerformanceMetric(Base):
    __tablename__ = "performance_metrics"
    
    id = Column(Integer, primary_key=True)
    endpoint = Column(String, index=True)
    method = Column(String)
    response_time = Column(Float)  # milliseconds
    status_code = Column(Integer)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    user_id = Column(Integer, nullable=True)
    
    @classmethod
    def log_request(cls, endpoint, method, response_time, status_code, user_id=None):
        metric = cls(
            endpoint=endpoint,
            method=method,
            response_time=response_time,
            status_code=status_code,
            user_id=user_id
        )
        return metric
```

### Error Log Model

```python
# bot_service/models/error_log.py
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from core.database import Base
from datetime import datetime

class ErrorLog(Base):
    __tablename__ = "error_logs"
    
    id = Column(Integer, primary_key=True)
    error_type = Column(String, index=True)
    error_message = Column(Text)
    stack_trace = Column(Text)
    endpoint = Column(String)
    user_id = Column(Integer, nullable=True)
    context = Column(JSON)  # Additional context
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    resolved = Column(Boolean, default=False)
```

## Error Handling

### Error Classification

**Error Types:**
1. **Client Errors (4xx):** User input errors, validation failures
2. **Server Errors (5xx):** Backend failures, database errors
3. **Network Errors:** Connection timeouts, DNS failures
4. **WebSocket Errors:** Connection drops, message failures
5. **Validation Errors:** Schema validation failures

**Error Response Format:**
```typescript
interface ErrorResponse {
  detail: string;           // User-friendly message
  errors?: FieldError[];    // Validation errors
  code?: string;            // Error code for debugging
  timestamp: string;        // ISO timestamp
}

interface FieldError {
  field: string;
  message: string;
}
```

### Error Recovery Strategies

**Automatic Recovery:**
- API requests: Retry up to 2 times with exponential backoff
- WebSocket: Reconnect automatically with increasing delays
- State sync: Refetch on reconnection

**Manual Recovery:**
- Show "Retry" button for failed operations
- Provide "Refresh" option for stale data
- Allow manual reconnection for WebSocket

**Graceful Degradation:**
- Show cached data when API fails
- Disable features when integrations are down
- Provide offline mode for viewing chat history

## Testing Strategy

### Performance Testing

**Frontend Performance:**
```bash
# Lighthouse CI for performance metrics
npm run build
npx lighthouse http://localhost:5173 --output=json --output-path=./lighthouse-report.json

# Bundle size analysis
npx vite-bundle-visualizer

# React DevTools Profiler
# Manual testing with React DevTools Profiler to identify slow renders
```

**Backend Performance:**
```python
# Load testing with locust
from locust import HttpUser, task, between

class StreamerUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def get_settings(self):
        self.client.get("/api/settings")
    
    @task
    def update_stream(self):
        self.client.post("/api/stream/update", json={
            "title": "Test Stream",
            "platform": "twitch"
        })

# Run: locust -f load_test.py --host=http://localhost:8000
```

### Code Quality Testing

**Frontend:**
```bash
# TypeScript type checking
npx tsc --noEmit

# ESLint for code quality
npm run lint

# Find unused code
npx ts-prune

# Find unused dependencies
npx depcheck
```

**Backend:**
```bash
# Pylint for code quality
pylint bot_service/

# Find unused imports
pylint --disable=all --enable=unused-import bot_service/

# Find dead code
vulture bot_service/

# Type checking with mypy
mypy bot_service/
```

### Integration Testing

**Critical Flows:**
1. User authentication (OAuth flow)
2. TTS platform toggle (state sync)
3. Stream title/category update
4. WebSocket reconnection
5. Settings auto-save

**Test Approach:**
- Manual testing for critical flows
- Automated E2E tests for regression prevention (future)
- Monitor production logs for errors

## Implementation Phases

### Phase 0: Configuration and Deployment (Priority: CRITICAL)
- Create .env.example templates for all services
- Implement pydantic-settings configuration loader
- Remove all hardcoded values (URLs, secrets, credentials)
- Create migration script for easy setup
- Document distributed deployment (TTS + Bot services)
- Setup Cloudflare Tunnel configuration
- Create Docker Compose files for both machines

### Phase 0.5: Architecture Refactoring for Scalability (Priority: HIGH)
- Implement platform abstraction layer (base interface + registry)
- Separate drops calculation logic from animation widget
- Create feature module pattern for better organization
- Refactor existing platforms (Twitch, VK) to use abstraction
- Prepare architecture for Kick platform integration
- Implement RBAC permission system with role hierarchy
- Separate admin and user API endpoints
- Add platform role synchronization service

### Phase 1: WebSocket Optimization (Priority: CRITICAL)
- Implement BroadcastChannel-based leader election
- Ensure single WebSocket connection per browser
- Add connection tracking in backend
- Implement TTS generation disable on disconnect
- Add heartbeat mechanism
- Enhance reconnection logic with exponential backoff

### Phase 2: Performance Optimization (Priority: HIGH)
- Implement code splitting for routes
- Add React.memo to expensive components
- Optimize database queries with indexes
- Add connection pooling
- Implement lazy loading for heavy components

### Phase 3: Code Cleanup (Priority: MEDIUM)
- Run dependency audit and remove unused packages
- Remove dead code and unused imports
- Consolidate duplicate utility functions
- Clean up commented code
- Update dependencies to latest stable versions

### Phase 4: Error Handling (Priority: HIGH)
- Implement global error boundaries
- Add centralized API error handler
- Enhance WebSocket reconnection logic
- Add validation error display
- Implement error logging

### Phase 5: UI/UX Enhancement (Priority: MEDIUM)
- Apply consistent spacing system
- Add loading skeletons
- Implement visual feedback for actions
- Enhance form validation display
- Improve accessibility

### Phase 6: State Synchronization (Priority: HIGH)
- Implement optimistic updates with rollback
- Add WebSocket state sync
- Implement reconnection state reconciliation
- Add sync status indicators

### Phase 7: Validation Enhancement (Priority: MEDIUM)
- Add comprehensive zod schemas
- Implement input sanitization
- Enhance Pydantic models
- Add field-level validation display

## Monitoring and Metrics

### Performance Metrics

**Frontend Metrics:**
- First Contentful Paint (FCP): < 1.5s
- Largest Contentful Paint (LCP): < 2.5s
- Time to Interactive (TTI): < 3.0s
- Total Blocking Time (TBT): < 200ms
- Cumulative Layout Shift (CLS): < 0.1

**Backend Metrics:**
- API response time: < 100ms (p95)
- Database query time: < 50ms (p95)
- WebSocket message latency: < 50ms
- Error rate: < 1%
- Uptime: > 99.9%

### Success Criteria

**Performance:**
- 50% reduction in initial load time
- 30% reduction in bundle size
- 40% reduction in re-renders

**Code Quality:**
- Zero unused dependencies
- Zero dead code (verified by tools)
- 100% of inputs validated
- All errors handled gracefully

**User Experience:**
- Consistent UI spacing
- < 200ms feedback for all actions
- Zero crashes from unhandled errors
- Seamless state synchronization

## Risk Mitigation

### Protected Systems

**DO NOT MODIFY:**
- TTS system files (8 files, 1500+ lines)
- Category system files (6 files, 893+ lines)
- Authentication flow
- WebSocket system

**Mitigation:**
- Read `docs/DO_NOT_TOUCH.md` before any changes
- Test thoroughly after modifications
- Keep backups of working code
- Use feature flags for risky changes

### Rollback Strategy

**Version Control:**
- Create feature branch for each phase
- Commit after each logical change
- Tag stable versions
- Keep main branch deployable

**Deployment:**
- Test in development environment first
- Deploy to staging for validation
- Gradual rollout to production
- Monitor metrics after deployment
- Quick rollback if issues detected

## Dependencies

### New Dependencies

**Frontend:**
- None (use existing packages)

**Backend:**
- `pydantic-settings` (prod): Environment configuration management
- `vulture` (dev): Dead code detection
- `mypy` (dev): Type checking

**Infrastructure:**
- `cloudflared` (prod): Cloudflare Tunnel for TTS service

### Updated Dependencies

**Frontend:**
- Update all @radix-ui packages to latest
- Update axios to latest
- Update zod to latest

**Backend:**
- Update fastapi to latest
- Update sqlalchemy to latest
- Update pydantic to latest
- Update pydantic-settings to latest

## Permission and Role Management

### Permission System Architecture

**Problem:** Admin and user functions not properly isolated
**Solution:** Role-based access control (RBAC) with strict separation

**Permission Model (bot_service/core/permissions.py):**
```python
from enum import Enum
from typing import Set, Optional
from functools import wraps
from fastapi import HTTPException

class AppRole(str, Enum):
    """Application roles (only 3 roles in the app)"""
    ADMIN = "admin"              # System admin - full access
    USER = "user"                # Authenticated user - full features
    GUEST = "guest"              # Guest - read-only access

class Permission(str, Enum):
    """Granular permissions"""
    # Admin permissions
    MANAGE_USERS = "manage_users"
    MANAGE_VOICES_GLOBAL = "manage_voices_global"
    VIEW_SYSTEM_LOGS = "view_system_logs"
    MANAGE_PLATFORM_SETTINGS = "manage_platform_settings"
    
    # User permissions
    UPLOAD_VOICE_PERSONAL = "upload_voice_personal"
    USE_TTS = "use_tts"
    MANAGE_OWN_SETTINGS = "manage_own_settings"
    USE_DROPS = "use_drops"
    REQUEST_YOUTUBE = "request_youtube"
    MANAGE_COMMANDS = "manage_commands"
    MANAGE_POINTS = "manage_points"
    
    # Guest permissions
    VIEW_CHAT = "view_chat"

# Role -> Permissions mapping
ROLE_PERMISSIONS: dict[AppRole, Set[Permission]] = {
    AppRole.ADMIN: set(Permission),  # All permissions
    AppRole.USER: {
        Permission.UPLOAD_VOICE_PERSONAL,
        Permission.USE_TTS,
        Permission.MANAGE_OWN_SETTINGS,
        Permission.USE_DROPS,
        Permission.REQUEST_YOUTUBE,
        Permission.MANAGE_COMMANDS,
        Permission.MANAGE_POINTS,
        Permission.VIEW_CHAT,
    },
    AppRole.GUEST: {
        Permission.VIEW_CHAT,
    }
}

class PlatformRole(str, Enum):
    """Platform-specific roles (from Twitch/VK API)"""
    BROADCASTER = "broadcaster"  # Stream owner
    MODERATOR = "moderator"      # Channel moderator
    VIP = "vip"                  # VIP (Twitch only)
    SUBSCRIBER = "subscriber"    # Subscriber/follower
    VIEWER = "viewer"            # Regular viewer

def has_permission(user_role: AppRole, permission: Permission) -> bool:
    """Check if app role has permission"""
    return permission in ROLE_PERMISSIONS.get(user_role, set())

def require_permission(permission: Permission):
    """Decorator to require specific permission"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, current_user: dict = None, **kwargs):
            if not current_user:
                raise HTTPException(401, "Authentication required")
            
            user_role = AppRole(current_user.get('role', 'guest'))
            
            if not has_permission(user_role, permission):
                raise HTTPException(
                    403,
                    f"Permission denied. Required: {permission.value}"
                )
            
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator

def require_role(required_role: AppRole):
    """Decorator to require specific app role"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, current_user: dict = None, **kwargs):
            if not current_user:
                raise HTTPException(401, "Authentication required")
            
            user_role = AppRole(current_user.get('role', 'guest'))
            
            # Simple role check (only 3 roles: guest < user < admin)
            role_hierarchy = [AppRole.GUEST, AppRole.USER, AppRole.ADMIN]
            if role_hierarchy.index(user_role) < role_hierarchy.index(required_role):
                raise HTTPException(
                    403,
                    f"Insufficient permissions. Required role: {required_role.value}"
                )
            
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator

def get_platform_roles(user: User, platform: str) -> Set[PlatformRole]:
    """Get user's roles on specific platform"""
    roles = {PlatformRole.VIEWER}  # Everyone is at least a viewer
    
    if platform == 'twitch':
        if user.twitch_is_broadcaster:
            roles.add(PlatformRole.BROADCASTER)
        if user.twitch_is_moderator:
            roles.add(PlatformRole.MODERATOR)
        if user.twitch_is_vip:
            roles.add(PlatformRole.VIP)
        if user.twitch_is_subscriber:
            roles.add(PlatformRole.SUBSCRIBER)
    elif platform == 'vk':
        if user.vk_is_broadcaster:
            roles.add(PlatformRole.BROADCASTER)
        if user.vk_is_moderator:
            roles.add(PlatformRole.MODERATOR)
        if user.vk_is_subscriber:
            roles.add(PlatformRole.SUBSCRIBER)
    
    return roles
```

**Separate Admin and User Endpoints:**
```python
# bot_service/api/admin/voices_api.py
from core.permissions import require_permission, Permission

@router.post("/admin/voices/upload")
@require_permission(Permission.MANAGE_VOICES_GLOBAL)
async def admin_upload_voice(
    file: UploadFile,
    voice_name: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin uploads voice for ANY user"""
    # Admin can upload voices globally
    # Can assign to any user
    # Can set as default
    ...

# bot_service/api/user/voices_api.py
@router.post("/user/voices/upload")
@require_permission(Permission.UPLOAD_VOICE_PERSONAL)
async def user_upload_voice(
    file: UploadFile,
    voice_name: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """User uploads voice for THEMSELVES only"""
    user_id = current_user['id']
    
    # User can only upload for themselves
    # Cannot set as default for others
    # Limited to personal voice slots
    
    # Check user's voice quota
    voice_count = db.query(Voice).filter(
        Voice.user_id == user_id,
        Voice.is_personal == True
    ).count()
    
    if voice_count >= 5:  # User limit
        raise HTTPException(400, "Voice limit reached (5 personal voices)")
    
    ...
```

**Database Model with Roles:**
```python
# bot_service/core/database.py
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    
    # Application role (only 3 roles)
    role = Column(String, default="user")  # guest, user, admin
    is_active = Column(Boolean, default=True)
    
    # Platform-specific roles (synced from Twitch/VK API)
    # These are used for command permissions, not app permissions
    twitch_is_broadcaster = Column(Boolean, default=False)
    twitch_is_moderator = Column(Boolean, default=False)
    twitch_is_vip = Column(Boolean, default=False)
    twitch_is_subscriber = Column(Boolean, default=False)
    
    vk_is_broadcaster = Column(Boolean, default=False)
    vk_is_moderator = Column(Boolean, default=False)
    vk_is_subscriber = Column(Boolean, default=False)
```

### Platform API Synchronization

**Problem:** Commands and roles not synced with platform APIs
**Solution:** Automatic role sync from platform APIs

**Platform Role Sync Service:**
```python
# bot_service/services/platform_sync_service.py
from platforms.registry import platform_registry

class PlatformSyncService:
    """Synchronize roles and permissions from platform APIs"""
    
    async def sync_user_roles(self, user_id: int, platform: str, db: Session):
        """Sync user roles from platform API"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return
        
        platform_impl = platform_registry.get(platform)
        if not platform_impl:
            return
        
        # Get user info from platform
        access_token = self._get_user_token(user, platform)
        user_info = await platform_impl.get_user_info(access_token)
        
        # Update platform-specific roles
        if platform == 'twitch':
            user.twitch_is_broadcaster = user_info.get('is_broadcaster', False)
            user.twitch_is_moderator = user_info.get('is_moderator', False)
            user.twitch_is_vip = user_info.get('is_vip', False)
            user.twitch_is_subscriber = user_info.get('is_subscriber', False)
        elif platform == 'vk':
            user.vk_is_broadcaster = user_info.get('is_broadcaster', False)
            user.vk_is_moderator = user_info.get('is_moderator', False)
            user.vk_is_subscriber = user_info.get('is_subscriber', False)
        
        db.commit()
        logger.info(f"Synced roles for user {user_id} from {platform}")
    
    async def sync_channel_points(self, user_id: int, platform: str, db: Session):
        """Sync channel points rewards with platform API"""
        if platform == 'twitch':
            await self._sync_twitch_rewards(user_id, db)
        elif platform == 'vk':
            await self._sync_vk_rewards(user_id, db)
    
    async def _sync_twitch_rewards(self, user_id: int, db: Session):
        """Sync Twitch channel points rewards"""
        # Get rewards from database
        db_rewards = db.query(ChannelPointsReward).filter(
            ChannelPointsReward.user_id == user_id,
            ChannelPointsReward.platform == 'twitch'
        ).all()
        
        # Get rewards from Twitch API
        twitch = platform_registry.get('twitch')
        access_token = self._get_user_token_by_id(user_id, 'twitch', db)
        api_rewards = await twitch.get_channel_rewards(access_token)
        
        # Sync: Update existing, create new, mark deleted
        for db_reward in db_rewards:
            api_reward = next(
                (r for r in api_rewards if r['id'] == db_reward.platform_reward_id),
                None
            )
            if api_reward:
                # Update from API
                db_reward.title = api_reward['title']
                db_reward.cost = api_reward['cost']
                db_reward.is_enabled = api_reward['is_enabled']
            else:
                # Reward deleted on platform
                db_reward.is_deleted = True
        
        db.commit()
        logger.info(f"Synced Twitch rewards for user {user_id}")

platform_sync_service = PlatformSyncService()
```

**Automatic Sync on Login:**
```python
# bot_service/auth/auth.py
@router.post("/auth/{platform}/callback")
async def platform_callback(
    platform: str,
    code: str,
    db: Session = Depends(get_db)
):
    # ... OAuth flow ...
    
    # After successful login, sync roles
    await platform_sync_service.sync_user_roles(user.id, platform, db)
    await platform_sync_service.sync_channel_points(user.id, platform, db)
    
    return {"token": token}
```

**Command Permission Check with Platform Roles:**
```python
# bot_service/bots/command_handler.py
from core.permissions import get_platform_roles, PlatformRole

async def can_use_command(
    user_id: int,
    command: Command,
    platform: str,
    db: Session
) -> bool:
    """
    Check if user can use command based on PLATFORM roles
    (not app roles - those are only for admin panel access)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    
    # Get user's platform-specific roles
    platform_roles = get_platform_roles(user, platform)
    
    # Check command permission level against platform roles
    required_role = PlatformRole(command.permission_level)
    
    # Role hierarchy for commands
    if required_role == PlatformRole.VIEWER:
        return True  # Everyone can use
    elif required_role == PlatformRole.SUBSCRIBER:
        return PlatformRole.SUBSCRIBER in platform_roles or \
               PlatformRole.VIP in platform_roles or \
               PlatformRole.MODERATOR in platform_roles or \
               PlatformRole.BROADCASTER in platform_roles
    elif required_role == PlatformRole.VIP:
        # VIP only on Twitch
        if platform == 'twitch':
            return PlatformRole.VIP in platform_roles or \
                   PlatformRole.MODERATOR in platform_roles or \
                   PlatformRole.BROADCASTER in platform_roles
        return False
    elif required_role == PlatformRole.MODERATOR:
        return PlatformRole.MODERATOR in platform_roles or \
               PlatformRole.BROADCASTER in platform_roles
    elif required_role == PlatformRole.BROADCASTER:
        return PlatformRole.BROADCASTER in platform_roles
    
    return False

# Example usage in bot
async def handle_chat_command(message, platform: str):
    user = get_user_from_message(message)
    command = get_command(message.content)
    
    if not command:
        return
    
    # Check if user has permission based on PLATFORM role
    if not await can_use_command(user.id, command, platform, db):
        await send_message(f"@{user.username}, у вас нет прав для этой команды")
        return
    
    # Execute command
    await execute_command(command, message, platform)
```

## Security Considerations

### Configuration Security

**Secrets Management:**
- All secrets in .env files (gitignored)
- Generate unique keys per installation
- Use Fernet encryption for OAuth tokens
- Rotate keys periodically

**Environment Separation:**
- Separate .env files for dev/prod
- Different OAuth credentials per environment
- Separate databases for dev/prod

### Network Security

**Cloudflare Tunnel Benefits:**
- No open ports on local machine
- DDoS protection
- SSL/TLS encryption
- Access control via Cloudflare

**API Security:**
- CORS configured per environment
- Rate limiting per endpoint
- JWT token validation
- Input sanitization

### Deployment Security

**Docker Security:**
- Non-root user in containers
- Read-only file systems where possible
- Resource limits (CPU, memory)
- Network isolation

**Database Security:**
- Strong passwords (environment variables)
- Connection encryption (SSL)
- Regular backups
- Access control (firewall rules)

## Conclusion

This design provides a comprehensive approach to stabilizing and optimizing the TTS_TTV_0.02 application while respecting existing working systems. Key improvements include:

1. **Deployment Portability:** Complete environment-based configuration with no hardcoded values
2. **Distributed Architecture:** Support for TTS service (local + Cloudflare) and bot service (remote) separation
3. **WebSocket Optimization:** Single connection per browser with proper leader election and resource management
4. **Resource Efficiency:** Automatic TTS generation disable when no active connections

The implementation will be done in phases, with configuration/deployment and WebSocket optimization as critical priorities. Each phase includes clear success criteria and testing strategies to ensure quality improvements without breaking existing functionality.
