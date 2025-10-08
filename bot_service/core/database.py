# core/database.py
import os
import logging
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Text, Float, text, Index, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime
from typing import Optional

# Импортируем утилиту для работы с датой/временем
from core.datetime_utils import utcnow_naive

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
        is_admin = Column(Boolean, default=False)
        obs_token = Column(String, nullable=True)  # OBS токен для постоянной ссылки
        is_blocked = Column(Boolean, default=False)  # Заблокирован ли пользователь
        blocked_reason = Column(String, nullable=True)  # Причина блокировки
        blocked_at = Column(DateTime, nullable=True)  # Дата блокировки
        created_at = Column(DateTime, default=utcnow_naive)
        
    class WhitelistedChannel(Base):
        """Модель для белого списка каналов"""
        __tablename__ = "whitelisted_channels"
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, unique=True, index=True, nullable=False)
        created_at = Column(DateTime, default=utcnow_naive)

    class MutedUser(Base):
        """Модель заглушенных пользователей в чате"""
        __tablename__ = "muted_users"
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, index=True, nullable=False)
        username = Column(String, index=True, nullable=False)



    class BlockedBot(Base):
        __tablename__ = 'blocked_bots'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        bot_name = Column(String, unique=True, index=True, nullable=False)
        added_at = Column(DateTime, default=utcnow_naive)

    class Voice(Base):
        __tablename__ = 'voices'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        name = Column(String, unique=True, index=True, nullable=False)
        voice_type = Column(String, default='global')  # 'global' or 'user'
        file_path = Column(String, nullable=False)
        reference_text = Column(String, nullable=True)
        owner_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # Integer, не String!
        is_public = Column(Boolean, default=False)
        is_active = Column(Boolean, default=True)
        created_at = Column(DateTime, default=utcnow_naive)
        
        # Настройки генерации TTS
        cfg_strength = Column(Float, default=2.5)
        speed_preset = Column(String, default='normal')
        cross_fade_duration = Column(Float, default=0.15)
        silence_duration = Column(Float, default=0.0)
        silence_duration_ms = Column(Integer, default=100)  # Добавляем поле из TTS сервиса
        sway_sampling_coef = Column(Float, default=-1.0)  # Добавляем поле из TTS сервиса
        temperature = Column(Float, default=1.0)
        top_p = Column(Float, default=0.9)
        top_k = Column(Integer, default=50)
        repetition_penalty = Column(Float, default=1.0)
        length_penalty = Column(Float, default=1.0)
        early_stopping = Column(Boolean, default=False)

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
        created_at = Column(DateTime, default=utcnow_naive)
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
        created_at = Column(DateTime, default=utcnow_naive)

    class UserToken(Base):
        """Модель для токенов пользователей разных платформ"""
        __tablename__ = 'user_tokens'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
        platform = Column(String, nullable=False)  # 'twitch', 'vk', etc.
        platform_user_id = Column(String, nullable=False)  # ID пользователя на платформе
        avatar_url = Column(String, nullable=True)  # URL аватарки
        access_token = Column(String, nullable=False)
        refresh_token = Column(String, nullable=True)
        expires_at = Column(DateTime, nullable=True)
        scopes = Column(JSON, nullable=True) # Права доступа (scopes)
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    class UserSession(Base):
        """Модель активных сессий, привязанная к единому user_id."""
        __tablename__ = 'user_sessions'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
        session_id = Column(String, unique=True, index=True, nullable=False)
        device_info = Column(JSON, nullable=True)
        created_at = Column(DateTime, default=utcnow_naive)
        last_activity = Column(DateTime, default=utcnow_naive)
        is_active = Column(Boolean, default=True)

    class VkGuestVerification(Base):
        """Модель для данных верификации VK Live гостевых подключений"""
        __tablename__ = 'vk_guest_verifications'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, unique=True, index=True, nullable=False)
        verification_code = Column(String, nullable=False)
        is_verified = Column(Boolean, default=False)
        created_at = Column(DateTime, default=utcnow_naive)
        verified_at = Column(DateTime, nullable=True)

    class PsychologyAnalysis(Base):
        """Модель результатов психологического анализа"""
        __tablename__ = 'psychology_analysis'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        target_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
        target_username = Column(String, nullable=False)
        platform = Column(String, nullable=False)
        analyzed_by_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # Кто запросил анализ
        analyzed_by_username = Column(String, nullable=False)
        analysis_text = Column(Text, nullable=False)  # Результат анализа
        messages_count = Column(Integer, nullable=False)  # Количество проанализированных сообщений
        analysis_date = Column(DateTime, default=utcnow_naive, index=True)
        ai_model_used = Column(String, nullable=True)  # Какая модель использовалась

    class FilteredWord(Base):
        """Модель заблокированных слов для TTS"""
        __tablename__ = 'filtered_words'
        __table_args__ = (
            Index('idx_user_word', 'user_id', 'word'),
            Index('idx_platform', 'platform'),
            Index('idx_active', 'is_active'),
            UniqueConstraint('user_id', 'word', 'platform', name='uq_user_word_platform'),
            {'extend_existing': True}
        )
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)  # Владелец фильтра
        word = Column(String, nullable=False, index=True)  # Заблокированное слово
        platform = Column(String, nullable=False, default='all')  # Платформа: all, twitch, vk
        created_at = Column(DateTime, default=utcnow_naive, index=True)
        is_active = Column(Boolean, default=True)  # Активен ли фильтр

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
        last_activity = Column(DateTime, default=utcnow_naive)
        created_at = Column(DateTime, default=utcnow_naive)

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
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

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
        tags = Column(String, nullable=True, default='')  # Теги команды через запятую
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

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
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

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


    class SupportTicket(Base):
        """Модель тикетов поддержки"""
        __tablename__ = "support_tickets"
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # Может быть null для анонимных тикетов
        user_name = Column(String, nullable=True)  # Имя пользователя (если не аутентифицирован)
        user_email = Column(String, nullable=True)  # Email пользователя (опционально)
        subject = Column(String, nullable=False)  # Тема тикета
        message = Column(Text, nullable=False)  # Сообщение (до 500 символов)
        status = Column(String, default="open")  # open, in_progress, closed
        priority = Column(String, default="medium")  # low, medium, high, urgent
        admin_notes = Column(Text, nullable=True)  # Заметки администратора
        is_archived = Column(Boolean, default=False)  # Флаг архивирования
        created_at = Column(DateTime, default=datetime.utcnow, index=True)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
        closed_at = Column(DateTime, nullable=True)

    class TicketResponse(Base):
        """Модель ответов на тикеты"""
        __tablename__ = "ticket_responses"
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        ticket_id = Column(Integer, ForeignKey('support_tickets.id'), nullable=False)
        author_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # ID администратора (null для системных сообщений)
        author_name = Column(String, nullable=False)  # Имя автора ответа
        message = Column(Text, nullable=False)  # Текст ответа
        is_admin_response = Column(Boolean, default=True)  # True для ответов админов, False для пользователей
        is_read = Column(Boolean, default=False)  # Прочитан ли ответ пользователем
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

# === СИСТЕМА ЛУТБОКСОВ И ГЕЙМИФИКАЦИИ ===

class ChatMessage(Base):
    """Сообщения из чата для отслеживания активности"""
    __tablename__ = "chat_messages"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)  # twitch, vk_live
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    is_deleted = Column(Boolean, default=False)

class UserProgression(Base):
    """Прогрессия пользователей в системе достижений"""
    __tablename__ = "user_progression"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)  # twitch, vk_live
    
    # Статистика активности
    total_days_active = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)  # Текущая серия дней
    longest_streak = Column(Integer, default=0)  # Самая длинная серия
    last_activity_date = Column(DateTime)
    total_messages = Column(Integer, default=0)
    
    # Донаты
    total_donated = Column(Float, default=0.0)
    total_donations_count = Column(Integer, default=0)
    
    # Лутбоксы
    free_lootboxes_opened = Column(Integer, default=0)
    paid_lootboxes_opened = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Achievement(Base):
    """Достижения, которые можно получить"""
    __tablename__ = "achievements"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    channel_name = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    type = Column(String, nullable=False)  # daily_streak, total_days, total_donated, etc.
    requirement_value = Column(Integer, nullable=False)  # Значение для получения
    reward_type = Column(String, nullable=False)  # free_lootbox, paid_lootbox, special
    reward_value = Column(Integer, default=1)  # Количество наград
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserAchievement(Base):
    """Полученные пользователями достижения"""
    __tablename__ = "user_achievements"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    achievement_id = Column(Integer, ForeignKey("achievements.id"), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    earned_at = Column(DateTime, default=datetime.utcnow)
    is_claimed = Column(Boolean, default=False)  # Забрана ли награда

class Lootbox(Base):
    """Лутбоксы"""
    __tablename__ = "lootboxes"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    channel_name = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    type = Column(String, nullable=False)  # free, paid
    price = Column(Float, default=0.0)  # Цена для paid лутбоксов
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DonationAlert(Base):
    """Донаты через DonationAlerts"""
    __tablename__ = "donation_alerts"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="RUB")
    message = Column(Text)
    alert_id = Column(String, unique=True, index=True)  # ID из DonationAlerts
    processed_at = Column(DateTime, default=datetime.utcnow)
    is_processed = Column(Boolean, default=False)

    # === СИСТЕМА DROPS ===

class DropsType(Base):
    """Типы Drops"""
    __tablename__ = 'drops_types'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # "Стрик", "Донат", "Мифический"
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow_naive)

class DropsQuality(Base):
    """Качества Drops"""
    __tablename__ = 'drops_qualities'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # "Common", "Rare", "Epic", "Legendary"
    color = Column(String, nullable=False)  # Hex цвет
    weight = Column(Integer, default=100)  # Вес для случайного выбора
    created_at = Column(DateTime, default=utcnow_naive)

class DropsConfig(Base):
    """Конфигурация Drops для канала"""
    __tablename__ = 'drops_configs'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)  # twitch, vk
    
    # Стрик настройки
    streak_enabled = Column(Boolean, default=True)
    streak_days_common = Column(Integer, default=1)
    streak_days_rare = Column(Integer, default=3)
    streak_days_epic = Column(Integer, default=7)
    streak_days_legendary = Column(Integer, default=14)
    streak_messages_required = Column(Integer, default=5)  # Сообщений в чате за стрим
    
    # Донат настройки
    donation_enabled = Column(Boolean, default=True)
    donation_amount_common = Column(Float, default=50.0)
    donation_amount_rare = Column(Float, default=100.0)
    donation_amount_epic = Column(Float, default=500.0)
    donation_amount_legendary = Column(Float, default=1000.0)
    
    # Мифический лутбокс
    mythical_enabled = Column(Boolean, default=True)
    mythical_min_interval_hours = Column(Integer, default=2)  # Минимальный интервал
    mythical_max_interval_hours = Column(Integer, default=8)  # Максимальный интервал
    mythical_window_duration_minutes = Column(Integer, default=5)  # Длительность окна
    mythical_donation_amount = Column(Float, default=2000.0)  # Сумма для получения
    mythical_last_appeared = Column(DateTime, nullable=True)  # Последнее появление
    
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

class DropsReward(Base):
    """Награды в Drops"""
    __tablename__ = 'drops_rewards'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)
    
    name = Column(String, nullable=False)
    description = Column(Text)
    quality_id = Column(Integer, ForeignKey('drops_qualities.id'), nullable=False)
    weight = Column(Integer, default=100)  # Вес для случайного выбора
    
    # Тип награды
    reward_type = Column(String, nullable=False)  # "points", "voice", "command", "custom"
    reward_value = Column(String, nullable=False)  # Значение награды (JSON)
    
    # Звук награды
    sound_file = Column(String, nullable=True)  # Путь к файлу звука
    sound_volume = Column(Float, default=1.0)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

class UserStreak(Base):
    """Стрики пользователей"""
    __tablename__ = 'user_streaks'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)
    viewer_id = Column(String, nullable=False, index=True)
    viewer_name = Column(String, nullable=False)
    
    current_streak = Column(Integer, default=0)
    max_streak = Column(Integer, default=0)
    last_activity = Column(DateTime, default=utcnow_naive)
    messages_this_stream = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
    
    # Уникальный индекс для предотвращения дублирования
    __table_args__ = (
        UniqueConstraint('user_id', 'viewer_id', 'platform', name='uq_user_streak'),
        {'extend_existing': True}
    )

class DropsHistory(Base):
    """История получения Drops"""
    __tablename__ = 'drops_history'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)
    viewer_id = Column(String, nullable=False, index=True)
    viewer_name = Column(String, nullable=False)
    
    # Тип лутбокса
    lootbox_type = Column(String, nullable=False)  # "streak", "donation", "mythical"
    quality_id = Column(Integer, ForeignKey('drops_qualities.id'), nullable=False)
    
    # Полученная награда
    reward_id = Column(Integer, ForeignKey('drops_rewards.id'), nullable=True)
    reward_name = Column(String, nullable=False)
    reward_type = Column(String, nullable=False)
    reward_value = Column(String, nullable=False)  # JSON
    
    # Дополнительная информация
    donation_amount = Column(Float, nullable=True)  # Сумма доната (если донатный)
    streak_days = Column(Integer, nullable=True)  # Дни стрика (если стрик)
    messages_count = Column(Integer, nullable=True)  # Количество сообщений
    
    # Внешние данные
    donation_alert_id = Column(String, nullable=True)  # ID из DonationAlerts
    chat_message_id = Column(Integer, nullable=True)  # ID сообщения в чате
    
    created_at = Column(DateTime, default=utcnow_naive, index=True)

class MythicalDropsSession(Base):
    """Сессии мифических Drops"""
    __tablename__ = 'mythical_drops_sessions'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    channel_name = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)
    
    # Параметры сессии
    donation_amount = Column(Float, nullable=False)
    window_duration_minutes = Column(Integer, nullable=False)
    
    # Статус
    is_active = Column(Boolean, default=True)
    started_at = Column(DateTime, default=utcnow_naive)
    expires_at = Column(DateTime, nullable=False)
    winner_viewer_id = Column(String, nullable=True)
    winner_viewer_name = Column(String, nullable=True)
    winner_donation_amount = Column(Float, nullable=True)
    
    created_at = Column(DateTime, default=utcnow_naive)

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
