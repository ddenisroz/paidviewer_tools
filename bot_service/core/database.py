# core/database.py
import os
import logging
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Text, Float, text, Index, UniqueConstraint, CheckConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime
from typing import Optional

# Импортируем утилиту для работы с датой/временем
from core.datetime_utils import utcnow_naive

# Настройка логирования
logger = logging.getLogger(__name__)

# Импортируем централизованные пути
from .project_paths import DATA_DIR

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
        __table_args__ = (
            UniqueConstraint('twitch_username', name='uq_user_twitch_username'),
            UniqueConstraint('vk_username', name='uq_user_vk_username'),
            {'extend_existing': True}
        )
        id = Column(Integer, primary_key=True, index=True)
        is_admin = Column(Boolean, default=False)
        is_active = Column(Boolean, default=True)
        obs_token = Column(String, nullable=True)  # OBS токен для постоянной ссылки
        is_blocked = Column(Boolean, default=False)  # Заблокирован ли пользователь
        blocked_reason = Column(String, nullable=True)  # Причина блокировки
        blocked_at = Column(DateTime, nullable=True)  # Дата блокировки
        created_at = Column(DateTime, default=utcnow_naive)
        
        # Username'ы платформ
        twitch_username = Column(String, nullable=True, unique=True)
        vk_username = Column(String, nullable=True, unique=True)  # Ник пользователя VK (для отображения)
        vk_channel_name = Column(String, nullable=True, unique=True)  # Ник канала VK Live (для подключения бота)
        
        # DonationAlerts интеграция
        donationalerts_user_id = Column(String, nullable=True)
        donationalerts_access_token = Column(String, nullable=True)
        donationalerts_refresh_token = Column(String, nullable=True)
        
        # Настройки TTS
        tts_listening_mode = Column(String, default='website')  # 'website' или 'obs'
        tts_enabled = Column(Boolean, default=False)  # Включен ли TTS - выключен по умолчанию для новых пользователей
        donationalerts_token_expires = Column(DateTime, nullable=True)
        temp_oauth_state = Column(String, nullable=True)
        
        # Настройки объединения полей
        combine_titles = Column(Boolean, default=False)  # Объединять поля названий
        combine_categories = Column(Boolean, default=False)  # Объединять поля категорий
        
    class UserSettings(Base):
        """Модель для пользовательских настроек интерфейса"""
        __tablename__ = "user_settings"
        __table_args__ = {'extend_existing': True}
        
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, nullable=True, unique=True)  # Для обычных пользователей
        session_id = Column(String, nullable=True, unique=True)  # Для гостей
        
        # Настройки чата
        chat_enabled = Column(Boolean, default=True)
        chat_max_messages = Column(Integer, default=50)
        chat_show_timestamps = Column(Boolean, default=True)
        chat_show_platform = Column(Boolean, default=True)
        chat_show_user_roles = Column(Boolean, default=True)
        chat_animation_duration = Column(Integer, default=500)
        chat_animation_type = Column(String, default="slide")
        chat_message_fade_seconds = Column(Integer, default=60)  # Время до исчезания сообщения (10-60 сек, 60 = не исчезают)
        
        # Каналы платформ для бота
        channel_name = Column(String, nullable=True)  # Twitch канал
        vk_channel_name = Column(String, nullable=True)  # VK Live канал
        
        # Настройки OBS чата
        obs_width = Column(Integer, default=400)
        obs_height = Column(Integer, default=300)
        obs_font_size = Column(Integer, default=14)
        obs_font_family = Column(String, default="Arial")
        obs_font_weight = Column(String, default="normal")
        obs_background_color = Column(String, default="#000000")
        obs_background_image = Column(String, nullable=True)
        obs_text_color = Column(String, default="#ffffff")
        obs_border_radius = Column(Integer, default=8)
        obs_border_color = Column(String, default="#333333")
        obs_border_width = Column(Integer, default=1)
        obs_message_bg = Column(String, default="#1a1a1a")
        obs_message_border_radius = Column(Integer, default=4)
        obs_message_margin = Column(Integer, default=2)
        obs_message_padding = Column(Integer, default=8)
        
        # Цвета ролей для OBS
        obs_moderator_color = Column(String, default="#00ff00")
        obs_vip_color = Column(String, default="#ffd700")
        obs_subscriber_color = Column(String, default="#ff6b6b")
        obs_normal_color = Column(String, default="#ffffff")
        
        # Настройки объединения полей (только UI настройки)
        combine_titles = Column(Boolean, default=False)
        combine_categories = Column(Boolean, default=False)
        
        # Метаданные
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
        
        # Ограничение: должен быть заполнен либо user_id, либо session_id
        __table_args__ = (
            CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session_settings'),
            {'extend_existing': True}
        )

    class WhitelistedChannel(Base):
        """Модель для белого списка каналов"""
        __tablename__ = "whitelisted_channels"
        __table_args__ = (
            UniqueConstraint('channel_name', 'platform', name='uix_channel_platform'),
            {'extend_existing': True}
        )
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, index=True, nullable=False)
        platform = Column(String, index=True, nullable=False)  # 'twitch' или 'vk'
        created_at = Column(DateTime, default=utcnow_naive)

    class MutedUser(Base):
        """Модель заглушенных пользователей в чате"""
        __tablename__ = "muted_users"
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        channel_name = Column(String, index=True, nullable=False)
        username = Column(String, index=True, nullable=False)

    class TTSBlockedUser(Base):
        """Модель пользователей, заблокированных от TTS"""
        __tablename__ = "tts_blocked_users"
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
        channel_name = Column(String, nullable=False, index=True)
        platform = Column(String, nullable=False)  # 'twitch' or 'vk'
        username = Column(String, nullable=False)
        blocked_at = Column(DateTime, default=utcnow_naive)
        blocked_by = Column(Integer, nullable=True)  # ID пользователя, который заблокировал
        reason = Column(String, nullable=True)



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
        is_active = Column(Boolean, default=True)  # Активен ли токен (для логаута без удаления)
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
        """Модель команд бота
        
        Типы команд:
        - 'global': глобальные базовые команды (user_id=NULL), доступны всем
        - 'override': пользовательские настройки базовой команды (переопределяют global)
        - 'custom': кастомные команды пользователя (макс 5 на пользователя)
        """
        __tablename__ = 'bot_commands'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # NULL для global, user_id для override/custom
        channel_name = Column(String, nullable=True, index=True)  # Название канала (NULL для global)
        command_name = Column(String, nullable=False, index=True)  # Название команды (без !)
        command_type = Column(String, nullable=False, index=True)  # 'global', 'override', 'custom'
        parent_command_id = Column(Integer, ForeignKey('bot_commands.id'), nullable=True)  # Для override - ссылка на global команду
        alias = Column(String, nullable=True, index=True)  # Пользовательский алиас (например !song вместо !sr)
        description = Column(String, nullable=True)  # Описание команды
        response_text = Column(String, nullable=True)  # Ответ команды (для кастомных)
        is_enabled = Column(Boolean, default=True)  # Включена ли команда
        platforms = Column(String, nullable=False, default='twitch,vk')  # Платформы через запятую
        allowed_roles = Column(String, nullable=False, default='all')  # all, broadcaster, moderator, subscriber, vip (twitch) | all, owner, moderator (vk)
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

    class AudioSettings(Base):
        """Модель настроек звука для пользователей"""
        __tablename__ = 'audio_settings'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)
        website_volume = Column(Integer, nullable=False, default=50)  # Громкость на сайте (0-100)
        obs_volume = Column(Integer, nullable=False, default=50)  # Громкость в OBS (0-100)
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    class TTSUserSettings(Base):
        """Модель базовых настроек TTS для пользователей"""
        __tablename__ = 'tts_user_settings'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, nullable=True, unique=True)  # Для обычных пользователей
        session_id = Column(String, nullable=True, unique=True)  # Для гостей
        
        # Основные настройки TTS
        engine = Column(String, nullable=False, default='gtts')  # 'gtts' или 'f5tts'
        voice = Column(String, nullable=False, default='female_1')  # Голос для озвучки
        listening_mode = Column(String, nullable=False, default='website')  # 'website' или 'obs'
        
        # Платформы для озвучки
        enabled_platforms = Column(JSON, nullable=False, default=lambda: ['twitch', 'vk'])  # Список активных платформ
        
        # Фильтры эмодзи и смайлов
        enable_7tv = Column(Boolean, nullable=False, default=True)  # Включить 7TV смайлы
        enable_twitch = Column(Boolean, nullable=False, default=True)  # Включить Twitch смайлы
        enable_lexicon_filter = Column(Boolean, nullable=False, default=True)  # Включить фильтр лексики
        enable_custom_lexicon = Column(Boolean, nullable=False, default=False)  # Включить пользовательский словарь
        
        # Дополнительные параметры
        max_message_length = Column(Integer, nullable=False, default=500)  # Максимальная длина сообщения
        skip_commands = Column(Boolean, nullable=False, default=True)  # Пропускать команды (начинающиеся с !)
        use_local_tts = Column(Boolean, nullable=False, default=False)  # Использовать локальный TTS F5 движок
        
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
        
        # Ограничение: должен быть заполнен либо user_id, либо session_id
        __table_args__ = (
            CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session'),
            {'extend_existing': True}
        )

    class LocalTTSEndpoint(Base):
        """Модель конфигурации локального TTS F5 движка"""
        __tablename__ = 'local_tts_endpoints'
        __table_args__ = (
            CheckConstraint('(user_id IS NOT NULL AND session_id IS NULL) OR (user_id IS NULL AND session_id IS NOT NULL)', name='check_user_or_session_local_tts'),
            {'extend_existing': True}
        )
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # Для авторизованных пользователей
        session_id = Column(String, nullable=True, index=True)  # Для гостей
        
        # Конфигурация endpoint
        endpoint_url = Column(String, nullable=False)  # URL локального TTS сервиса (например: http://localhost:8001)
        api_key = Column(String, nullable=True)  # Опциональный API ключ для безопасности
        is_active = Column(Boolean, default=True)  # Активен ли endpoint
        use_local = Column(Boolean, default=False)  # Использовать локальный вместо централизованного
        
        # Статус и мониторинг
        last_health_check = Column(DateTime, nullable=True)  # Последняя проверка здоровья
        is_healthy = Column(Boolean, default=False)  # Доступен ли сервис
        health_check_failures = Column(Integer, default=0)  # Количество неудачных проверок
        
        # Метаданные
        tts_version = Column(String, nullable=True)  # Версия TTS движка
        gpu_info = Column(JSON, nullable=True)  # Информация о GPU
        
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    class AdminUser(Base):
        """Модель администраторов системы"""
        __tablename__ = 'admin_users'
        __table_args__ = {'extend_existing': True}
        id = Column(Integer, primary_key=True, index=True)
        platform = Column(String, nullable=False)  # 'twitch', 'vk', etc.
        platform_user_id = Column(String, nullable=False)  # ID пользователя на платформе
        username = Column(String, nullable=True)  # Имя пользователя на платформе
        is_active = Column(Boolean, default=True)  # Активен ли админ
        permissions = Column(JSON, nullable=True)  # Дополнительные права
        created_by = Column(Integer, ForeignKey('users.id'), nullable=True)  # Кто создал админа
        created_at = Column(DateTime, default=utcnow_naive)
        updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
        
        # Уникальный индекс для platform + platform_user_id
        __table_args__ = (
            UniqueConstraint('platform', 'platform_user_id', name='uq_admin_platform_user'),
            {'extend_existing': True}
        )



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
    author_username = Column(String, nullable=True, index=True)  # Имя пользователя из чата
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    is_deleted = Column(Boolean, default=False)
    
    # Роли и значки пользователя
    role = Column(String, nullable=True)  # moderator, subscriber, vip, broadcaster
    badges = Column(JSON, nullable=True)  # Массив значков: ["broadcaster/1", "subscriber/12", "premium/1"]

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

class SecurityLog(Base):
    """Логи безопасности"""
    __tablename__ = 'security_logs'
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive, index=True)


class ChatBoxSettings(Base):
    """Настройки кастомизации ChatBox для OBS виджета"""
    __tablename__ = 'chatbox_settings'
    __table_args__ = (
        UniqueConstraint('user_id', name='uq_chatbox_user'),
        UniqueConstraint('widget_token', name='uq_chatbox_token'),
        {'extend_existing': True}
    )
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    widget_token = Column(String, nullable=False, unique=True, index=True)  # Уникальный токен для OBS виджета
    
    # Настройки шрифта
    font_family = Column(String, default='Inter')  # Google Font name
    font_size = Column(Integer, default=16)  # в px
    font_weight = Column(String, default='normal')  # normal, bold, 600, etc
    text_stroke_width = Column(Integer, default=0)  # Толщина контура текста в px (0 = без контура)
    text_stroke_color = Column(String, default='#000000')  # Цвет контура текста
    
    # Настройки фона
    background_color = Column(String, default='#000000')  # Цвет фона
    background_opacity = Column(Float, default=0.5)  # Прозрачность фона (0-1)
    
    # Настройки отображения
    max_messages = Column(Integer, default=20)  # Количество отображаемых сообщений (мин: 1, макс: 50)
    chat_direction = Column(String, default='vertical')  # vertical или horizontal
    show_platform_icons = Column(Boolean, default=True)  # Показывать иконки платформ (Twitch/VK)
    show_roles = Column(Boolean, default=False)  # Показывать роли пользователей (Модератор, Подписчик и т.д.)
    show_badges = Column(Boolean, default=True)  # Показывать значки пользователей (Twitch badges через API)
    show_avatars = Column(Boolean, default=False)  # Показывать аватары пользователей
    
    # Настройки цветов текста
    text_color = Column(String, default='#FFFFFF')  # Цвет текста сообщений
    username_color = Column(String, default='#9147FF')  # Цвет имени пользователя
    
    # Дополнительные настройки
    message_spacing = Column(Integer, default=4)  # Отступ между сообщениями в px
    border_radius = Column(Integer, default=8)  # Скругление углов в px
    animation_duration = Column(Integer, default=300)  # Длительность анимации появления в ms
    animation_type = Column(String, default='fade')  # Тип анимации: fade, slide-right, slide-left, scale, bounce
    message_fade_seconds = Column(Integer, default=60)  # Время до исчезания сообщения (10-60 сек, 60 = не исчезают)
    
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
