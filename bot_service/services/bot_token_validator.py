"""
Сервис для валидации и мониторинга токенов ботов.

Токены ботов (TWITCH_BOT_TOKEN, VK_LIVE_USER_TOKEN) не имеют refresh_token,
поэтому требуют ручного обновления при истечении.

Этот сервис:
- Валидирует токены при старте
- Периодически проверяет их валидность
- Уведомляет о проблемах
- Предоставляет инструкции по обновлению
"""

import logging
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime

import httpx

from core.config import settings
from core.datetime_utils import utcnow_naive
from services.twitch_bot_oauth_service import twitch_bot_oauth_service

logger = logging.getLogger(__name__)


class BotTokenValidator:
    """Валидатор токенов ботов"""
    
    def __init__(self):
        self.last_twitch_check: Optional[datetime] = None
        self.last_vk_check: Optional[datetime] = None
        self.twitch_token_valid: bool = False
        self.vk_token_valid: bool = False
        self._monitoring_task: Optional[asyncio.Task] = None
    
    async def validate_twitch_bot_token(self) -> Dict[str, Any]:
        """
        Валидирует Twitch bot token.
        Приоритет: Token из БД > Token из .env
        
        Returns:
            dict: {
                'valid': bool,
                'user_id': str,
                'login': str,
                'error': str (если invalid)
            }
        """
        # 1. Пытаемся получить токен из БД
        try:
            bot_token = await twitch_bot_oauth_service.get_bot_token()
            token_to_check = bot_token.get('access_token') if bot_token else None
        except Exception as e:
            logger.error(f"[BOT TOKEN] Failed to get token from DB: {e}")
            token_to_check = None

        # 2. Если нет в БД, пробуем из .env (Legacy)
        if not token_to_check:
            if settings.twitch_bot_token:
                logger.info("[BOT TOKEN] Using legacy token from .env")
                token_to_check = settings.twitch_bot_token.replace("oauth:", "")
            else:
                logger.warning("[BOT TOKEN] TWITCH_BOT_TOKEN not configured in DB or .env")
                return {
                    'valid': False,
                    'error': 'Token not configured',
                    'instructions': 'Authorize bot in Admin Panel'
                }
        
        try:
            # Twitch validate endpoint
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    'https://id.twitch.tv/oauth2/validate',
                    headers={'Authorization': f'Bearer {token_to_check}'}
                )
            
            if response.status_code == 200:
                data = response.json()
                self.twitch_token_valid = True
                self.last_twitch_check = utcnow_naive()
                
                # Check if it matches expected bot user if we have one in DB
                db_login = bot_token.get('bot_login') if bot_token else None
                if db_login and data.get('login') != db_login:
                     logger.warning(f"[BOT TOKEN] Token valid but belongs to {data.get('login')}, expected {db_login}")

                logger.info("[OK] [BOT TOKEN] Twitch bot token is VALID")
                # logger.info(f"[INFO] Bot user: {data.get('login')} (ID: {data.get('user_id')})")
                
                return {
                    'valid': True,
                    'user_id': data.get('user_id'),
                    'login': data.get('login'),
                    'expires_in': data.get('expires_in'),
                    'scopes': data.get('scopes', [])
                }
            
            elif response.status_code == 401:
                self.twitch_token_valid = False
                logger.error("[ERROR] [BOT TOKEN] Twitch bot token is INVALID or EXPIRED!")
                
                # Try auto-refresh if we have a refresh token in DB
                if bot_token and bot_token.get('refresh_token'):
                     logger.info("[BOT TOKEN] Attempting auto-refresh...")
                     refresh_success = await twitch_bot_oauth_service.refresh_bot_token()
                     if refresh_success:
                          logger.info("[BOT TOKEN] Auto-refresh successful, re-validating...")
                          return await self.validate_twitch_bot_token() # Recursion (safe, one level usually)
                
                return {
                    'valid': False,
                    'error': 'Token invalid or expired',
                    'status_code': 401,
                    'instructions': 'Please re-authorize bot in Admin Panel'
                }
            
            else:
                logger.error(f"[ERROR] [BOT TOKEN] Unexpected response: {response.status_code}")
                return {
                    'valid': False,
                    'error': f'Unexpected status code: {response.status_code}',
                    'status_code': response.status_code
                }
        
        except Exception as e:
            logger.error(f"[ERROR] [BOT TOKEN] Failed to validate Twitch token: {e}")
            return {
                'valid': False,
                'error': str(e)
            }
    
    async def validate_vk_bot_token(self) -> Dict[str, Any]:
        """
        Валидирует VK Live bot token.
        
        Returns:
            dict: {
                'valid': bool,
                'error': str (если invalid)
            }
        """
        if not settings.vk_live_user_token:
            logger.info("[INFO] [BOT TOKEN] VK_LIVE_USER_TOKEN not configured (optional)")
            return {
                'valid': False,
                'error': 'Token not configured',
                'optional': True
            }
        
        try:
            # VK Live current_user endpoint
            ssl_verify = settings.is_production
            async with httpx.AsyncClient(timeout=10.0, verify=ssl_verify) as client:
                response = await client.get(
                    'https://apidev.live.vkvideo.ru/v1/current_user',
                    headers={'Authorization': f'Bearer {settings.vk_live_user_token}'}
                )
            
            if response.status_code == 200:
                data = response.json()
                self.vk_token_valid = True
                self.last_vk_check = utcnow_naive()
                
                logger.info("[OK] [BOT TOKEN] VK Live bot token is VALID")
                logger.info(f"[INFO] Bot user: {data.get('username', 'unknown')}")
                
                return {
                    'valid': True,
                    'username': data.get('username'),
                    'user_id': data.get('id')
                }
            
            elif response.status_code == 401:
                self.vk_token_valid = False
                logger.error("=" * 80)
                logger.error("[ERROR] [BOT TOKEN] VK Live bot token is INVALID or EXPIRED!")
                logger.error("=" * 80)
                logger.error("[FIX] VK Live uses ClientCredentials flow")
                logger.error("[FIX] Token should be auto-generated on startup")
                logger.error("[FIX] Check VK_CLIENT_ID and VK_CLIENT_SECRET in .env")
                logger.error("=" * 80)
                
                return {
                    'valid': False,
                    'error': 'Token invalid or expired',
                    'status_code': 401
                }
            
            else:
                logger.error(f"[ERROR] [BOT TOKEN] Unexpected VK response: {response.status_code}")
                return {
                    'valid': False,
                    'error': f'Unexpected status code: {response.status_code}',
                    'status_code': response.status_code
                }
        
        except Exception as e:
            logger.error(f"[ERROR] [BOT TOKEN] Failed to validate VK token: {e}")
            return {
                'valid': False,
                'error': str(e)
            }
    
    async def validate_all_tokens(self) -> Dict[str, Dict[str, Any]]:
        """
        Валидирует все токены ботов.
        
        Returns:
            dict: {
                'twitch': validation_result,
                'vk': validation_result
            }
        """
        logger.info("=" * 80)
        logger.info("[BOT TOKEN] Validating bot tokens...")
        logger.info("=" * 80)
        
        results = {
            'twitch': await self.validate_twitch_bot_token(),
            'vk': await self.validate_vk_bot_token()
        }
        
        # Сводка
        logger.info("=" * 80)
        logger.info("[BOT TOKEN] Validation Summary:")
        logger.info(f"  Twitch: {'[VALID]' if results['twitch']['valid'] else '[INVALID]'}")
        logger.info(f"  VK Live: {'[VALID]' if results['vk']['valid'] else '[INVALID] (optional)' if results['vk'].get('optional') else '[INVALID]'}")
        logger.info("=" * 80)
        
        return results
    
    async def start_monitoring(self, check_interval: int = 3600):
        """
        Запускает периодический мониторинг токенов.
        
        Args:
            check_interval: Интервал проверки в секундах (по умолчанию 1 час)
        """
        if self._monitoring_task and not self._monitoring_task.done():
            logger.warning("[BOT TOKEN] Monitoring already running")
            return
        
        logger.info(f"[BOT TOKEN] Starting token monitoring (interval: {check_interval}s)")
        self._monitoring_task = asyncio.create_task(self._monitoring_loop(check_interval))
    
    async def stop_monitoring(self):
        """Останавливает мониторинг токенов"""
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
            logger.info("[BOT TOKEN] Monitoring stopped")
    
    async def _monitoring_loop(self, interval: int):
        """Цикл мониторинга токенов"""
        while True:
            try:
                await asyncio.sleep(interval)
                
                logger.info("[BOT TOKEN] Periodic token validation...")
                results = await self.validate_all_tokens()
                
                # Если токен стал невалидным - логируем предупреждение
                if not results['twitch']['valid']:
                    logger.error("[ALERT] Twitch bot token is invalid! Bot will not work!")
                
                if not results['vk']['valid'] and not results['vk'].get('optional'):
                    logger.warning("[ALERT] VK Live bot token is invalid!")
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[ERROR] Error in token monitoring loop: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """
        Получить текущий статус токенов.
        
        Returns:
            dict: Статус всех токенов
        """
        return {
            'twitch': {
                'valid': self.twitch_token_valid,
                'last_check': self.last_twitch_check.isoformat() if self.last_twitch_check else None
            },
            'vk': {
                'valid': self.vk_token_valid,
                'last_check': self.last_vk_check.isoformat() if self.last_vk_check else None
            },
            'monitoring_active': self._monitoring_task is not None and not self._monitoring_task.done()
        }


# Глобальный экземпляр
bot_token_validator = BotTokenValidator()
