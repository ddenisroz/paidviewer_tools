# models/base.py
"""
Базовая конфигурация SQLAlchemy: engine, SessionLocal, Base.
"""
import logging
import os
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from core.config import settings

logger = logging.getLogger(__name__)

# Определяем URL базы данных из настроек
DATABASE_URL = settings.database_url
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required. Please set it in .env file.")

# Определяем, используется ли PostgreSQL
IS_POSTGRESQL = DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgresql+psycopg2://")

# Allow SQLite for testing
IS_TESTING = os.getenv("TESTING", "false").lower() == "true" or getattr(settings, 'testing', False)

if not IS_POSTGRESQL and not IS_TESTING:
     # Relaxed check: Allow SQLite in development if explicitly not strictly enforcing
     if settings.is_development:
         logger.warning("[WARN] Using SQLite in Development. Some PostgreSQL-specific features (JSONB) may fail.")
     else:
        raise ValueError(f"Only PostgreSQL is supported. Current DATABASE_URL: {DATABASE_URL[:50]}...")

# Создаем движок SQLAlchemy
# Оптимизированный connection pooling для PostgreSQL
if IS_TESTING:
    # SQLite для тестов (in-memory)
    from sqlalchemy.pool import StaticPool
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
else:
    # PostgreSQL для production
    engine = create_engine(
        DATABASE_URL,
        pool_size=20,
        max_overflow=40,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_reset_on_return='commit',
        echo=False,
        connect_args={
            "connect_timeout": 10,
            "application_name": "bot_service",
            "options": "-c statement_timeout=30000"
        }
    )

# Создаем сессию для взаимодействия с БД
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для моделей
Base = declarative_base()


@contextmanager
def db_session():
    """
    Контекстный менеджер для работы с БД.
    Автоматически управляет commit/rollback/close.
    
    Использование:
        with db_session() as db:
            user = db.query(User).filter_by(id=1).first()
            user.name = "New Name"
        # commit происходит автоматически при выходе из блока
        # rollback происходит автоматически при исключении
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """Инициализирует базу данных и создает таблицы, если их нет."""
    from models.moderation import BlockedBot
    from models.drops import DropsQuality
    from constants import DEFAULT_BLOCKED_BOTS
    
    if engine is None:
        logger.error("[ERROR] База данных не сконфигурирована")
        return

    # Создаем все таблицы
    Base.metadata.create_all(bind=engine)

    # Seeding: blocked bots + lootbox qualities in one session
    DEFAULT_QUALITIES = [
        {"name": "Common", "color": "#9ca3af", "weight": 100},
        {"name": "Rare", "color": "#3b82f6", "weight": 50},
        {"name": "Epic", "color": "#a855f7", "weight": 20},
        {"name": "Legendary", "color": "#eab308", "weight": 5},
        {"name": "Mythical", "color": "#ef4444", "weight": 1}
    ]

    db = SessionLocal()
    try:
        # Blocked bots (normalize to lowercase for consistent matching)
        existing_bots = {bot.bot_name.lower() for bot in db.query(BlockedBot).all()}
        for bot_name in DEFAULT_BLOCKED_BOTS:
            if bot_name.lower() not in existing_bots:
                db.add(BlockedBot(bot_name=bot_name.lower()))
        
        # Lootbox qualities
        existing_qualities = {q.name for q in db.query(DropsQuality).all()}
        for quality_data in DEFAULT_QUALITIES:
            if quality_data["name"] not in existing_qualities:
                db.add(DropsQuality(**quality_data))
        
        db.commit()
        logger.info("[DB] Database seeding complete (blocked bots + lootbox qualities)")
    except Exception as e:
        logger.error(f"Error during database seeding: {e}")
        db.rollback()
    finally:
        db.close()

    logger.info("База данных инициализирована")
