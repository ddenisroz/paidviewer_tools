"""
РЎРµСЂРІРёСЃ РґР»СЏ РІР°Р»РёРґР°С†РёРё Рё РјРѕРЅРёС‚РѕСЂРёРЅРіР° С‚РѕРєРµРЅРѕРІ Р±РѕС‚РѕРІ.

OAuth Р±РѕС‚-С‚РѕРєРµРЅС‹ С…СЂР°РЅСЏС‚СЃСЏ РІ Р‘Р” Рё РјРѕРіСѓС‚ РѕР±РЅРѕРІР»СЏС‚СЊСЃСЏ РїРѕ refresh_token.
Legacy env-С‚РѕРєРµРЅС‹ (TWITCH_BOT_TOKEN, VK_LIVE_USER_TOKEN) РїРѕРґРґРµСЂР¶РёРІР°СЋС‚СЃСЏ РєР°Рє fallback,
РЅРѕ РЅРµ РёРјРµСЋС‚ refresh_token Рё С‚СЂРµР±СѓСЋС‚ СЂСѓС‡РЅРѕРіРѕ РѕР±РЅРѕРІР»РµРЅРёСЏ РїСЂРё РёСЃС‚РµС‡РµРЅРёРё.

Р­С‚РѕС‚ СЃРµСЂРІРёСЃ:
- Р’Р°Р»РёРґРёСЂСѓРµС‚ С‚РѕРєРµРЅС‹ РїСЂРё СЃС‚Р°СЂС‚Рµ
- РџРµСЂРёРѕРґРёС‡РµСЃРєРё РїСЂРѕРІРµСЂСЏРµС‚ РёС… РІР°Р»РёРґРЅРѕСЃС‚СЊ
- РЈРІРµРґРѕРјР»СЏРµС‚ Рѕ РїСЂРѕР±Р»РµРјР°С…
- РџСЂРµРґРѕСЃС‚Р°РІР»СЏРµС‚ РёРЅСЃС‚СЂСѓРєС†РёРё РїРѕ РѕР±РЅРѕРІР»РµРЅРёСЋ
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
    """Р’Р°Р»РёРґР°С‚РѕСЂ С‚РѕРєРµРЅРѕРІ Р±РѕС‚РѕРІ"""
    
    def __init__(self):
        self.last_twitch_check: Optional[datetime] = None
        self.last_vk_check: Optional[datetime] = None
        self.twitch_token_valid: bool = False
        self.vk_token_valid: bool = False
        self._monitoring_task: Optional[asyncio.Task] = None
    
    async def validate_twitch_bot_token(self) -> Dict[str, Any]:
        """
        Р’Р°Р»РёРґРёСЂСѓРµС‚ Twitch bot token.
        РџСЂРёРѕСЂРёС‚РµС‚: Token РёР· Р‘Р” > Token РёР· .env
        
        Returns:
            dict: {
                'valid': bool,
                'user_id': str,
                'login': str,
                'error': str (РµСЃР»Рё invalid)
            }
        """
        # 1. РџС‹С‚Р°РµРјСЃСЏ РїРѕР»СѓС‡РёС‚СЊ С‚РѕРєРµРЅ РёР· Р‘Р”
        try:
            bot_token = await twitch_bot_oauth_service.get_bot_token()
            token_to_check = bot_token.get('access_token') if bot_token else None
        except Exception as e:
            logger.error(f"[BOT TOKEN] Failed to get token from DB: {e}")
            token_to_check = None
        use_env_fallback = False

        # 2. Р•СЃР»Рё РЅРµС‚ РІ Р‘Р” вЂ” РёСЃРїРѕР»СЊР·СѓРµРј env fallback (Р±РµР· refresh)
        if not token_to_check:
            if settings.twitch_bot_token:
                token_to_check = settings.twitch_bot_token
                use_env_fallback = True
                logger.warning("[BOT TOKEN] Using legacy Twitch bot token from .env (no refresh)")
            else:
                logger.error("[BOT TOKEN] Twitch bot OAuth token not configured")
                return {
                    'valid': False,
                    'error': 'Token not configured',
                    'instructions': 'Authorize bot via /auth/twitch/bot/login'
                }
        
        try:
            # Twitch validate endpoint (strip oauth: prefix if present)
            if isinstance(token_to_check, str) and token_to_check.startswith("oauth:"):
                token_to_check = token_to_check.split("oauth:", 1)[1]
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
                    'instructions': 'Update TWITCH_BOT_TOKEN in .env' if use_env_fallback else 'Please re-authorize bot in Admin Panel'
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
                'error': "Internal server error"
            }
    
    async def validate_vk_bot_token(self) -> Dict[str, Any]:
        """
        Р’Р°Р»РёРґРёСЂСѓРµС‚ VK Live bot token.
        
        Returns:
            dict: {
                'valid': bool,
                'error': str (РµСЃР»Рё invalid)
            }
        """
        from repositories.bot_token_repository import BotTokenRepository
        from core.database import db_session
        from core.token_encryption import decrypt_token

        # РџСЂРёРѕСЂРёС‚РµС‚: DB (OAuth bot token)
        vk_token = None
        has_db_token = False
        use_env_fallback = False
        
        # 1. РџС‹С‚Р°РµРјСЃСЏ РїРѕР»СѓС‡РёС‚СЊ РёР· Р‘Р” (BotToken)
        try:
             with db_session() as db:
                  repo = BotTokenRepository(db)
                  bot_token = repo.get_by_platform('vk')
                  if bot_token and bot_token.access_token:
                       try:
                            vk_token = decrypt_token(bot_token.access_token)
                            has_db_token = True
                            logger.info("[BOT TOKEN] Using VK bot token from DB")
                       except Exception as e:
                            logger.error(f"[BOT TOKEN] Failed to decrypt VK token from DB: {e}")
        except Exception as e:
             logger.error(f"[BOT TOKEN] Failed to get VK token from DB: {e}")

        if not vk_token:
            if settings.vk_live_user_token:
                vk_token = settings.vk_live_user_token
                use_env_fallback = True
                logger.warning("[BOT TOKEN] Using legacy VK bot token from .env (no refresh)")
            else:
                logger.error("[ERROR] [BOT TOKEN] VK bot OAuth token not configured")
                return {
                    'valid': False,
                    'error': 'Token not configured',
                    'instructions': 'Authorize VK bot via /auth/vk/bot/login'
                }
        
        try:
            # VK Live validation priorities:
            # 1. Try 'current_user' (Works for User Tokens / Bot auth)
            # 2. Try 'users.get' (Works for App Tokens / Client Credentials)
            
            ssl_verify = settings.is_production
            
            # Check 1: User Token (Preferred)
            async with httpx.AsyncClient(timeout=10.0, verify=ssl_verify) as client:
                response = await client.get(
                    'https://apidev.live.vkvideo.ru/v1/current_user',
                    headers={'Authorization': f'Bearer {vk_token}'}
                )
            
            if response.status_code == 200:
                data = response.json()
                self.vk_token_valid = True
                self.last_vk_check = utcnow_naive()
                logger.info("[OK] [BOT TOKEN] VK Live bot token is VALID (User Token)")
                return {
                    'valid': True,
                    'username': data.get('username'),
                    'user_id': data.get('id'),
                    'type': 'user_token'
                }
            
            elif response.status_code == 401:
                 self.vk_token_valid = False
                 logger.error("=" * 80)
                 logger.error("[ERROR] [BOT TOKEN] VK Live bot token is INVALID or EXPIRED!")
                 logger.error(f"[ERROR] API Response: {response.status_code}")
                 logger.error("=" * 80)

                 # Attempt refresh if OAuth bot token exists
                 if has_db_token:
                      try:
                           from services.vk_bot_oauth_service import vk_bot_oauth_service
                           logger.info("[BOT TOKEN] Attempting VK bot token refresh...")
                           refresh_success = await vk_bot_oauth_service.refresh_bot_token()
                           if refresh_success:
                                logger.info("[BOT TOKEN] VK bot token refreshed, re-validating...")
                                return await self.validate_vk_bot_token()
                      except Exception as refresh_error:
                           logger.error(f"[BOT TOKEN] VK bot token refresh failed: {refresh_error}")

                 return {
                    'valid': False,
                    'error': 'Token invalid or expired',
                    'status_code': 401,
                    'instructions': 'Update VK_LIVE_USER_TOKEN in .env' if use_env_fallback else 'Re-authorize VK bot'
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
            import traceback
            logger.error(traceback.format_exc())
            return {
                'valid': False,
                'error': "Internal server error"
            }
    
    async def validate_all_tokens(self) -> Dict[str, Dict[str, Any]]:
        """
        Р’Р°Р»РёРґРёСЂСѓРµС‚ РІСЃРµ С‚РѕРєРµРЅС‹ Р±РѕС‚РѕРІ.
        
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
        
        # РЎРІРѕРґРєР°
        logger.info("=" * 80)
        logger.info("[BOT TOKEN] Validation Summary:")
        logger.info(f"  Twitch: {'[VALID]' if results['twitch']['valid'] else '[INVALID]'}")
        logger.info(f"  VK Live: {'[VALID]' if results['vk']['valid'] else '[INVALID] (optional)' if results['vk'].get('optional') else '[INVALID]'}")
        logger.info("=" * 80)
        
        return results
    
    async def start_monitoring(self, check_interval: int = 3600):
        """
        Р—Р°РїСѓСЃРєР°РµС‚ РїРµСЂРёРѕРґРёС‡РµСЃРєРёР№ РјРѕРЅРёС‚РѕСЂРёРЅРі С‚РѕРєРµРЅРѕРІ.
        
        Args:
            check_interval: РРЅС‚РµСЂРІР°Р» РїСЂРѕРІРµСЂРєРё РІ СЃРµРєСѓРЅРґР°С… (РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ 1 С‡Р°СЃ)
        """
        if self._monitoring_task and not self._monitoring_task.done():
            logger.warning("[BOT TOKEN] Monitoring already running")
            return
        
        logger.info(f"[BOT TOKEN] Starting token monitoring (interval: {check_interval}s)")
        self._monitoring_task = asyncio.create_task(self._monitoring_loop(check_interval))
    
    async def stop_monitoring(self):
        """РћСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ РјРѕРЅРёС‚РѕСЂРёРЅРі С‚РѕРєРµРЅРѕРІ"""
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
            logger.info("[BOT TOKEN] Monitoring stopped")
    
    async def _monitoring_loop(self, interval: int):
        """Р¦РёРєР» РјРѕРЅРёС‚РѕСЂРёРЅРіР° С‚РѕРєРµРЅРѕРІ"""
        while True:
            try:
                await asyncio.sleep(interval)
                
                logger.info("[BOT TOKEN] Periodic token validation...")
                results = await self.validate_all_tokens()
                
                # Р•СЃР»Рё С‚РѕРєРµРЅ СЃС‚Р°Р» РЅРµРІР°Р»РёРґРЅС‹Рј - Р»РѕРіРёСЂСѓРµРј РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёРµ
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
        РџРѕР»СѓС‡РёС‚СЊ С‚РµРєСѓС‰РёР№ СЃС‚Р°С‚СѓСЃ С‚РѕРєРµРЅРѕРІ.
        
        Returns:
            dict: РЎС‚Р°С‚СѓСЃ РІСЃРµС… С‚РѕРєРµРЅРѕРІ
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


# Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ СЌРєР·РµРјРїР»СЏСЂ
bot_token_validator = BotTokenValidator()
