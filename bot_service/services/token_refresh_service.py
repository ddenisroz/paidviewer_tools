"""
Сервис для автоматического обновления токенов платформ
"""
import logging
import httpx
import aiohttp
import base64
from datetime import timedelta
from typing import Optional, Callable, Awaitable
from sqlalchemy.orm import Session

from core.database import db_session, UserToken
from core.token_encryption import encrypt_token, decrypt_token
from core.datetime_utils import utcnow_naive
from core.retry_utils import retry_async
from core.config import settings

logger = logging.getLogger('token_refresh')

# Типы для refresh handlers
RefreshHandler = Callable[[UserToken, Session], Awaitable[bool]]


class TokenRefreshService:
    """Сервис для обновления access tokens используя refresh tokens"""

    # Dictionary dispatch для платформ
    _refresh_handlers: dict[str, RefreshHandler] = {}

    @classmethod
    def _get_refresh_handler(cls, platform: str) -> Optional[RefreshHandler]:
        """Получить handler для обновления токена платформы"""
        if not cls._refresh_handlers:
            cls._refresh_handlers = {
                'twitch': cls._refresh_twitch,
                'vk': cls._refresh_vk,
                'donationalerts': cls._refresh_donationalerts
            }
        return cls._refresh_handlers.get(platform)

    @staticmethod
    async def refresh_if_needed(user_id: int, platform: str, db: Optional[Session] = None) -> bool:
        """
        Проверить и обновить токен если истекает в течение 7 дней.
        
        Returns:
            bool: True если токен валиден или успешно обновлен
        """
        def _check_and_refresh(session_db: Session) -> tuple[Optional[UserToken], bool]:
            token = session_db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == platform
            ).first()

            if not token:
                logger.warning(f"No token found for user {user_id} platform {platform}")
                return None, False

            # Если expires_at не установлен - считаем токен валидным
            if not token.expires_at:
                return token, True

            days_left = (token.expires_at - utcnow_naive()).days
            needs_refresh = days_left < 7

            if not needs_refresh:
                logger.debug(f"✓ Token valid for {days_left} more days")

            return token, not needs_refresh

        try:
            if db is not None:
                token, is_valid = _check_and_refresh(db)
                if is_valid or token is None:
                    return is_valid
                return await TokenRefreshService._refresh_token(token, db)

            with db_session() as new_db:
                token, is_valid = _check_and_refresh(new_db)
                if is_valid or token is None:
                    return is_valid
                return await TokenRefreshService._refresh_token(token, new_db)
        except Exception as e:
            logger.error(f"Error checking token expiration: {e}", exc_info=True)
            return False

    @staticmethod
    async def refresh_on_401(user_id: int, platform: str, db: Optional[Session] = None) -> bool:
        """Обновить токен после получения 401 ошибки"""
        def _get_token(session_db: Session) -> Optional[UserToken]:
            return session_db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == platform
            ).first()

        try:
            if db is not None:
                token = _get_token(db)
                if not token:
                    logger.error(f"No token found for user {user_id} platform {platform}")
                    return False
                logger.info(f"[REFRESH] Refreshing token after 401 error for user {user_id}")
                return await TokenRefreshService._refresh_token(token, db)

            with db_session() as new_db:
                token = _get_token(new_db)
                if not token:
                    logger.error(f"No token found for user {user_id} platform {platform}")
                    return False
                logger.info(f"[REFRESH] Refreshing token after 401 error for user {user_id}")
                return await TokenRefreshService._refresh_token(token, new_db)
        except Exception as e:
            logger.error(f"Error refreshing token on 401: {e}", exc_info=True)
            return False

    @staticmethod
    async def _refresh_token(token: UserToken, db: Session) -> bool:
        """Обновить токен используя refresh_token (dictionary dispatch)"""
        handler = TokenRefreshService._get_refresh_handler(token.platform)
        if not handler:
            logger.error(f"Unknown platform: {token.platform}")
            return False
        return await handler(token, db)

    @staticmethod
    async def _make_refresh_request(url: str, data: dict, headers: dict = None) -> Optional[httpx.Response]:
        """Общий метод для выполнения refresh запроса с retry"""
        async def _do_refresh():
            async with httpx.AsyncClient(timeout=15.0) as client:
                return await client.post(url, data=data, headers=headers)

        return await retry_async(
            _do_refresh,
            max_attempts=3,
            initial_delay=2.0,
            retry_on=(httpx.NetworkError, httpx.TimeoutException, aiohttp.ClientError)
        )

    @staticmethod
    def _update_token_from_response(token: UserToken, data: dict, db: Session) -> None:
        """Обновить токен в БД из ответа OAuth"""
        token.access_token = encrypt_token(data["access_token"])
        token.refresh_token = encrypt_token(data["refresh_token"])
        token.expires_at = utcnow_naive() + timedelta(seconds=data["expires_in"])
        token.updated_at = utcnow_naive()
        db.commit()

    @staticmethod
    async def _refresh_twitch(token: UserToken, db: Session) -> bool:
        """Обновить Twitch токен"""
        if not token.refresh_token:
            logger.error(f"No refresh token for Twitch user {token.user_id}")
            return False

        if not settings.twitch_client_id or not settings.twitch_client_secret:
            logger.error("Twitch credentials not configured")
            return False

        try:
            refresh_token = decrypt_token(token.refresh_token)

            logger.info(f"[API] Requesting new Twitch token for user {token.user_id}")
            response = await TokenRefreshService._make_refresh_request(
                "https://id.twitch.tv/oauth2/token",
                {
                    "client_id": settings.twitch_client_id,
                    "client_secret": settings.twitch_client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token
                }
            )

            if not response:
                logger.error("[ERROR] Failed to refresh Twitch token after retries")
                return False

            if response.status_code == 200:
                TokenRefreshService._update_token_from_response(token, response.json(), db)
                logger.info(f"[OK] Twitch token refreshed for user {token.user_id}")
                return True

            if response.status_code == 400:
                error_data = response.json()
                logger.error(f"[ERROR] Failed to refresh Twitch token: {error_data}")
                if error_data.get("message") == "Invalid refresh token":
                    token.refresh_token = None
                    db.commit()
            else:
                logger.error(f"[ERROR] Failed to refresh token: {response.status_code}")

            return False
        except Exception as e:
            logger.error(f"Error refreshing Twitch token: {e}", exc_info=True)
            return False

    @staticmethod
    async def _refresh_vk(token: UserToken, db: Session) -> bool:
        """Обновить VK Live токен"""
        if not token.refresh_token:
            logger.error(f"No refresh token for VK user {token.user_id}")
            return False

        if not settings.vk_client_id or not settings.vk_client_secret:
            logger.error("VK credentials not configured")
            return False

        try:
            refresh_token = decrypt_token(token.refresh_token)
            credentials = f"{settings.vk_client_id}:{settings.vk_client_secret}"
            auth_header = base64.b64encode(credentials.encode()).decode()

            logger.info(f"[API] Requesting new VK Live token for user {token.user_id}")
            response = await TokenRefreshService._make_refresh_request(
                "https://api.live.vkvideo.ru/oauth/server/token",
                {
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "redirect_uri": settings.vk_redirect_uri
                },
                {
                    "Authorization": f"Basic {auth_header}",
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            )

            if not response:
                logger.error("[ERROR] Failed to refresh VK token after retries")
                return False

            if response.status_code == 200:
                TokenRefreshService._update_token_from_response(token, response.json(), db)
                logger.info(f"[OK] VK Live token refreshed for user {token.user_id}")
                return True

            logger.error(f"[ERROR] Failed to refresh VK token: {response.status_code}")
            return False
        except Exception as e:
            logger.error(f"Error refreshing VK token: {e}", exc_info=True)
            return False

    @staticmethod
    async def _refresh_donationalerts(token: UserToken, db: Session) -> bool:
        """Обновить DonationAlerts токен"""
        if not token.refresh_token:
            logger.error(f"No refresh token for DA user {token.user_id}")
            return False

        if not settings.donationalerts_client_id or not settings.donationalerts_client_secret:
            logger.error("DonationAlerts credentials not configured")
            return False

        try:
            refresh_token = decrypt_token(token.refresh_token)

            logger.info(f"[API] Requesting new DonationAlerts token for user {token.user_id}")
            response = await TokenRefreshService._make_refresh_request(
                "https://www.donationalerts.com/oauth/token",
                {
                    "client_id": settings.donationalerts_client_id,
                    "client_secret": settings.donationalerts_client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token
                }
            )

            if not response:
                logger.error("[ERROR] Failed to refresh DonationAlerts token after retries")
                return False

            if response.status_code == 200:
                TokenRefreshService._update_token_from_response(token, response.json(), db)
                logger.info(f"[OK] DonationAlerts token refreshed for user {token.user_id}")
                return True

            logger.error(f"[ERROR] Failed to refresh DA token: {response.status_code}")
            return False
        except Exception as e:
            logger.error(f"Error refreshing DonationAlerts token: {e}", exc_info=True)
            return False


# Глобальный экземпляр сервиса
token_refresh_service = TokenRefreshService()

