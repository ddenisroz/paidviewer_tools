"""
Общий OAuth handler для унификации логики авторизации между платформами
"""
import logging
from typing import Optional, Dict
from datetime import datetime
from core.datetime_utils import utcnow_naive
from fastapi import Request, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from core.database import User, UserSession, UserToken
from core.session_manager import session_manager
from constants import (
    Platform, ErrorMessages, FRONTEND_REDIRECTS,
    HTTP_STATUS
)
from core.cookie_config import get_session_cookie_settings
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class OAuthUserData:
    """Структура данных пользователя, полученных от OAuth провайдера"""
    platform_user_id: str
    avatar_url: Optional[str]
    access_token: str
    refresh_token: Optional[str]
    expires_at: Optional[datetime]
    scopes: Optional[list]
    username: Optional[str] = None
    channel_name: Optional[str] = None  # Для VK Live - имя канала отдельно от username

@dataclass
class OAuthResult:
    """Результат OAuth авторизации"""
    user: User
    session_id: Optional[str]
    is_new_session: bool
    redirect_url: str

class OAuthHandler:
    """Универсальный обработчик OAuth для всех платформ"""

    def __init__(self):
        self.connection_manager = None
        # Импортируем connection_manager только при необходимости для избежания циклических импортов

    def _get_connection_manager(self):
        """Ленивая загрузка connection_manager"""
        if self.connection_manager is None:
            from core.connection_manager import get_connection_manager
            connection_manager = get_connection_manager()
            self.connection_manager = connection_manager
        return self.connection_manager

    def _deactivate_other_platform_tokens(self, user_id: int, current_platform: str, db: Session):
        """
        Деактивирует все токены пользователя, КРОМЕ текущей платформы.
        
        Логика безопасности: при новом логине через платформу X, 
        все остальные платформы требуют переподключения.
        
        Note: НЕ делает commit - это ответственность вызывающей функции
        для сохранения transaction boundary.
        """
        logger.info(f"[DEACTIVATE] Deactivating other tokens for user {user_id}, keeping {current_platform}")

        other_tokens = db.query(UserToken).filter(
            UserToken.user_id == user_id,
            UserToken.platform != current_platform,
            UserToken.is_active.is_(True)
        ).all()

        if not other_tokens:
            logger.info(f"[DEACTIVATE] No other active tokens found for user {user_id}")
            return

        deactivated_platforms = []
        for token in other_tokens:
            token.is_active = False
            deactivated_platforms.append(token.platform)

        logger.info(f"[DEACTIVATE] Marked for deactivation for user {user_id}: {deactivated_platforms}")

    async def handle_oauth_callback(
        self,
        request: Request,
        db: Session,
        platform: str,
        user_data: OAuthUserData,
        current_user: Optional[Dict] = None,
        auto_connect_bot: bool = True
    ) -> OAuthResult:
        """
        Общая логика обработки OAuth callback для любой платформы
        
        Args:
            request: FastAPI Request объект
            db: Database session
            platform: Название платформы (twitch, vk, etc.)
            user_data: Данные пользователя от OAuth провайдера
            current_user: Текущий авторизованный пользователь (для linking)
            auto_connect_bot: Автоматически подключать бота после авторизации
            
        Returns:
            OAuthResult с информацией о пользователе и редиректе
        """
        try:
            # Определяем сценарий: новый вход или привязка аккаунта
            unified_user = None
            is_linking = current_user is not None

            # Получаем session_id из cookies (если есть)
            session_id = request.cookies.get('session_id')
            logger.info(f"[OAUTH START] session_id from cookie: {session_id[:8] if session_id else 'NONE'}")

            # Централизованная проверка отпечатков платформ
            platform_fingerprint = f"{platform}:{user_data.platform_user_id}"
            logger.info(f"Checking platform fingerprint: {platform_fingerprint}")

            # Ищем существующие токены этой платформы
            db.query(UserToken).filter(
                UserToken.platform == platform,
                UserToken.platform_user_id == user_data.platform_user_id
            ).all()

            # Инициализируем переменные
            existing_token = None
            current_user.get('id') if current_user else None
            # session_id уже получен из cookie
            # Если создается новая сессия, он будет переопределен

            # === СТРОГАЯ ЛОГИКА ЗАМЕЩЕНИЯ СЕССИЙ БЕЗ ДУБЛИРОВАНИЯ ===

            # 1. ПРОВЕРЯЕМ: Есть ли активная сессия для этого канала?
            # Для Twitch используем username вместо ID
            if platform == Platform.VK:
                channel_name = (user_data.channel_name or user_data.platform_user_id).lower()
            elif user_data.username:
                channel_name = user_data.username.lower()
            else:
                channel_name = user_data.platform_user_id.lower()
            from sqlalchemy import text
            # PostgreSQL использует оператор ->> для извлечения JSON значений
            json_query = "device_info->>'monitored_channel' = :channel"

            active_session = db.query(UserSession).filter(
                UserSession.is_active,
                text(json_query)
            ).params(channel=channel_name).first()

            # Проверяем авторизованные сессии для этого канала
            if active_session:
                logger.info(f"Found active session {active_session.session_id} for channel {channel_name}")
                # Активная сессия принадлежит авторизованному пользователю
                if True:
                    existing_user = db.query(User).filter(User.id == active_session.user_id).first()

                    if is_linking and current_user and existing_user.id != current_user['id']:
                        # Сценарий: пользователь пытается привязать платформу, которая уже обслуживает канал
                        logger.warning(f"Channel {channel_name} already served by user {existing_user.id}, replacing session")

                        # Завершаем старую сессию
                        active_session.is_active = False
                        active_session.ended_at = utcnow_naive()

                        # Создаем новую сессию для текущего пользователя
                        device_info = {
                            "user_agent": request.headers.get("user-agent"),
                            "ip": getattr(request.client, 'host', 'unknown'),
                            "monitored_channel": channel_name,
                            "platform": platform,
                            "replaced_session": active_session.session_id
                        }

                        session_id = session_manager.create_session(
                            user_id=current_user['id'],
                            device_info=device_info
                        )
                        logger.info(f"[OK] Created replacement session: {session_id}")

                        # Объединяем аккаунты если нужно
                        if existing_user.id != current_user['id']:
                            session_manager._merge_user_accounts(existing_user.id, current_user['id'], db)
                            db.delete(existing_user)

                        unified_user = db.query(User).filter(User.id == current_user['id']).first()
                        logger.info(f"Replaced session for channel {channel_name}")

                    else:
                        # Обновляем токены существующего пользователя
                        logger.info(f"Updating tokens for existing user {existing_user.id}")
                        unified_user = existing_user

                        # SECURITY: Деактивируем все другие токены ТОЛЬКО при новом логине
                        # НЕ деактивируем при добавлении интеграции (is_linking=True)
                        if not is_linking:
                            logger.info("[SECURITY] New login detected - deactivating other platform tokens")
                            self._deactivate_other_platform_tokens(existing_user.id, platform, db)
                        else:
                            logger.info("[LINK] Linking integration - keeping other tokens active")

                        # Обновляем токены
                        existing_token = db.query(UserToken).filter(
                            UserToken.user_id == existing_user.id,
                            UserToken.platform == platform
                        ).first()

                        if existing_token:
                            existing_token.access_token = user_data.access_token
                            existing_token.refresh_token = user_data.refresh_token
                            existing_token.expires_at = user_data.expires_at
                            existing_token.scopes = user_data.scopes
                            existing_token.avatar_url = user_data.avatar_url
                            existing_token.is_active = True  # Активируем токен при повторной авторизации
                            logger.info(f"[OK] Token updated for platform {platform}")
                        else:
                            # Создаем новый токен
                            session_manager.save_user_tokens(
                                user_id=existing_user.id,
                                platform=platform,
                                platform_user_id=user_data.platform_user_id,
                                avatar_url=user_data.avatar_url,
                                access_token=user_data.access_token,
                                refresh_token=user_data.refresh_token,
                                expires_at=user_data.expires_at,
                                scopes=user_data.scopes
                            )
                            logger.info(f"[OK] New token created for platform {platform}")

                        # IMPORTANT: Инвалидируем кеш валидации токена после OAuth
                        from core.token_validation_cache import token_validation_cache
                        token_validation_cache.invalidate(existing_user.id, platform)
                        logger.info(f"[CACHE] Token validation cache invalidated for user {existing_user.id}, platform {platform}")

                        # Обновляем username
                        if platform == "twitch" and hasattr(user_data, 'username'):
                            unified_user.twitch_username = user_data.username
                        elif platform == "vk":
                            if user_data.channel_name:
                                unified_user.vk_channel_name = user_data.channel_name
                                logger.info(f"Updated VK channel_name: {user_data.channel_name}")
                            if user_data.username:
                                unified_user.vk_username = user_data.username

                        db.commit()
                        logger.info(f"Updated {platform} tokens for user {unified_user.id}")

            # 2. НЕТ АКТИВНОЙ СЕССИИ - создаем новую
            else:
                if is_linking and current_user:
                    # Привязка к существующему пользователю
                    logger.info(f"Linking {platform} to existing user {current_user['id']}")
                    unified_user = db.query(User).filter(User.id == current_user['id']).first()

                    if not unified_user:
                        raise HTTPException(
                            status_code=HTTP_STATUS.BAD_REQUEST,
                            detail=ErrorMessages.USER_NOT_FOUND
                        )

                    # Сохраняем токены
                    session_manager.save_user_tokens(
                        user_id=unified_user.id,
                        platform=platform,
                        platform_user_id=user_data.platform_user_id,
                        avatar_url=user_data.avatar_url,
                        access_token=user_data.access_token,
                        refresh_token=user_data.refresh_token,
                        expires_at=user_data.expires_at,
                        scopes=user_data.scopes
                    )
                    # Инвалидируем кеш после сохранения токена
                    from core.token_validation_cache import token_validation_cache
                    token_validation_cache.invalidate(unified_user.id, platform)
                    logger.info("[CACHE] Token validation cache invalidated after session creation")

                    # Обновляем username
                    if platform == "twitch" and hasattr(user_data, 'username'):
                        unified_user.twitch_username = user_data.username
                    elif platform == "vk":
                        if user_data.channel_name:
                            unified_user.vk_channel_name = user_data.channel_name
                            logger.info(f"Updated VK channel_name: {user_data.channel_name}")
                        if user_data.username:
                            unified_user.vk_username = user_data.username

                    db.commit()
                    logger.info(f"Added {platform} integration to user {unified_user.id}")

                else:
                    # Создаем нового пользователя через централизованный сервис
                    logger.info(f"Creating new user for {platform} ID {user_data.platform_user_id}")
                    from core.user_creation_service import user_creation_service

                    unified_user = await user_creation_service.find_or_create_user(
                        db=db,
                        platform=platform,
                        platform_user_id=user_data.platform_user_id,
                        username=user_data.username,
                        avatar_url=user_data.avatar_url,
                        access_token=user_data.access_token,
                        refresh_token=user_data.refresh_token,
                        expires_at=user_data.expires_at,
                        scopes=user_data.scopes,
                        current_user_id=current_user.get('id') if current_user else None,
                        is_admin=False
                    )

                    # SECURITY FIX: При входе с нового устройства с использованием существующего аккаунта
                    # мы должны деактивировать токены других платформ, чтобы предотвратить
                    # несанкционированный доступ ко всем привязанным платформам.
                    if unified_user and not is_linking:
                         logger.info(f"[SECURITY] Login via {platform} (User ID {unified_user.id}) - deactivating other platform tokens")
                         self._deactivate_other_platform_tokens(unified_user.id, platform, db)
                         db.commit()

            if not unified_user:
                raise HTTPException(
                    status_code=HTTP_STATUS.INTERNAL_SERVER_ERROR,
                    detail=ErrorMessages.USER_CREATION_FAILED
                )

            # Сохраняем токены пользователя (save_user_tokens автоматически обновляет существующие или создаёт новые)
            logger.info(f"[SAVE] Saving OAuth tokens for user {unified_user.id}, platform {platform}")
            session_manager.save_user_tokens(
                user_id=unified_user.id,
                platform=platform,
                platform_user_id=user_data.platform_user_id,
                avatar_url=user_data.avatar_url,
                access_token=user_data.access_token,
                refresh_token=user_data.refresh_token,
                expires_at=user_data.expires_at,
                scopes=user_data.scopes
            )
            logger.info(f"[OK] OAuth tokens saved for user {unified_user.id}, platform {platform}")

            # Сохраняем username в соответствующее поле пользователя
            if platform == "twitch" and hasattr(user_data, 'username'):
                logger.info(f"Saving Twitch username: {user_data.username}")
                unified_user.twitch_username = user_data.username
            elif platform == "vk":
                if user_data.channel_name:
                    unified_user.vk_channel_name = user_data.channel_name
                    logger.info(f"Updated VK channel_name: {user_data.channel_name}")
                if user_data.username:
                    unified_user.vk_username = user_data.username
