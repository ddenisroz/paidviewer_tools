import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/bot_service_db").strip().strip('"').strip("'")

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
# РћРїСЂРµРґРµР»СЏРµРј РјРѕРґРµР»Рё, РєРѕС‚РѕСЂС‹Рµ РЅСѓР¶РЅС‹ СЌС‚РѕРјСѓ СЃРµСЂРІРёСЃСѓ
# (РѕРЅРё РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ РёРґРµРЅС‚РёС‡РЅС‹ РјРѕРґРµР»СЏРј РІ bot_service.database)
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
    
    # TTS РЅР°СЃС‚СЂРѕР№РєРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
    tts_max_text_length = Column(Integer, default=200)  # РњР°РєСЃРёРјР°Р»СЊРЅР°СЏ РґР»РёРЅР° С‚РµРєСЃС‚Р°
    tts_daily_limit = Column(Integer, default=100)  # Р”РЅРµРІРЅРѕР№ Р»РёРјРёС‚ Р·Р°РїСЂРѕСЃРѕРІ
    tts_gpu_time_limit = Column(Float, default=300.0)  # Р›РёРјРёС‚ GPU РІСЂРµРјРµРЅРё РІ СЃРµРєСѓРЅРґР°С… РІ РґРµРЅСЊ
    tts_priority_level = Column(Integer, default=2)  # РЈСЂРѕРІРµРЅСЊ РїСЂРёРѕСЂРёС‚РµС‚Р° (1-4)
    tts_enabled = Column(Boolean, default=True)  # Р’РєР»СЋС‡РµРЅ Р»Рё TTS РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ

class Voice(Base):
    __tablename__ = 'voices'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    voice_type = Column(String, default='global') # 'global' or 'user'
    file_path = Column(String, nullable=False)
    reference_text = Column(String, nullable=True)  # РСЃРїСЂР°РІР»РµРЅРѕ: Р±С‹Р»Рѕ ref_text_path
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    is_public = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_global = Column(Boolean, default=False)  # True for admin-uploaded global voices, False for user voices
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # РќР°СЃС‚СЂРѕР№РєРё РіРµРЅРµСЂР°С†РёРё TTS (РЅР°СЃС‚СЂР°РёРІР°РµРјС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј)
    cfg_strength = Column(Float, default=2.5)  # CFG strength (2.0-5.0 СЂРµРєРѕРјРµРЅРґСѓРµС‚СЃСЏ)
    speed_preset = Column(String, default='normal')  # 'very_slow', 'slow', 'normal'
    
    # РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё РѕРїСЂРµРґРµР»СЏРµРјС‹Рµ СЃРёСЃС‚РµРјРѕР№ РїР°СЂР°РјРµС‚СЂС‹ (РќР• С…СЂР°РЅСЏС‚СЃСЏ РІ Р‘Р”)
    # target_rms, speed, nfe_step - РѕРїСЂРµРґРµР»СЏСЋС‚СЃСЏ РґРёРЅР°РјРёС‡РµСЃРєРё РІ РєРѕРґРµ
    
    # Р¤РёРєСЃРёСЂРѕРІР°РЅРЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹ (РЅРµ РЅР°СЃС‚СЂР°РёРІР°РµРјС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј)
    cross_fade_duration = Column(Float, default=0.15)
    silence_duration_ms = Column(Integer, default=100)
    sway_sampling_coef = Column(Float, default=-1.0)

class UserVoiceEnabled(Base):
    """РўР°Р±Р»РёС†Р° РґР»СЏ С…СЂР°РЅРµРЅРёСЏ РёРЅС„РѕСЂРјР°С†РёРё Рѕ С‚РѕРј, РєР°РєРёРµ РіРѕР»РѕСЃР° РІРєР»СЋС‡РµРЅС‹ РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"""
    __tablename__ = 'user_voice_enabled'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    voice_id = Column(Integer, ForeignKey('voices.id'), nullable=False, index=True)
    is_enabled = Column(Boolean, default=True)  # Р’РєР»СЋС‡РµРЅ Р»Рё РіРѕР»РѕСЃ РґР»СЏ СЌС‚РѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    # РЈРЅРёРєР°Р»СЊРЅС‹Р№ РёРЅРґРµРєСЃ: РѕРґРёРЅ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ - РѕРґРёРЅ РіРѕР»РѕСЃ
    __table_args__ = (
        UniqueConstraint('user_id', 'voice_id', name='uq_user_voice'),
    )

class UserTTSUsage(Base):
    """Р›РѕРіРёСЂРѕРІР°РЅРёРµ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ TTS РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРјРё РґР»СЏ Р±РёР»Р»РёРЅРіР° Рё throttle"""
    __tablename__ = 'user_tts_usage'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    date = Column(DateTime(timezone=True), default=func.now(), index=True)
    
    # РЎС‚Р°С‚РёСЃС‚РёРєР° РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ
    requests_count = Column(Integer, default=0)  # РљРѕР»РёС‡РµСЃС‚РІРѕ Р·Р°РїСЂРѕСЃРѕРІ
    gpu_time_seconds = Column(Float, default=0.0)  # Р’СЂРµРјСЏ GPU РІ СЃРµРєСѓРЅРґР°С…
    cpu_time_seconds = Column(Float, default=0.0)  # Р’СЂРµРјСЏ CPU РІ СЃРµРєСѓРЅРґР°С…
    total_characters = Column(Integer, default=0)  # РћР±С‰РµРµ РєРѕР»РёС‡РµСЃС‚РІРѕ СЃРёРјРІРѕР»РѕРІ
    successful_requests = Column(Integer, default=0)  # РЈСЃРїРµС€РЅС‹Рµ Р·Р°РїСЂРѕСЃС‹
    failed_requests = Column(Integer, default=0)  # РќРµСѓРґР°С‡РЅС‹Рµ Р·Р°РїСЂРѕСЃС‹
    
    # Р”РµС‚Р°Р»Рё РїРѕ С‚РёРїР°Рј РѕР±СЂР°Р±РѕС‚РєРё
    gpu_requests = Column(Integer, default=0)  # Р—Р°РїСЂРѕСЃС‹ РЅР° GPU
    cpu_requests = Column(Integer, default=0)  # Р—Р°РїСЂРѕСЃС‹ РЅР° CPU
    
    # РџСЂРёРѕСЂРёС‚РµС‚С‹
    critical_requests = Column(Integer, default=0)  # РљСЂРёС‚РёС‡РµСЃРєРёРµ Р·Р°РїСЂРѕСЃС‹
    high_requests = Column(Integer, default=0)  # Р’С‹СЃРѕРєРёР№ РїСЂРёРѕСЂРёС‚РµС‚
    normal_requests = Column(Integer, default=0)  # РћР±С‹С‡РЅС‹Рµ Р·Р°РїСЂРѕСЃС‹
    low_requests = Column(Integer, default=0)  # РќРёР·РєРёР№ РїСЂРёРѕСЂРёС‚РµС‚
    
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
            pass  # РРіРЅРѕСЂРёСЂСѓРµРј РѕС€РёР±РєРё РїСЂРё Р·Р°РєСЂС‹С‚РёРё

def close_all_connections():
    """Р—Р°РєСЂС‹РІР°РµС‚ РІСЃРµ СЃРѕРµРґРёРЅРµРЅРёСЏ СЃ Р±Р°Р·РѕР№ РґР°РЅРЅС‹С…"""
    try:
        engine.dispose()
    except Exception:
        pass

def init_db():
    """РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ Р±Р°Р·С‹ РґР°РЅРЅС‹С…"""
    # РЎРѕР·РґР°РµРј РІСЃРµ С‚Р°Р±Р»РёС†С‹
    Base.metadata.create_all(bind=engine)

