# bot_service/tests/conftest.py
"""
Конфигурация pytest для bot_service
"""
import os
import sys
import pytest
import asyncio
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool

# Добавляем путь к проекту
project_root = Path(__file__).parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Добавляем путь к bot_service
bot_service_root = Path(__file__).parent.parent
if str(bot_service_root) not in sys.path:
    sys.path.insert(0, str(bot_service_root))

from core.database import Base, get_db
from core.session_manager import session_manager
from main import app

# Тестовая база данных
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def event_loop():
    """Создает event loop для тестов"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
def db_session():
    """Создает тестовую сессию базы данных"""
    # Очищаем БД перед каждым тестом
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    # Создаем таблицу user_sessions если её нет
    from sqlalchemy import text
    session = TestingSessionLocal()
    try:
        # Проверяем существует ли таблица user_sessions
        result = session.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='user_sessions'"))
        if not result.fetchone():
            # Создаем таблицу user_sessions с правильной схемой
            session.execute(text("""
                CREATE TABLE user_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    session_id VARCHAR(255) UNIQUE NOT NULL,
                    device_info TEXT,
                    created_at TIMESTAMP,
                    last_activity TIMESTAMP,
                    expires_at TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1
                )
            """))
            session.commit()
        
        yield session
    finally:
        session.close()
        # Очищаем БД после каждого теста
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    """Создает тестовый клиент FastAPI"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    # Отключаем middleware для тестов
    app.dependency_overrides[get_db] = override_get_db
    
    # Отключаем инициализацию ботов в тестах
    import os
    os.environ["TESTING"] = "true"
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()
    if "TESTING" in os.environ:
        del os.environ["TESTING"]

@pytest.fixture(scope="function")
def test_user(db_session):
    """Создает тестового пользователя"""
    from core.database import User
    
    user = User(
        id=1,
        is_admin=True,
        is_active=True,
        twitch_username="testuser",
        vk_username="testuser_vk"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture(scope="function")
def test_session(test_user):
    """Создает тестовую сессию"""
    session_id = session_manager.create_session(test_user.id)
    return session_id

@pytest.fixture(scope="function")
def authenticated_client(client, test_session):
    """Создает аутентифицированный тестовый клиент"""
    client.cookies.set("session_id", test_session)
    return client

@pytest.fixture(scope="function")
def mock_twitch_api():
    """Мок для Twitch API"""
    class MockTwitchAPI:
        async def get_user_by_id(self, user_id):
            return {"id": user_id, "login": "testuser", "display_name": "TestUser"}
        
        async def get_user_by_username(self, username, token):
            return {"id": "123", "login": username, "display_name": "TestUser"}
        
        async def get_user_from_token(self, token):
            return {"id": "123", "login": "testuser", "display_name": "TestUser"}
    
    return MockTwitchAPI()

@pytest.fixture(scope="function")
def mock_vk_api():
    """Мок для VK API"""
    class MockVKAPI:
        async def get_user_info(self, user_id, token):
            return {"id": user_id, "first_name": "Test", "last_name": "User"}
    
    return MockVKAPI()

@pytest.fixture(scope="function")
def mock_connection_manager():
    """Мок для ConnectionManager"""
    class MockConnectionManager:
        def __init__(self):
            self.active_connections = {}
            self.tts_enabled_channels = set()
            self.whitelisted_channels = set()
        
        def is_tts_enabled(self, channel, platform):
            return channel in self.tts_enabled_channels
        
        def is_channel_whitelisted(self, channel):
            return channel in self.whitelisted_channels
        
        def get_active_channels(self):
            return list(self.tts_enabled_channels)
        
        async def get_twitch_channels_for_bot(self, db):
            return list(self.tts_enabled_channels)
    
    return MockConnectionManager()

@pytest.fixture(scope="function")
def mock_tts_manager():
    """Мок для TTS Manager"""
    class MockTTSManager:
        async def synthesize_tts(self, channel_name, text, author, **kwargs):
            return {
                "success": True,
                "voice": "test_voice",
                "volume": 50.0,
                "tts_type": "basic"
            }
    
    return MockTTSManager()
