
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
        """Модель пользователя"""
        __tablename__ = "users"
        id = Column(String, primary_key=True, index=True) # Twitch User ID
        username = Column(String, unique=True, index=True)
        display_name = Column(String)
        email = Column(String, nullable=True)
        avatar = Column(String, nullable=True)
        platform = Column(String)
        twitch_access_token = Column(String, nullable=True)
        twitch_refresh_token = Column(String, nullable=True)
        created_at = Column(DateTime, default=datetime.utcnow)
        is_admin = Column(Boolean, default=False)
        settings = Column(JSON, default={}) # Хранение настроек (голос, громкость и т.д.)

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
        voice_type = Column(String, default='global') # 'global' or 'user'
        owner_id = Column(String, nullable=True) # User ID from Twitch/etc.
        is_public = Column(Boolean, default=True)
        is_active = Column(Boolean, default=True)
        created_at = Column(DateTime, default=datetime.utcnow)
        # Voice settings
        speed = Column(Float, default=1.0)
        pitch = Column(Float, default=1.0)
        volume = Column(Float, default=1.0)


    def get_db():
        """Функция-генератор для получения сессии БД"""
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def init_db():
        """Инициализирует базу данных и создает таблицы, если их нет."""
        try:
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
                db.commit()
            finally:
                db.close()

        except Exception as e:
            logger.error(f"❌ Ошибка инициализации базы данных: {e}")
            raise

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
