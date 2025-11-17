import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.ext.declarative import declarative_base

# Определяем путь к базе данных в bot_service
# BASE_DIR -> tts_service -> parent -> bot_service -> data -> app_data.db
DATABASE_DIR = Path(__file__).resolve().parent.parent / "bot_service" / "data"

# Создаем папку если её нет
DATABASE_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DATABASE_DIR / 'app_data.db'}"

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False},
    pool_size=20,  # Увеличиваем размер пула
    max_overflow=30,  # Увеличиваем максимальное количество соединений
    pool_timeout=60,  # Увеличиваем таймаут
    pool_recycle=3600,  # Переиспользуем соединения каждый час
    pool_pre_ping=True  # Проверяем соединения перед использованием
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Определяем модели, которые нужны этому сервису
# (они должны быть идентичны моделям в bot_service.database)
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, ForeignKey, Float, UniqueConstraint
from sqlalchemy.sql import func

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    avatar = Column(String, nullable=True)
    platform = Column(String, default='twitch')
    twitch_access_token = Column(String, nullable=True)
    twitch_refresh_token = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False)
    settings = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # TTS настройки пользователя
    tts_max_text_length = Column(Integer, default=200)  # Максимальная длина текста
    tts_daily_limit = Column(Integer, default=100)  # Дневной лимит запросов
    tts_gpu_time_limit = Column(Float, default=300.0)  # Лимит GPU времени в секундах в день
    tts_priority_level = Column(Integer, default=2)  # Уровень приоритета (1-4)
    tts_enabled = Column(Boolean, default=True)  # Включен ли TTS для пользователя

class Voice(Base):
    __tablename__ = 'voices'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    voice_type = Column(String, default='global') # 'global' or 'user'
    file_path = Column(String, nullable=False)
    reference_text = Column(String, nullable=True)  # Исправлено: было ref_text_path
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    is_public = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_global = Column(Boolean, default=False)  # True for admin-uploaded global voices, False for user voices
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Настройки генерации TTS (настраиваемые пользователем)
    cfg_strength = Column(Float, default=2.5)  # CFG strength (2.0-5.0 рекомендуется)
    speed_preset = Column(String, default='normal')  # 'very_slow', 'slow', 'normal'
    
    # Автоматически определяемые системой параметры (НЕ хранятся в БД)
    # target_rms, speed, nfe_step - определяются динамически в коде
    
    # Фиксированные параметры (не настраиваемые пользователем)
    cross_fade_duration = Column(Float, default=0.15)
    silence_duration_ms = Column(Integer, default=100)
    sway_sampling_coef = Column(Float, default=-1.0)

class UserVoiceEnabled(Base):
    """Таблица для хранения информации о том, какие голоса включены для пользователя"""
    __tablename__ = 'user_voice_enabled'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    voice_id = Column(Integer, ForeignKey('voices.id'), nullable=False, index=True)
    is_enabled = Column(Boolean, default=True)  # Включен ли голос для этого пользователя
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    # Уникальный индекс: один пользователь - один голос
    __table_args__ = (
        UniqueConstraint('user_id', 'voice_id', name='uq_user_voice'),
    )

class UserTTSUsage(Base):
    """Логирование использования TTS пользователями для биллинга и throttle"""
    __tablename__ = 'user_tts_usage'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    date = Column(DateTime(timezone=True), default=func.now(), index=True)
    
    # Статистика использования
    requests_count = Column(Integer, default=0)  # Количество запросов
    gpu_time_seconds = Column(Float, default=0.0)  # Время GPU в секундах
    cpu_time_seconds = Column(Float, default=0.0)  # Время CPU в секундах
    total_characters = Column(Integer, default=0)  # Общее количество символов
    successful_requests = Column(Integer, default=0)  # Успешные запросы
    failed_requests = Column(Integer, default=0)  # Неудачные запросы
    
    # Детали по типам обработки
    gpu_requests = Column(Integer, default=0)  # Запросы на GPU
    cpu_requests = Column(Integer, default=0)  # Запросы на CPU
    
    # Приоритеты
    critical_requests = Column(Integer, default=0)  # Критические запросы
    high_requests = Column(Integer, default=0)  # Высокий приоритет
    normal_requests = Column(Integer, default=0)  # Обычные запросы
    low_requests = Column(Integer, default=0)  # Низкий приоритет
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        db.rollback()
        raise e
    finally:
        try:
            db.close()
        except Exception:
            pass  # Игнорируем ошибки при закрытии

def close_all_connections():
    """Закрывает все соединения с базой данных"""
    try:
        engine.dispose()
    except Exception:
        pass

def init_db():
    """Инициализация базы данных"""
    # Создаем все таблицы
    Base.metadata.create_all(bind=engine)
