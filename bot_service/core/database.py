# core/database.py
import os
import logging
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Float, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
from typing import Optional

# Настройка логирования
logger = logging.getLogger(__name__)

# Определяем директорию для данных
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")

# Создаем директорию если её нет
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
        __tablename__ = 'users'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        display_name = Column(String, nullable=False)
        is_admin = Column(Boolean, default=False)
        obs_token = Column(String, nullable=True)  # OBS токен для постоянной ссылки
        created_at = Column(DateTime, default=datetime.utcnow)
        
    class WhitelistedChannel(Base):
        """Модель для белого списка каналов"""
        __tablename__ = "whitelisted_channels"
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, unique=True, index=True, nullable=False)
        created_at = Column(DateTime, default=datetime.utcnow)

    class MutedUser(Base):
        """Модель заглушенных пользователей в чате"""
        __tablename__ = "muted_users"
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, index=True, nullable=False)
        username = Column(String, index=True, nullable=False)


    class StreamData(Base):
        """Модель данных о потоке"""
        __tablename__ = "stream_data"
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(String, ForeignKey('users.id'), nullable=False)
        platform = Column(String, nullable=False)
        stream_id = Column(String, nullable=True)
        viewer_count = Column(Integer)
        category_name = Column(String, nullable=True)
        title = Column(String, nullable=True)  # Добавляем title
        is_live = Column(Boolean, default=True)  # Статус стрима
        timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    class StreamPeak(Base):
        """Модель пиков онлайна"""
        __tablename__ = "stream_peaks"
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
        platform = Column(String, nullable=False)  # twitch или vk
        channel_name = Column(String, nullable=False, index=True)
        peak_viewers = Column(Integer, nullable=False)  # Пиковое количество зрителей
        peak_time = Column(DateTime, nullable=False)  # Время пика
        stream_session_id = Column(String, nullable=True, index=True)  # ID сессии стрима
        category_name = Column(String, nullable=True)  # Категория во время пика
        title = Column(String, nullable=True)  # Название стрима во время пика
        peak_type = Column(String, nullable=False, default='stream')  # stream, daily, weekly, monthly, all_time
        created_at = Column(DateTime, default=datetime.utcnow, index=True)
        
        # Для быстрого поиска пиков
        date_key = Column(String, nullable=False, index=True)  # Для группировки по дням/неделям/месяцам

    class BlockedBot(Base):
        __tablename__ = 'blocked_bots'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        bot_name = Column(String, unique=True, index=True, nullable=False)
        added_at = Column(DateTime, default=datetime.utcnow)

    class Voice(Base):
        __tablename__ = 'voices'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        name = Column(String, unique=True, index=True, nullable=False)
        file_path = Column(String, nullable=False)
        reference_text = Column(String, nullable=True)

    class GuestVerification(Base):
        """
        Модель для гостевой верификации каналов.
        При входе в гостевой режим для канала создается запись с кодом.
        """
        __tablename__ = 'guest_verifications'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, unique=True, index=True, nullable=False)
        verification_code = Column(String, nullable=False)
        is_verified = Column(Boolean, default=False)
        created_at = Column(DateTime, default=datetime.utcnow)
        verified_at = Column(DateTime, nullable=True)

    class BlockedChannel(Base):
        """Модель для заблокированных каналов"""
        __tablename__ = 'blocked_channels'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, unique=True, index=True, nullable=False)
        reason = Column(String, nullable=True)
        blocked_by = Column(String, nullable=True)  # Кто заблокировал
        is_active = Column(Boolean, default=True)
        created_at = Column(DateTime, default=datetime.utcnow)

    class UserToken(Base):
        """Модель для токенов пользователей разных платформ"""
        __tablename__ = 'user_tokens'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
        platform = Column(String, nullable=False)  # 'twitch', 'vk', etc.
        platform_user_id = Column(String, nullable=False)  # ID пользователя на платформе
        platform_display_name = Column(String, nullable=False)  # Отображаемое имя на платформе
        avatar_url = Column(String, nullable=True)  # URL аватарки
        access_token = Column(String, nullable=False)
        refresh_token = Column(String, nullable=True)
        expires_at = Column(DateTime, nullable=True)
        scopes = Column(JSON, nullable=True) # Права доступа (scopes)
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    class UserSession(Base):
        """Модель активных сессий, привязанная к единому user_id."""
        __tablename__ = 'user_sessions'
        __table_args__ = {'extend_existing': True}
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
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, unique=True, index=True, nullable=False)
        verification_code = Column(String, nullable=False)
        is_verified = Column(Boolean, default=False)
        created_at = Column(DateTime, default=datetime.utcnow)
        verified_at = Column(DateTime, nullable=True)

    class YouTubeQueue(Base):
        """Модель очереди YouTube видео"""
        __tablename__ = 'youtube_queue'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
        video_url = Column(String, nullable=False)
        video_id = Column(String, nullable=False, index=True)  # YouTube video ID
        title = Column(String, nullable=False)
        duration = Column(String, nullable=True)  # Длительность видео
        thumbnail_url = Column(String, nullable=True)
        channel_name = Column(String, nullable=False)  # Канал, где заказали
        platform = Column(String, nullable=False, default='twitch')  # twitch или vk
        requester_name = Column(String, nullable=False)  # Ник заказчика
        requester_id = Column(String, nullable=False)  # ID заказчика на платформе
        position = Column(Integer, nullable=False, default=0)  # Позиция в очереди
        status = Column(String, nullable=False, default='pending')  # pending, playing, completed, skipped
        is_paid = Column(Boolean, default=False)  # Заказано за баллы или нет
        points_cost = Column(Integer, nullable=True)  # Стоимость в баллах
        added_at = Column(DateTime, default=datetime.utcnow, index=True)
        played_at = Column(DateTime, nullable=True)

    class ChannelPoints(Base):
        """Модель баллов канала для пользователей"""
        __tablename__ = 'channel_points'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # Владелец канала
        viewer_id = Column(String, nullable=False, index=True)  # ID зрителя на платформе
        viewer_name = Column(String, nullable=False)  # Ник зрителя
        platform = Column(String, nullable=False)  # twitch или vk
        channel_name = Column(String, nullable=False, index=True)  # Название канала
        points = Column(Integer, nullable=False, default=0)  # Количество баллов
        total_earned = Column(Integer, nullable=False, default=0)  # Всего заработано
        total_spent = Column(Integer, nullable=False, default=0)  # Всего потрачено
        last_activity = Column(DateTime, default=datetime.utcnow)
        created_at = Column(DateTime, default=datetime.utcnow)

    class ChannelReward(Base):
        """Модель наград канала за баллы"""
        __tablename__ = 'channel_rewards'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # Владелец канала
        platform = Column(String, nullable=False)  # twitch или vk
        channel_name = Column(String, nullable=False, index=True)
        title = Column(String, nullable=False)  # Название награды
        description = Column(String, nullable=True)  # Описание
        cost = Column(Integer, nullable=False)  # Стоимость в баллах
        icon_url = Column(String, nullable=True)  # URL иконки
        background_color = Column(String, nullable=True)  # Цвет фона
        is_enabled = Column(Boolean, default=True)
        is_user_input_required = Column(Boolean, default=False)  # Требует ли ввода от пользователя
        max_per_stream = Column(Integer, nullable=True)  # Макс. использований за стрим
        max_per_user_per_stream = Column(Integer, nullable=True)  # Макс. для одного пользователя за стрим
        cooldown_expires_at = Column(DateTime, nullable=True)  # Кулдаун
        prompt = Column(String, nullable=True)  # Подсказка для пользовательского ввода
        reward_type = Column(String, nullable=False, default='custom')  # custom, song_request, etc.
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    class PointsTransaction(Base):
        """Модель транзакций баллов"""
        __tablename__ = 'points_transactions'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # Владелец канала
        viewer_id = Column(String, nullable=False, index=True)
        viewer_name = Column(String, nullable=False)
        platform = Column(String, nullable=False)
        channel_name = Column(String, nullable=False, index=True)
        transaction_type = Column(String, nullable=False)  # earn, spend, admin_add, admin_remove, refund
        amount = Column(Integer, nullable=False)  # Может быть отрицательным для трат
        reason = Column(String, nullable=True)  # Причина транзакции
        reward_id = Column(Integer, ForeignKey('channel_rewards.id'), nullable=True)  # Связанная награда
        created_at = Column(DateTime, default=datetime.utcnow, index=True)

    class RewardQueue(Base):
        """Модель очереди наград (для обработки модератором)"""
        __tablename__ = 'reward_queue'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # Владелец канала
        reward_id = Column(Integer, ForeignKey('channel_rewards.id'), nullable=False)
        viewer_id = Column(String, nullable=False, index=True)
        viewer_name = Column(String, nullable=False)
        platform = Column(String, nullable=False)
        channel_name = Column(String, nullable=False, index=True)
        user_input = Column(String, nullable=True)  # Ввод пользователя (если требуется)
        status = Column(String, nullable=False, default='pending')  # pending, approved, rejected, fulfilled
        points_cost = Column(Integer, nullable=False)  # Стоимость награды
        moderator_note = Column(String, nullable=True)  # Заметка модератора
        created_at = Column(DateTime, default=datetime.utcnow, index=True)
        processed_at = Column(DateTime, nullable=True)

    class BotCommand(Base):
        """Модель команд бота"""
        __tablename__ = 'bot_commands'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # Владелец канала
        channel_name = Column(String, nullable=False, index=True)  # Название канала
        command_name = Column(String, nullable=False, index=True)  # Название команды (без !)
        command_type = Column(String, nullable=False)  # 'basic' или 'custom'
        response_text = Column(String, nullable=True)  # Ответ команды (для кастомных)
        is_enabled = Column(Boolean, default=True)  # Включена ли команда
        platforms = Column(String, nullable=False, default='twitch,vk')  # Платформы через запятую
        allowed_roles = Column(String, nullable=False, default='all')  # all, broadcaster, moderator, subscriber, vip, founder (twitch) | all, owner, moderator (vk)
        cooldown_seconds = Column(Integer, default=0)  # Кулдаун в секундах
        last_used = Column(DateTime, nullable=True)  # Последнее использование
        usage_count = Column(Integer, default=0)  # Количество использований
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    class TTSSettings(Base):
        """Модель настроек TTS для каналов"""
        __tablename__ = 'tts_settings'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
        channel_name = Column(String, nullable=False, index=True)
        enabled_platforms = Column(JSON, nullable=False, default=lambda: ['twitch', 'vk'])  # Список платформ
        voice_settings = Column(JSON, nullable=True)  # Настройки голоса
        filters = Column(JSON, nullable=True)  # Фильтры сообщений
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    class Auction(Base):
        """Модель аукциона за баллы канала"""
        __tablename__ = 'auctions'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # Владелец канала
        channel_name = Column(String, nullable=False, index=True)
        title = Column(String, nullable=False)  # Название лота
        description = Column(String, nullable=True)  # Описание лота
        image_url = Column(String, nullable=True)  # Изображение лота
        starting_bid = Column(Integer, nullable=False, default=10)  # Стартовая ставка
        current_bid = Column(Integer, nullable=False, default=0)  # Текущая ставка
        bid_increment = Column(Integer, nullable=False, default=10)  # Шаг ставки
        duration_minutes = Column(Integer, nullable=False, default=5)  # Длительность в минутах
        status = Column(String, nullable=False, default='pending')  # pending, active, completed, cancelled
        winner_id = Column(String, nullable=True, index=True)  # ID победителя
        winner_name = Column(String, nullable=True)  # Имя победителя
        winner_platform = Column(String, nullable=True)  # Платформа победителя
        platforms = Column(JSON, nullable=False, default=lambda: ['twitch', 'vk'])  # Доступные платформы
        auto_extend = Column(Boolean, default=True)  # Автопродление при ставке в последние секунды
        min_participants = Column(Integer, nullable=False, default=2)  # Минимум участников
        max_bid_limit = Column(Integer, nullable=True)  # Максимальная ставка
        created_at = Column(DateTime, default=datetime.utcnow, index=True)
        started_at = Column(DateTime, nullable=True)
        ends_at = Column(DateTime, nullable=True)
        completed_at = Column(DateTime, nullable=True)

    class AuctionBid(Base):
        """Модель ставок в аукционе"""
        __tablename__ = 'auction_bids'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        auction_id = Column(Integer, ForeignKey('auctions.id'), nullable=False, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # Владелец канала
        bidder_id = Column(String, nullable=False, index=True)  # ID участника
        bidder_name = Column(String, nullable=False)  # Имя участника
        platform = Column(String, nullable=False)  # Платформа участника
        channel_name = Column(String, nullable=False)
        bid_amount = Column(Integer, nullable=False)  # Размер ставки
        is_valid = Column(Boolean, default=True)  # Валидна ли ставка
        created_at = Column(DateTime, default=datetime.utcnow, index=True)

    class GamblingGame(Base):
        """Модель других азартных игр"""
        __tablename__ = 'gambling_games'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
        game_type = Column(String, nullable=False)  # roulette, dice, slots, etc.
        game_name = Column(String, nullable=False)
        description = Column(String, nullable=True)
        min_bet = Column(Integer, nullable=False, default=10)
        max_bet = Column(Integer, nullable=False, default=1000)
        house_edge = Column(Float, nullable=False, default=0.05)  # Преимущество дома (5%)
        is_enabled = Column(Boolean, default=True)
        platforms = Column(JSON, nullable=False, default=lambda: ['twitch', 'vk'])
        settings = Column(JSON, nullable=True)  # Дополнительные настройки игры
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    class GamblingResult(Base):
        """Модель результатов азартных игр"""
        __tablename__ = 'gambling_results'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
        game_id = Column(Integer, ForeignKey('gambling_games.id'), nullable=True)
        participant_id = Column(String, nullable=False, index=True)
        participant_name = Column(String, nullable=False)
        platform = Column(String, nullable=False)
        channel_name = Column(String, nullable=False)
        game_type = Column(String, nullable=False)
        bet_amount = Column(Integer, nullable=False)
        win_amount = Column(Integer, nullable=False, default=0)  # Может быть 0 при проигрыше
        is_win = Column(Boolean, default=False)
        game_data = Column(JSON, nullable=True)  # Данные игры (числа, карты, etc.)
        created_at = Column(DateTime, default=datetime.utcnow, index=True)

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

# Функция для получения сессии БД
def get_db():
    """Функция-генератор для получения сессии БД"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Инициализирует базу данных и создает таблицы, если их нет."""
    if engine is None:
        logger.error("❌ База данных не сконфигурирована")
        return
        
    # Создаем все таблицы
    Base.metadata.create_all(bind=engine)
    
    # Список ботов для блокировки по умолчанию
    DEFAULT_BLOCKED_BOTS = [
        'nightbot', 'streamlabs', 'fossabot', 'moobot', 'streamelements', 'wizebot', 'ankhbot', 'deepbot', 'phantombot', 'coebot'
    ]

    # Добавление ботов по умолчанию, если их нет
    db = SessionLocal()
    try:
        existing_bots = {bot.bot_name for bot in db.query(BlockedBot).all()}
        for bot_name in DEFAULT_BLOCKED_BOTS:
            if bot_name not in existing_bots:
                db_bot = BlockedBot(bot_name=bot_name)
                db.add(db_bot)
        db.commit()
        logger.info("🤖 Initialized default blocked bots in database")
    except Exception as e:
        logger.error(f"Error initializing blocked bots: {e}")
        db.rollback()
    finally:
        db.close()
    
    logger.info("✅ База данных инициализирована")
