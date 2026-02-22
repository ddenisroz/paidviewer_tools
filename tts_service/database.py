import os
import logging
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger(__name__)

PLACEHOLDER_DATABASE_URL = "postgresql://user:password@localhost:5432/bot_service_db"


def _clean_env_value(value: str | None) -> str:
    if value is None:
        return ""
    # Drop quotes and invisible whitespace often introduced by copy/paste.
    return value.strip().strip('"').strip("'").replace("\ufeff", "").replace("\u00a0", "").strip()


def _load_fallback_database_url_from_bot_service() -> str:
    project_root = Path(__file__).resolve().parent.parent
    bot_env_path = project_root / "bot_service" / ".env"
    if not bot_env_path.exists():
        return ""
    bot_database_url = _clean_env_value(dotenv_values(bot_env_path).get("DATABASE_URL"))
    if bot_database_url and bot_database_url != PLACEHOLDER_DATABASE_URL:
        return bot_database_url
    return ""


def _resolve_database_url() -> str:
    env_database_url = _clean_env_value(os.getenv("DATABASE_URL"))
    if env_database_url and env_database_url != PLACEHOLDER_DATABASE_URL:
        return env_database_url

    fallback_database_url = _load_fallback_database_url_from_bot_service()
    if fallback_database_url:
        if not env_database_url:
            logger.info("[DB] DATABASE_URL is not set in tts_service env; using bot_service/.env DATABASE_URL")
        else:
            logger.warning(
                "[DB] DATABASE_URL in tts_service env is placeholder; using bot_service/.env DATABASE_URL"
            )
        return fallback_database_url

    # Preserve previous behavior when no fallback exists.
    return env_database_url or PLACEHOLDER_DATABASE_URL


DATABASE_URL = _resolve_database_url()

IS_TESTING = os.getenv("TESTING", "false").lower() == "true"
IS_POSTGRESQL = DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgresql+psycopg2://")
if not IS_POSTGRESQL and not IS_TESTING:
    raise ValueError(f"Only PostgreSQL is supported. Current DATABASE_URL: {DATABASE_URL[:50]}...")

if IS_TESTING:
    engine = create_engine(DATABASE_URL)
else:
    engine = create_engine(
        DATABASE_URL,
        pool_size=20,
        max_overflow=30,
        pool_timeout=60,
        pool_recycle=3600,
        pool_pre_ping=True,
        connect_args={
            "connect_timeout": 10,
            "application_name": "tts_service",
            "options": "-c statement_timeout=30000",
        },
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
# Р С›Р С—РЎР‚Р ВµР Т‘Р ВµР В»РЎРЏР ВµР С Р СР С•Р Т‘Р ВµР В»Р С‘, Р С”Р С•РЎвЂљР С•РЎР‚РЎвЂ№Р Вµ Р Р…РЎС“Р В¶Р Р…РЎвЂ№ РЎРЊРЎвЂљР С•Р СРЎС“ РЎРѓР ВµРЎР‚Р Р†Р С‘РЎРѓРЎС“
# (Р С•Р Р…Р С‘ Р Т‘Р С•Р В»Р В¶Р Р…РЎвЂ№ Р В±РЎвЂ№РЎвЂљРЎРЉ Р С‘Р Т‘Р ВµР Р…РЎвЂљР С‘РЎвЂЎР Р…РЎвЂ№ Р СР С•Р Т‘Р ВµР В»РЎРЏР С Р Р† bot_service.database)
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
    
    # TTS Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р в„–Р С”Р С‘ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ
    tts_max_text_length = Column(Integer, default=200)  # Р СљР В°Р С”РЎРѓР С‘Р СР В°Р В»РЎРЉР Р…Р В°РЎРЏ Р Т‘Р В»Р С‘Р Р…Р В° РЎвЂљР ВµР С”РЎРѓРЎвЂљР В°
    tts_daily_limit = Column(Integer, default=100)  # Р вЂќР Р…Р ВµР Р†Р Р…Р С•Р в„– Р В»Р С‘Р СР С‘РЎвЂљ Р В·Р В°Р С—РЎР‚Р С•РЎРѓР С•Р Р†
    tts_gpu_time_limit = Column(Float, default=300.0)  # Р вЂєР С‘Р СР С‘РЎвЂљ GPU Р Р†РЎР‚Р ВµР СР ВµР Р…Р С‘ Р Р† РЎРѓР ВµР С”РЎС“Р Р…Р Т‘Р В°РЎвЂ¦ Р Р† Р Т‘Р ВµР Р…РЎРЉ
    tts_priority_level = Column(Integer, default=2)  # Р Р€РЎР‚Р С•Р Р†Р ВµР Р…РЎРЉ Р С—РЎР‚Р С‘Р С•РЎР‚Р С‘РЎвЂљР ВµРЎвЂљР В° (1-4)
    tts_enabled = Column(Boolean, default=True)  # Р вЂ™Р С”Р В»РЎР‹РЎвЂЎР ВµР Р… Р В»Р С‘ TTS Р Т‘Р В»РЎРЏ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ

class Voice(Base):
    __tablename__ = 'voices'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    voice_type = Column(String, default='global') # 'global' or 'user'
    file_path = Column(String, nullable=False)
    reference_text = Column(String, nullable=True)  # Р ВРЎРѓР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С•: Р В±РЎвЂ№Р В»Р С• ref_text_path
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    is_public = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_global = Column(Boolean, default=False)  # True for admin-uploaded global voices, False for user voices
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Р СњР В°РЎРѓРЎвЂљРЎР‚Р С•Р в„–Р С”Р С‘ Р С–Р ВµР Р…Р ВµРЎР‚Р В°РЎвЂ Р С‘Р С‘ TTS (Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р В°Р С‘Р Р†Р В°Р ВµР СРЎвЂ№Р Вµ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»Р ВµР С)
    cfg_strength = Column(Float, default=2.5)  # CFG strength (2.0-5.0 РЎР‚Р ВµР С”Р С•Р СР ВµР Р…Р Т‘РЎС“Р ВµРЎвЂљРЎРѓРЎРЏ)
    speed_preset = Column(String, default='normal')  # 'very_slow', 'slow', 'normal'
    
    # Р С’Р Р†РЎвЂљР С•Р СР В°РЎвЂљР С‘РЎвЂЎР ВµРЎРѓР С”Р С‘ Р С•Р С—РЎР‚Р ВµР Т‘Р ВµР В»РЎРЏР ВµР СРЎвЂ№Р Вµ РЎРѓР С‘РЎРѓРЎвЂљР ВµР СР С•Р в„– Р С—Р В°РЎР‚Р В°Р СР ВµРЎвЂљРЎР‚РЎвЂ№ (Р СњР вЂў РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏРЎвЂљРЎРѓРЎРЏ Р Р† Р вЂР вЂќ)
    # target_rms, speed, nfe_step - Р С•Р С—РЎР‚Р ВµР Т‘Р ВµР В»РЎРЏРЎР‹РЎвЂљРЎРѓРЎРЏ Р Т‘Р С‘Р Р…Р В°Р СР С‘РЎвЂЎР ВµРЎРѓР С”Р С‘ Р Р† Р С”Р С•Р Т‘Р Вµ
    
    # Р В¤Р С‘Р С”РЎРѓР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р С—Р В°РЎР‚Р В°Р СР ВµРЎвЂљРЎР‚РЎвЂ№ (Р Р…Р Вµ Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р В°Р С‘Р Р†Р В°Р ВµР СРЎвЂ№Р Вµ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»Р ВµР С)
    cross_fade_duration = Column(Float, default=0.15)
    silence_duration_ms = Column(Integer, default=100)
    sway_sampling_coef = Column(Float, default=-1.0)

class UserVoiceEnabled(Base):
    """Р СћР В°Р В±Р В»Р С‘РЎвЂ Р В° Р Т‘Р В»РЎРЏ РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ Р С‘Р Р…РЎвЂћР С•РЎР‚Р СР В°РЎвЂ Р С‘Р С‘ Р С• РЎвЂљР С•Р С, Р С”Р В°Р С”Р С‘Р Вµ Р С–Р С•Р В»Р С•РЎРѓР В° Р Р†Р С”Р В»РЎР‹РЎвЂЎР ВµР Р…РЎвЂ№ Р Т‘Р В»РЎРЏ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ"""
    __tablename__ = 'user_voice_enabled'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    voice_id = Column(Integer, ForeignKey('voices.id'), nullable=False, index=True)
    is_enabled = Column(Boolean, default=True)  # Р вЂ™Р С”Р В»РЎР‹РЎвЂЎР ВµР Р… Р В»Р С‘ Р С–Р С•Р В»Р С•РЎРѓ Р Т‘Р В»РЎРЏ РЎРЊРЎвЂљР С•Р С–Р С• Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    # Р Р€Р Р…Р С‘Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– Р С‘Р Р…Р Т‘Р ВµР С”РЎРѓ: Р С•Р Т‘Р С‘Р Р… Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ - Р С•Р Т‘Р С‘Р Р… Р С–Р С•Р В»Р С•РЎРѓ
    __table_args__ = (
        UniqueConstraint('user_id', 'voice_id', name='uq_user_voice'),
    )

class UserTTSUsage(Base):
    """Р вЂєР С•Р С–Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ TTS Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏР СР С‘ Р Т‘Р В»РЎРЏ Р В±Р С‘Р В»Р В»Р С‘Р Р…Р С–Р В° Р С‘ throttle"""
    __tablename__ = 'user_tts_usage'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    date = Column(DateTime(timezone=True), default=func.now(), index=True)
    
    # Р РЋРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”Р В° Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ
    requests_count = Column(Integer, default=0)  # Р С™Р С•Р В»Р С‘РЎвЂЎР ВµРЎРѓРЎвЂљР Р†Р С• Р В·Р В°Р С—РЎР‚Р С•РЎРѓР С•Р Р†
    gpu_time_seconds = Column(Float, default=0.0)  # Р вЂ™РЎР‚Р ВµР СРЎРЏ GPU Р Р† РЎРѓР ВµР С”РЎС“Р Р…Р Т‘Р В°РЎвЂ¦
    cpu_time_seconds = Column(Float, default=0.0)  # Р вЂ™РЎР‚Р ВµР СРЎРЏ CPU Р Р† РЎРѓР ВµР С”РЎС“Р Р…Р Т‘Р В°РЎвЂ¦
    total_characters = Column(Integer, default=0)  # Р С›Р В±РЎвЂ°Р ВµР Вµ Р С”Р С•Р В»Р С‘РЎвЂЎР ВµРЎРѓРЎвЂљР Р†Р С• РЎРѓР С‘Р СР Р†Р С•Р В»Р С•Р Р†
    successful_requests = Column(Integer, default=0)  # Р Р€РЎРѓР С—Р ВµРЎв‚¬Р Р…РЎвЂ№Р Вµ Р В·Р В°Р С—РЎР‚Р С•РЎРѓРЎвЂ№
    failed_requests = Column(Integer, default=0)  # Р СњР ВµРЎС“Р Т‘Р В°РЎвЂЎР Р…РЎвЂ№Р Вµ Р В·Р В°Р С—РЎР‚Р С•РЎРѓРЎвЂ№
    
    # Р вЂќР ВµРЎвЂљР В°Р В»Р С‘ Р С—Р С• РЎвЂљР С‘Р С—Р В°Р С Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”Р С‘
    gpu_requests = Column(Integer, default=0)  # Р вЂ”Р В°Р С—РЎР‚Р С•РЎРѓРЎвЂ№ Р Р…Р В° GPU
    cpu_requests = Column(Integer, default=0)  # Р вЂ”Р В°Р С—РЎР‚Р С•РЎРѓРЎвЂ№ Р Р…Р В° CPU
    
    # Р СџРЎР‚Р С‘Р С•РЎР‚Р С‘РЎвЂљР ВµРЎвЂљРЎвЂ№
    critical_requests = Column(Integer, default=0)  # Р С™РЎР‚Р С‘РЎвЂљР С‘РЎвЂЎР ВµРЎРѓР С”Р С‘Р Вµ Р В·Р В°Р С—РЎР‚Р С•РЎРѓРЎвЂ№
    high_requests = Column(Integer, default=0)  # Р вЂ™РЎвЂ№РЎРѓР С•Р С”Р С‘Р в„– Р С—РЎР‚Р С‘Р С•РЎР‚Р С‘РЎвЂљР ВµРЎвЂљ
    normal_requests = Column(Integer, default=0)  # Р С›Р В±РЎвЂ№РЎвЂЎР Р…РЎвЂ№Р Вµ Р В·Р В°Р С—РЎР‚Р С•РЎРѓРЎвЂ№
    low_requests = Column(Integer, default=0)  # Р СњР С‘Р В·Р С”Р С‘Р в„– Р С—РЎР‚Р С‘Р С•РЎР‚Р С‘РЎвЂљР ВµРЎвЂљ
    
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
            pass  # Р ВР С–Р Р…Р С•РЎР‚Р С‘РЎР‚РЎС“Р ВµР С Р С•РЎв‚¬Р С‘Р В±Р С”Р С‘ Р С—РЎР‚Р С‘ Р В·Р В°Р С”РЎР‚РЎвЂ№РЎвЂљР С‘Р С‘

def close_all_connections():
    """Р вЂ”Р В°Р С”РЎР‚РЎвЂ№Р Р†Р В°Р ВµРЎвЂљ Р Р†РЎРѓР Вµ РЎРѓР С•Р ВµР Т‘Р С‘Р Р…Р ВµР Р…Р С‘РЎРЏ РЎРѓ Р В±Р В°Р В·Р С•Р в„– Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦"""
    try:
        engine.dispose()
    except Exception:
        pass

def init_db():
    """Р ВР Р…Р С‘РЎвЂ Р С‘Р В°Р В»Р С‘Р В·Р В°РЎвЂ Р С‘РЎРЏ Р В±Р В°Р В·РЎвЂ№ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦"""
    # Р РЋР С•Р В·Р Т‘Р В°Р ВµР С Р Р†РЎРѓР Вµ РЎвЂљР В°Р В±Р В»Р С‘РЎвЂ РЎвЂ№
    try:
        Base.metadata.create_all(bind=engine)
    except UnicodeDecodeError as exc:
        logger.error(
            "[DB] PostgreSQL connection failed while decoding server response. Check DATABASE_URL in tts_service/.env or bot_service/.env."
        )
        raise RuntimeError(
            "PostgreSQL connection failed due to invalid DATABASE_URL or unreachable PostgreSQL server."
        ) from exc


