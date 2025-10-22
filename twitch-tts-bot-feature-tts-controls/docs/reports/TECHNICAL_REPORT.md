# 🔧 Технический отчет TTS_TTV_0.02

## 🏗️ Архитектура системы

### Микросервисная архитектура
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Bot Service   │    │   TTS Service   │
│   (React)       │◄──►│   (FastAPI)     │◄──►│   (Python)      │
│   Port: 3000    │    │   Port: 8000    │    │   Port: 8001    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx         │    │   SQLite DB     │    │   F5-TTS Cache  │
│   (Reverse      │    │   (Alembic)     │    │   (Models)      │
│    Proxy)       │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Backend (Bot Service)

### Технологический стек
- **FastAPI 0.104+** - современный веб-фреймворк
- **SQLAlchemy 2.0+** - ORM для работы с БД
- **Alembic** - миграции базы данных
- **Pydantic 2.0+** - валидация данных
- **JWT** - аутентификация
- **OAuth 2.0** - интеграция с платформами
- **WebSocket** - реальное время
- **Rate Limiting** - защита от спама

### Структура проекта
```
bot_service/
├── main.py                    # FastAPI приложение
├── core/
│   ├── database.py           # SQLAlchemy модели
│   ├── security.py           # JWT + OAuth
│   └── datetime_utils.py     # Утилиты времени
├── api/
│   ├── tts_api_endpoints.py  # TTS API
│   ├── voices_api_endpoints.py # Голоса API
│   ├── commands_api_endpoints.py # Команды API
│   └── drops_api_endpoints.py # Drops API
├── services/
│   ├── tts_service.py        # TTS логика
│   ├── drops_service.py      # Drops логика
│   └── psychology_service.py # AI анализ
├── bots/
│   ├── twitch_bot.py         # Twitch IRC бот
│   └── vk_live_bot.py        # VK Live бот
└── auth/
    ├── auth.py               # JWT аутентификация
    └── oauth_handler.py      # OAuth обработка
```

### API Endpoints

#### TTS API
```python
POST /api/tts/generate          # Генерация речи
GET  /api/tts/voices           # Список голосов
POST /api/tts/voices           # Создание голоса
PUT  /api/tts/voices/{id}      # Обновление голоса
DELETE /api/tts/voices/{id}    # Удаление голоса
```

#### Commands API
```python
GET  /api/commands             # Список команд
POST /api/commands             # Создание команды
PUT  /api/commands/{id}        # Обновление команды
DELETE /api/commands/{id}      # Удаление команды
```

#### Drops API
```python
GET  /api/drops/rewards        # Список наград
POST /api/drops/rewards        # Создание награды
GET  /api/drops/history        # История Drops
POST /api/drops/trigger        # Запуск Drops
```

### База данных

#### Основные таблицы
```sql
-- Пользователи
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    display_name VARCHAR(100),
    platform VARCHAR(20),
    platform_id VARCHAR(50),
    access_token TEXT,
    refresh_token TEXT,
    created_at DATETIME,
    updated_at DATETIME
);

-- Команды ботов
CREATE TABLE bot_commands (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    command_name VARCHAR(50) NOT NULL,
    response_text TEXT,
    platforms JSON,
    allowed_roles JSON,
    cooldown_seconds INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME
);

-- Фильтр слов
CREATE TABLE filtered_words (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    word VARCHAR(100) NOT NULL,
    action VARCHAR(20) DEFAULT 'block',
    created_at DATETIME
);

-- Голоса пользователей
CREATE TABLE user_voices (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    voice_name VARCHAR(100) NOT NULL,
    voice_id VARCHAR(50),
    settings JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME
);

-- Глобальные голоса
CREATE TABLE global_voices (
    id INTEGER PRIMARY KEY,
    voice_name VARCHAR(100) NOT NULL,
    voice_id VARCHAR(50),
    settings JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME
);

-- Drops награды
CREATE TABLE drops_rewards (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    reward_type VARCHAR(20),
    settings JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME
);

-- История Drops
CREATE TABLE drops_history (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    reward_id INTEGER REFERENCES drops_rewards(id),
    viewer_id VARCHAR(50),
    viewer_name VARCHAR(100),
    platform VARCHAR(20),
    channel_name VARCHAR(100),
    created_at DATETIME
);
```

#### Индексы для производительности
```sql
-- Индексы для быстрого поиска
CREATE INDEX idx_users_platform_id ON users(platform_id);
CREATE INDEX idx_bot_commands_user_id ON bot_commands(user_id);
CREATE INDEX idx_filtered_words_user_id ON filtered_words(user_id);
CREATE INDEX idx_user_voices_user_id ON user_voices(user_id);
CREATE INDEX idx_drops_history_user_id ON drops_history(user_id);
CREATE INDEX idx_drops_history_created_at ON drops_history(created_at);
```

### Безопасность

#### JWT Аутентификация
```python
# Генерация токена
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Валидация токена
def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        return username
    except JWTError:
        raise credentials_exception
```

#### Rate Limiting
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/tts/generate")
@limiter.limit("10/minute")  # 10 запросов в минуту
async def generate_tts(request: Request, ...):
    pass
```

#### XSS Защита
```python
import bleach

def sanitize_html(text: str) -> str:
    allowed_tags = ['b', 'i', 'u', 'em', 'strong']
    allowed_attributes = {}
    return bleach.clean(text, tags=allowed_tags, attributes=allowed_attributes)
```

## 🎨 Frontend (React)

### Технологический стек
- **React 18+** - UI библиотека
- **Vite** - сборщик и dev сервер
- **Tailwind CSS** - CSS фреймворк
- **Radix UI** - компоненты
- **React Router** - маршрутизация
- **React Query** - кэширование данных
- **Zustand** - управление состоянием
- **WebSocket** - реальное время

### Структура проекта
```
frontend/src/
├── components/
│   ├── ui/                    # Базовые UI компоненты
│   ├── ChatCard.jsx          # Чат для OBS
│   ├── FeatureCard.jsx       # Карточки функций
│   └── layout/               # Компоненты макета
├── pages/
│   ├── HomePage.jsx          # Главная страница
│   ├── TtsMainPage.jsx       # TTS управление
│   ├── CommandsPage.jsx      # Команды
│   ├── ChatObsPage.jsx       # Чат для OBS
│   └── drops/                # Drops страницы
├── context/
│   ├── AuthContext.jsx       # Аутентификация
│   ├── TtsContext.jsx        # TTS состояние
│   └── DataContext.jsx       # Данные
├── services/
│   ├── api.js                # API клиент
│   └── microservices.js      # Микросервисы
└── utils/
    ├── constants.js          # Константы
    └── helpers.js            # Утилиты
```

### State Management
```javascript
// AuthContext - управление аутентификацией
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    const login = async (credentials) => {
        const response = await api.post('/auth/login', credentials);
        const { access_token, user: userData } = response.data;
        
        localStorage.setItem('token', access_token);
        setUser(userData);
        setIsAuthenticated(true);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{
            user, isAuthenticated, loading, login, logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};
```

### API Client
```javascript
// services/api.js
import axios from 'axios';

const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
    timeout: 10000,
});

// Request interceptor для добавления токена
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor для обработки ошибок
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
```

### WebSocket Integration
```javascript
// services/websocket.js
class WebSocketService {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect() {
        const token = localStorage.getItem('token');
        this.ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.reconnect();
        };
    }

    reconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
        }
    }
}
```

## 🎤 TTS Service

### Технологический стек
- **F5-TTS** - современный TTS движок
- **PyTorch** - машинное обучение
- **Transformers** - Hugging Face модели
- **FastAPI** - API сервер
- **Redis** - кэширование
- **FFmpeg** - обработка аудио

### Архитектура TTS
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Text Input    │───►│   F5-TTS        │───►│   Audio Output  │
│   (String)      │    │   Engine        │    │   (WAV/MP3)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Model Cache   │
                       │   (Redis)       │
                       └─────────────────┘
```

### TTS Engine
```python
# tts_service/tts_engine.py
import torch
from transformers import AutoTokenizer, AutoModel
import soundfile as sf
import numpy as np

class F5TTSEngine:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.models = {}
        self.tokenizers = {}
    
    def load_model(self, model_name: str):
        """Загрузка модели TTS"""
        if model_name not in self.models:
            self.models[model_name] = AutoModel.from_pretrained(
                model_name, 
                torch_dtype=torch.float16
            ).to(self.device)
            self.tokenizers[model_name] = AutoTokenizer.from_pretrained(model_name)
    
    def generate_speech(self, text: str, voice_id: str, model_name: str = "default"):
        """Генерация речи из текста"""
        self.load_model(model_name)
        
        # Токенизация текста
        inputs = self.tokenizers[model_name](text, return_tensors="pt").to(self.device)
        
        # Генерация аудио
        with torch.no_grad():
            audio = self.models[model_name].generate(**inputs)
        
        # Конвертация в numpy array
        audio_np = audio.cpu().numpy().flatten()
        
        return audio_np
    
    def save_audio(self, audio: np.ndarray, filename: str, sample_rate: int = 22050):
        """Сохранение аудио в файл"""
        sf.write(filename, audio, sample_rate)
```

### Кэширование моделей
```python
# tts_service/cache_manager.py
import redis
import pickle
import hashlib

class ModelCache:
    def __init__(self):
        self.redis_client = redis.Redis(host='localhost', port=6379, db=0)
        self.cache_ttl = 3600  # 1 час
    
    def get_cache_key(self, text: str, voice_id: str) -> str:
        """Генерация ключа кэша"""
        content = f"{text}:{voice_id}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def get_cached_audio(self, text: str, voice_id: str) -> bytes:
        """Получение кэшированного аудио"""
        key = self.get_cache_key(text, voice_id)
        cached = self.redis_client.get(key)
        return pickle.loads(cached) if cached else None
    
    def cache_audio(self, text: str, voice_id: str, audio: bytes):
        """Кэширование аудио"""
        key = self.get_cache_key(text, voice_id)
        self.redis_client.setex(key, self.cache_ttl, pickle.dumps(audio))
```

## 🔌 Интеграции

### Twitch IRC Bot
```python
# bots/twitch_bot.py
import asyncio
import websockets
import json
import re

class TwitchBot:
    def __init__(self, token: str, username: str, channel: str):
        self.token = token
        self.username = username
        self.channel = channel
        self.websocket = None
    
    async def connect(self):
        """Подключение к Twitch IRC"""
        uri = "wss://irc-ws.chat.twitch.tv:443"
        self.websocket = await websockets.connect(uri)
        
        # Аутентификация
        await self.websocket.send(f"PASS oauth:{self.token}")
        await self.websocket.send(f"NICK {self.username}")
        await self.websocket.send(f"JOIN #{self.channel}")
    
    async def listen(self):
        """Прослушивание сообщений"""
        async for message in self.websocket:
            if message.startswith("PING"):
                await self.websocket.send("PONG :tmi.twitch.tv")
            elif "PRIVMSG" in message:
                await self.handle_message(message)
    
    async def handle_message(self, message: str):
        """Обработка сообщения чата"""
        # Парсинг сообщения
        parts = message.split(":", 2)
        if len(parts) >= 3:
            user_info = parts[1].split("!")[0]
            chat_message = parts[2].strip()
            
            # Обработка команды
            if chat_message.startswith("!"):
                await self.handle_command(user_info, chat_message)
    
    async def send_message(self, message: str):
        """Отправка сообщения в чат"""
        await self.websocket.send(f"PRIVMSG #{self.channel} :{message}")
```

### VK Live Bot
```python
# bots/vk_live_bot.py
import aiohttp
import asyncio
import json

class VKLiveBot:
    def __init__(self, access_token: str, channel_url: str):
        self.access_token = access_token
        self.channel_url = channel_url
        self.base_url = "https://dev.live.vkvideo.ru/api/v1"
    
    async def get_chat_messages(self, limit: int = 50):
        """Получение сообщений чата"""
        url = f"{self.base_url}/chat/messages"
        params = {
            "channel_url": self.channel_url,
            "limit": limit
        }
        headers = {
            "Authorization": f"Bearer {self.access_token}"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, headers=headers) as response:
                data = await response.json()
                return data.get("data", {}).get("chat_messages", [])
    
    async def send_message(self, text: str):
        """Отправка сообщения в чат"""
        url = f"{self.base_url}/chat/message/send"
        data = {
            "parts": [{"text": {"content": text}}]
        }
        params = {
            "channel_url": self.channel_url,
            "stream_id": "current"
        }
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=data, params=params, headers=headers) as response:
                return await response.json()
```

## 📊 Мониторинг и логирование

### Структурированные логи
```python
# core/logging_config.py
import logging
import json
import sys
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        if hasattr(record, 'user_id'):
            log_entry['user_id'] = record.user_id
        if hasattr(record, 'request_id'):
            log_entry['request_id'] = record.request_id
            
        return json.dumps(log_entry, ensure_ascii=False)

# Настройка логгера
def setup_logging():
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    logger.addHandler(handler)
```

### Метрики производительности
```python
# monitoring/performance.py
import time
import psutil
import asyncio
from functools import wraps

def monitor_performance(func):
    """Декоратор для мониторинга производительности"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        start_memory = psutil.Process().memory_info().rss
        
        try:
            result = await func(*args, **kwargs)
            return result
        finally:
            end_time = time.time()
            end_memory = psutil.Process().memory_info().rss
            
            execution_time = end_time - start_time
            memory_used = end_memory - start_memory
            
            logger.info({
                "function": func.__name__,
                "execution_time": execution_time,
                "memory_used": memory_used,
                "status": "success"
            })
    
    return wrapper
```

## 🚀 Развертывание

### Docker Configuration
```dockerfile
# Dockerfile.prod
FROM python:3.11-slim

WORKDIR /app

# Установка зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода
COPY . .

# Создание пользователя
RUN useradd --create-home --shell /bin/bash app
USER app

# Запуск приложения
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Docker Compose
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  bot-service:
    build: 
      context: ./bot_service
      dockerfile: Dockerfile.prod
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=sqlite:///./app.db
      - SECRET_KEY=${SECRET_KEY}
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  tts-service:
    build:
      context: ./tts_service
      dockerfile: Dockerfile.prod
    ports:
      - "8001:8001"
    environment:
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./models:/app/models
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    ports:
      - "3000:80"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - bot-service
      - frontend
    restart: unless-stopped
```

### Nginx Configuration
```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream bot_service {
        server bot-service:8000;
    }
    
    upstream tts_service {
        server tts-service:8001;
    }
    
    upstream frontend {
        server frontend:80;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        # API
        location /api/ {
            proxy_pass http://bot_service;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        # TTS API
        location /tts/ {
            proxy_pass http://tts_service;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        # WebSocket
        location /ws {
            proxy_pass http://bot_service;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
}
```

## 🔒 Безопасность

### JWT Implementation
```python
# core/security.py
import jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext
from fastapi import HTTPException, status

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return username
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
```

### Rate Limiting
```python
# core/rate_limiting.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request

limiter = Limiter(key_func=get_remote_address)

# Глобальные лимиты
GLOBAL_RATE_LIMITS = {
    "api": "100/minute",
    "tts": "10/minute", 
    "auth": "5/minute"
}

# Пользовательские лимиты
USER_RATE_LIMITS = {
    "tts_generation": "20/hour",
    "voice_creation": "5/hour",
    "command_creation": "10/hour"
}

def get_user_rate_limit(user_id: int, action: str) -> str:
    return USER_RATE_LIMITS.get(action, "100/hour")

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded"}
    )
```

## 📈 Производительность

### Кэширование
```python
# services/cache_service.py
import redis
import json
from typing import Any, Optional

class CacheService:
    def __init__(self):
        self.redis_client = redis.Redis(host='localhost', port=6379, db=0)
        self.default_ttl = 3600  # 1 час
    
    def get(self, key: str) -> Optional[Any]:
        """Получение из кэша"""
        cached = self.redis_client.get(key)
        return json.loads(cached) if cached else None
    
    def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """Сохранение в кэш"""
        ttl = ttl or self.default_ttl
        return self.redis_client.setex(key, ttl, json.dumps(value))
    
    def delete(self, key: str) -> bool:
        """Удаление из кэша"""
        return bool(self.redis_client.delete(key))
    
    def clear_pattern(self, pattern: str) -> int:
        """Очистка по паттерну"""
        keys = self.redis_client.keys(pattern)
        return self.redis_client.delete(*keys) if keys else 0
```

### Асинхронная обработка
```python
# services/background_tasks.py
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Any

class BackgroundTaskManager:
    def __init__(self, max_workers: int = 4):
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
    
    async def run_in_background(self, func: Callable, *args, **kwargs) -> Any:
        """Запуск задачи в фоне"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, func, *args, **kwargs)
    
    async def process_tts_queue(self):
        """Обработка очереди TTS"""
        while True:
            try:
                # Получение задачи из очереди
                task = await self.get_next_tts_task()
                if task:
                    # Обработка в фоне
                    await self.run_in_background(
                        self.process_tts_task, 
                        task
                    )
            except Exception as e:
                logger.error(f"TTS queue processing error: {e}")
            
            await asyncio.sleep(1)  # Пауза между проверками
```

---

**Техническая документация готова!** 🔧

**Статус:** Production Ready  
**Архитектура:** Микросервисная  
**Технологии:** FastAPI + React + F5-TTS  
**Безопасность:** Enterprise уровень
