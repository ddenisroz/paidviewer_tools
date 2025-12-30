"""
VK Token Refresh Service - автоматическое обновление токенов VK Live

Документация: docs/vk/Авторизация.md
Дата создания: 27 декабря 2025
"""
import asyncio
import httpx
import structlog
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from core.database import get_db, UserToken
from core.config import settings

logger = structlog.get_logger(__name__)


class VKTokenRefreshService:
    """
    Сервис автоматического обновления VK токенов
    
    Features:
    - Фоновая задача проверки токенов каждый час
    - Автообновление токенов за 24 часа до истечения
    - Обработка ошибок с деактивацией невалидных токенов
    - Ручное обновление токена по требованию
    
    Документация: docs/vk/Авторизация.md
    
    Example:
        >>> service = VKTokenRefreshService()
        >>> await service.start()  # Запустить фоновую задачу
        >>> # ... приложение работает ...
        >>> await service.stop()   # Остановить при shutdown
    """
    
    def __init__(self):
        """Инициализация сервиса"""
        self.refresh_task: Optional[asyncio.Task] = None
        self.running = False
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0)
        )
        logger.info("vk_token_refresh_service_initialized")
        
    async def start(self):
        """
        Запустить фоновую задачу обновления токенов
        
        Задача проверяет токены каждый час и обновляет те,
        которые истекут в течение 24 часов.
        """
        if self.running:
            logger.warning("vk_token_refresh_service_already_running")
            return
            
        self.running = True
        self.refresh_task = asyncio.create_task(self._refresh_loop())
        logger.info("vk_token_refresh_service_started")
        
    async def stop(self):
        """
        Остановить фоновую задачу
        
        Вызывается при shutdown приложения.
        """
        if not self.running:
            return
            
        self.running = False
        
        if self.refresh_task:
            self.refresh_task.cancel()
            try:
                await self.refresh_task
            except asyncio.CancelledError:
                pass
                
        await self.client.aclose()
        logger.info("vk_token_refresh_service_stopped")
        
    async def _refresh_loop(self):
        """
        Цикл проверки и обновления токенов
        
        Выполняется каждый час. При ошибке - повторная попытка через 5 минут.
        """
        while self.running:
            try:
                await self._check_and_refresh_tokens()
                # Проверять каждый час
                await asyncio.sleep(3600)
                
            except Exception as e:
                logger.error(
                    "vk_token_refresh_loop_error",
                    error=str(e),
                    error_type=type(e).__name__
                )
                # При ошибке - повторить через 5 минут
                await asyncio.sleep(300)
                
    async def _check_and_refresh_tokens(self):
        """
        Проверить и обновить токены, которые скоро истекут
        
        Находит все VK токены, которые истекут в течение 24 часов,
        и обновляет их используя refresh_token.
        """
        with next(get_db()) as db:
            # Найти токены, которые истекут в течение 24 часов
            expiring_soon = datetime.utcnow() + timedelta(hours=24)
            
            tokens = db.query(UserToken).filter(
                UserToken.platform == 'vk',
                UserToken.expires_at <= expiring_soon,
                UserToken.expires_at > datetime.utcnow(),  # Еще не истекли
                UserToken.refresh_token.isnot(None)
            ).all()
            
            if not tokens:
                logger.debug("vk_token_refresh_no_tokens_to_refresh")
                return
                
            logger.info(
                "vk_token_refresh_checking",
                tokens_count=len(tokens)
            )
            
            for token in tokens:
                try:
                    await self._refresh_token(token, db)
                    
                except Exception as e:
                    logger.error(
                        "vk_token_refresh_failed",
                        user_id=token.user_id,
                        error=str(e),
                        error_type=type(e).__name__
                    )
                    
                    # Если refresh_token невалиден - деактивировать токен
                    if "invalid_grant" in str(e).lower():
                        token.is_active = False
                        db.commit()
                        logger.warning(
                            "vk_token_deactivated",
                            user_id=token.user_id,
                            reason="invalid_refresh_token"
                        )
                        
    async def _refresh_token(self, token: UserToken, db: Session):
        """
        Обновить конкретный токен
        
        Документация: docs/vk/Авторизация.md
        POST https://api.live.vkvideo.ru/oauth/server/token
        
        Args:
            token: Токен для обновления
            db: Сессия базы данных
            
        Raises:
            httpx.HTTPError: При ошибке HTTP запроса
        """
        logger.info(
            "vk_token_refreshing",
            user_id=token.user_id,
            expires_at=token.expires_at.isoformat()
        )
        
        # Подготовить данные для запроса
        data = {
            'grant_type': 'refresh_token',
            'refresh_token': token.refresh_token,
            'client_id': settings.VK_CLIENT_ID,
            'client_secret': settings.VK_CLIENT_SECRET
        }
        
        # Отправить запрос на обновление токена
        response = await self.client.post(
            'https://api.live.vkvideo.ru/oauth/server/token',
            data=data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        response.raise_for_status()
        token_data = response.json()
        
        # Обновить токен в базе данных
        token.access_token = token_data['access_token']
        
        if 'refresh_token' in token_data:
            token.refresh_token = token_data['refresh_token']
            
        if 'expires_in' in token_data:
            token.expires_at = datetime.utcnow() + timedelta(
                seconds=token_data['expires_in']
            )
            
        db.commit()
        
        logger.info(
            "vk_token_refreshed",
            user_id=token.user_id,
            new_expires_at=token.expires_at.isoformat()
        )
        
    async def refresh_token_manually(self, user_id: int) -> bool:
        """
        Вручную обновить токен пользователя
        
        Используется когда нужно немедленно обновить токен,
        не дожидаясь фоновой задачи.
        
        Args:
            user_id: ID пользователя
            
        Returns:
            bool: True если токен обновлен, False если не найден или ошибка
            
        Example:
            >>> service = VKTokenRefreshService()
            >>> success = await service.refresh_token_manually(user_id=123)
            >>> if success:
            ...     print("Токен обновлен")
        """
        with next(get_db()) as db:
            token = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == 'vk',
                UserToken.refresh_token.isnot(None)
            ).first()
            
            if not token:
                logger.warning(
                    "vk_token_refresh_manual_not_found",
                    user_id=user_id
                )
                return False
                
            try:
                await self._refresh_token(token, db)
                return True
                
            except Exception as e:
                logger.error(
                    "vk_token_refresh_manual_failed",
                    user_id=user_id,
                    error=str(e)
                )
                return False
                
    async def get_token_status(self, user_id: int) -> Optional[dict]:
        """
        Получить статус токена пользователя
        
        Args:
            user_id: ID пользователя
            
        Returns:
            dict: Информация о токене или None если не найден
            
        Example:
            >>> status = await service.get_token_status(user_id=123)
            >>> print(f"Токен истекает: {status['expires_at']}")
            >>> print(f"Осталось часов: {status['hours_until_expiry']}")
        """
        with next(get_db()) as db:
            token = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == 'vk'
            ).first()
            
            if not token:
                return None
                
            now = datetime.utcnow()
            time_until_expiry = token.expires_at - now if token.expires_at else None
            
            return {
                'user_id': token.user_id,
                'platform': token.platform,
                'is_active': token.is_active,
                'expires_at': token.expires_at.isoformat() if token.expires_at else None,
                'has_refresh_token': token.refresh_token is not None,
                'hours_until_expiry': time_until_expiry.total_seconds() / 3600 if time_until_expiry else None,
                'needs_refresh': time_until_expiry and time_until_expiry < timedelta(hours=24)
            }


# Глобальный экземпляр сервиса
vk_token_refresh_service = VKTokenRefreshService()
