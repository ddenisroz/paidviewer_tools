
import os
from sqlalchemy import create_engine, Column, Integer, String, Boolean, JSON, DateTime, ForeignKey, Float
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import SQLAlchemyError
import logging
from datetime import datetime
from sqlalchemy.sql import func

# --- Constants ---
DEFAULT_BLOCKED_BOTS = [
    "StreamElements", "Nightbot", "Streamlabs", "Moobot", "TwirApp"
]

# Убираем заглушки голосов - TTS сервис будет работать с реальными голосами
DEFAULT_VOICES = []

# Настройка логирования
logger = logging.getLogger(__name__)

# Получаем путь к директории, где находится этот файл
DATABASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Создаем папку 'data', если ее нет
DATA_DIR = os.path.join(DATABASE_DIR, 'data')
os.makedirs(DATA_DIR, exist_ok=True)

# Определяем путь к файлу базы данных
DATABASE_URL = f"sqlite:///{os.path.join(DATA_DIR, 'app_data.db')}"

try:
    # Создаем движок SQLAlchemy
    # check_same_thread=False требуется для SQLite при использовании с FastAPI
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)

    # Создаем сессию для взаимодействия с БД
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Базовый класс для моделей
    Base = declarative_base()

    # Определяем модели данных (таблицы)

    class User(Base):
        """Модель единой учетной записи пользователя в приложении."""
        __tablename__ = "users"
        id = Column(Integer, primary_key=True, autoincrement=True)
        display_name = Column(String, nullable=True)
        is_admin = Column(Boolean, default=False)
        created_at = Column(DateTime, default=datetime.utcnow)
        
    class WhitelistedChannel(Base):
        """Модель канала в белом списке"""
        __tablename__ = "whitelisted_channels"
        id = Column(Integer, primary_key=True)
        channel_name = Column(String, unique=True, nullable=False, index=True)
        is_enabled = Column(Boolean, default=True)
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

        def __repr__(self):
            return f"<WhitelistedChannel(channel_name='{self.channel_name}', is_enabled={self.is_enabled})>"

    class MutedUser(Base):
        """Модель заглушенных пользователей на канале"""
        __tablename__ = "muted_users"
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, index=True, nullable=False)
        username = Column(String, index=True, nullable=False)

    class YouTubeVideo(Base):
        """Модель для видео в очереди YouTube"""
        __tablename__ = "youtube_queue"
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(String, ForeignKey('users.id'), nullable=False)
        video_id = Column(String, nullable=False)
        title = Column(String, nullable=False)
        thumbnail = Column(String, nullable=False)
        duration = Column(Integer, nullable=False) # в секундах
        requested_by = Column(String, nullable=False)
        url = Column(String, nullable=False)
        added_at = Column(DateTime, default=datetime.utcnow, index=True)

    class StreamData(Base):
        """Модель данных о потоке"""
        __tablename__ = "stream_data"
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(String, ForeignKey('users.id'), nullable=False)
        platform = Column(String, nullable=False)
        stream_id = Column(String, nullable=True)
        viewer_count = Column(Integer)
        category_name = Column(String, nullable=True)
        timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    class BlockedBot(Base):
        __tablename__ = 'blocked_bots'
        id = Column(Integer, primary_key=True, index=True)
        bot_name = Column(String, unique=True, index=True, nullable=False)
        added_at = Column(DateTime, default=datetime.utcnow)

    class Voice(Base):
        __tablename__ = 'voices'
        id = Column(Integer, primary_key=True, index=True)
        name = Column(String, unique=True, index=True, nullable=False)
        file_path = Column(String, nullable=False)
        reference_text = Column(String, nullable=True)

    class GuestVerification(Base):
        """Модель для данных верификации гостевых подключений"""
        __tablename__ = 'guest_verifications'
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, unique=True, index=True, nullable=False)
        verification_code = Column(String, nullable=False)
        is_verified = Column(Boolean, default=False)
        created_at = Column(DateTime, default=datetime.utcnow)
        verified_at = Column(DateTime, nullable=True)
        
        # Настройки генерации TTS (настраиваемые пользователем)
        cfg_strength = Column(Float, default=2.5)  # CFG strength (2.0-5.0 рекомендуется) - ЕДИНСТВЕННЫЙ настраиваемый параметр
        
        # Автоматически определяемые системой параметры (НЕ хранятся в БД)
        # target_rms, speed, nfe_step - определяются динамически в коде
        
        # Фиксированные параметры (не настраиваемые пользователем)
        cross_fade_duration = Column(Float, default=0.15)
        silence_duration_ms = Column(Integer, default=100)
        sway_sampling_coef = Column(Float, default=-1.0)

    class BlockedChannel(Base):
        """Модель для заблокированных каналов"""
        __tablename__ = 'blocked_channels'
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, unique=True, index=True, nullable=False)
        reason = Column(String, nullable=True)  # Причина блокировки
        blocked_by = Column(String, nullable=True)  # Кто заблокировал
        created_at = Column(DateTime, default=datetime.utcnow)
        is_active = Column(Boolean, default=True)  # Активна ли блокировка

    class UserToken(Base):
        """Модель токенов пользователей для разных платформ, привязанная к единому user_id."""
        __tablename__ = 'user_tokens'
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
        platform = Column(String, nullable=False)
        platform_user_id = Column(String, nullable=False, index=True) # ID пользователя на платформе (Twitch, VK)
        platform_display_name = Column(String, nullable=True) # Имя пользователя на платформе
        avatar_url = Column(String, nullable=True) # URL аватара с платформы
        access_token = Column(String, nullable=False)
        refresh_token = Column(String, nullable=True)
        expires_at = Column(DateTime, nullable=True)
        scopes = Column(JSON, nullable=True) # Права доступа (scopes)
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    class UserSession(Base):
        """Модель активных сессий, привязанная к единому user_id."""
        __tablename__ = 'user_sessions'
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
        session_id = Column(String, unique=True, index=True, nullable=False)
        device_info = Column(JSON, nullable=True)
        created_at = Column(DateTime, default=datetime.utcnow)
        last_activity = Column(DateTime, default=datetime.utcnow)
        is_active = Column(Boolean, default=True)

    class VkGuestVerification(Base):
        """Модель для данных верификации VK Live гостевых подключений"""
        __tablename__ = 'vk_guest_verifications'
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, unique=True, index=True, nullable=False)
        verification_code = Column(String, nullable=False)
        is_verified = Column(Boolean, default=False)
        created_at = Column(DateTime, default=datetime.utcnow)
        verified_at = Column(DateTime, nullable=True)


    def get_db():
        """Функция-генератор для получения сессии БД"""
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

except Exception as e:
    logger.error(f"❌ Не удалось сконфигурировать базу данных: {e}")
    # Устанавливаем заглушки, чтобы приложение не падало
    engine = None
    SessionLocal = None
    Base = object()
    User = WhitelistedChannel = YouTubeVideo = object()
    def get_db():
        raise RuntimeError("База данных не сконфигурирована")
    def init_db():
        raise RuntimeError("База данных не сконфигурирована")

def init_db():
    """Инициализирует базу данных и создает таблицы, если их нет."""
    if engine is None:
        logger.error("❌ База данных не сконфигурирована")
        return
        
    # Создаем все таблицы
    Base.metadata.create_all(bind=engine)
    logger.info("✅ База данных успешно инициализирована.")

    # Добавление ботов по умолчанию, если их нет
    db = SessionLocal()
    try:
        existing_bots = {bot.bot_name for bot in db.query(BlockedBot).all()}
        for bot_name in DEFAULT_BLOCKED_BOTS:
            if bot_name not in existing_bots:
                db_bot = BlockedBot(bot_name=bot_name)
                db.add(db_bot)
        
        # Добавление голосов по умолчанию, если их нет
        existing_voices = {voice.name for voice in db.query(Voice).all()}
        for voice_data in DEFAULT_VOICES:
            if voice_data["name"] not in existing_voices:
                db_voice = Voice(**voice_data)
                db.add(db_voice)
        
        db.commit()
    finally:
        db.close()
