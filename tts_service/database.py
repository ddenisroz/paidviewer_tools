import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.ext.declarative import declarative_base

# Определяем путь к базе данных в bot_service
# BASE_DIR -> tts_service -> parent -> bot_service -> data -> app_data.db
DATABASE_DIR = Path(__file__).resolve().parent.parent / "bot_service" / "data"
DATABASE_URL = f"sqlite:///{DATABASE_DIR / 'app_data.db'}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Определяем модели, которые нужны этому сервису
# (они должны быть идентичны моделям в bot_service.database)
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, ForeignKey, Float
from sqlalchemy.sql import func

class User(Base):
    __tablename__ = 'users'
    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    display_name = Column(String)
    avatar = Column(String, nullable=True)
    platform = Column(String, default='twitch')
    twitch_access_token = Column(String, nullable=True)
    twitch_refresh_token = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False)
    settings = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), default=func.now())

class Voice(Base):
    __tablename__ = 'voices'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    voice_type = Column(String, default='global') # 'global' or 'user'
    file_path = Column(String, nullable=False)
    reference_text = Column(String, nullable=True)  # Исправлено: было ref_text_path
    owner_id = Column(String, ForeignKey('users.id'), nullable=True)
    is_public = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Настройки генерации TTS (настраиваемые пользователем)
    cfg_strength = Column(Float, default=2.0)  # CFG strength (2.0-5.0 рекомендуется) - ЕДИНСТВЕННЫЙ настраиваемый параметр
    
    # Автоматически определяемые системой параметры (НЕ хранятся в БД)
    # target_rms, speed, nfe_step - определяются динамически в коде
    
    # Фиксированные параметры (не настраиваемые пользователем)
    cross_fade_duration = Column(Float, default=0.15)
    silence_duration_ms = Column(Integer, default=100)
    sway_sampling_coef = Column(Float, default=-1.0)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
