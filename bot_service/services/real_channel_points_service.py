# bot_service/services/real_channel_points_service.py
import logging
from typing import List, Optional, Dict, Any
import httpx
import os
from api.vk_api import VKLiveAPI
from api.twitch_api import TwitchAPI

logger = logging.getLogger('bot_service')

class RealChannelPointsService:
    """
    Сервис для работы с реальными баллами канала Twitch и VK Live
    Использует официальные API для получения балансов и создания наград
    """
    
    def __init__(self):
        self.vk_api = VKLiveAPI()
        self.twitch_api = TwitchAPI()
    
    # === VK LIVE CHANNEL POINTS ===
    
    async def get_vk_channel_points_balance(self, user_id: int, channel_url: str) -> Dict[str, Any]:
        """Получить баланс баллов канала VK Live для пользователя"""
        try:
            # Получаем токен пользователя
            from core.database import get_db, UserToken
            db = next(get_db())
            
            try:
                user_token = db.query(UserToken).filter(
                    UserToken.user_id == user_id,
                    UserToken.platform == 'vk'
                ).first()
                
                if not user_token:
                    return {'success': False, 'error': 'VK токен не найден'}
                
                # Используем VK Live API для получения баланса
                balance_info = await self.vk_api.get_channel_points_balance(
                    channel_url, user_token.access_token
                )
                
                if balance_info:
                    return {
                        'success': True,
                        'balance': balance_info.get('balance', {}).get('amount', 0),
                        'is_infinite': balance_info.get('balance', {}).get('is_infinite', False),
                        'point_info': balance_info.get('point', {})
                    }
                else:
                    return {'success': False, 'error': 'Не удалось получить баланс'}
                    
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error getting VK channel points balance: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_vk_channel_rewards(self, user_id: int, channel_url: str) -> Dict[str, Any]:
        """Получить список наград VK Live канала"""
        try:
            from core.database import get_db, UserToken
            db = next(get_db())
            
            try:
                user_token = db.query(UserToken).filter(
                    UserToken.user_id == user_id,
                    UserToken.platform == 'vk'
                ).first()
                
                if not user_token:
                    return {'success': False, 'error': 'VK токен не найден'}
                
                # Получаем список наград
                rewards = await self.vk_api.get_channel_rewards(
                    channel_url, user_token.access_token
                )
                
                return {
                    'success': True,
                    'rewards': rewards or []
                }
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error getting VK channel rewards: {e}")
            return {'success': False, 'error': str(e)}
    
    async def create_vk_channel_reward(
        self, 
        user_id: int, 
        channel_url: str, 
        reward_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Создать награду VK Live канала"""
        try:
            from core.database import get_db, UserToken
            db = next(get_db())
            
            try:
                user_token = db.query(UserToken).filter(
                    UserToken.user_id == user_id,
                    UserToken.platform == 'vk'
                ).first()
                
                if not user_token:
                    return {'success': False, 'error': 'VK токен не найден'}
                
                # Создаем награду через VK API
                result = await self.vk_api.create_channel_reward(
                    channel_url, user_token.access_token, reward_data
                )
                
                return {
                    'success': True,
                    'reward_id': result.get('reward', {}).get('id') if result else None
                }
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error creating VK channel reward: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_vk_reward_demands(self, user_id: int, channel_url: str, limit: int = 20, offset: int = 0) -> Dict[str, Any]:
        """Получить список запросов наград VK Live"""
        try:
            from core.database import get_db, UserToken
            db = next(get_db())
            
            try:
                user_token = db.query(UserToken).filter(
                    UserToken.user_id == user_id,
                    UserToken.platform == 'vk'
                ).first()
                
                if not user_token:
                    return {'success': False, 'error': 'VK токен не найден'}
                
                demands = await self.vk_api.get_reward_demands(
                    channel_url, user_token.access_token, limit, offset
                )
                
                return {
                    'success': True,
                    'demands': demands.get('demands', []) if demands else [],
                    'is_last': demands.get('extra', {}).get('is_last', True) if demands else True
                }
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error getting VK reward demands: {e}")
            return {'success': False, 'error': str(e)}
    
    async def process_vk_reward_demand(
        self, 
        user_id: int, 
        channel_url: str, 
        demand_ids: List[int], 
        action: str
    ) -> Dict[str, Any]:
        """Обработать запрос награды VK Live (принять/отклонить)"""
        try:
            from core.database import get_db, UserToken
            db = next(get_db())
            
            try:
                user_token = db.query(UserToken).filter(
                    UserToken.user_id == user_id,
                    UserToken.platform == 'vk'
                ).first()
                
                if not user_token:
                    return {'success': False, 'error': 'VK токен не найден'}
                
                if action == 'accept':
                    result = await self.vk_api.accept_reward_demands(
                        channel_url, user_token.access_token, demand_ids
                    )
                elif action == 'reject':
                    result = await self.vk_api.reject_reward_demands(
                        channel_url, user_token.access_token, demand_ids
                    )
                else:
                    return {'success': False, 'error': 'Неверное действие'}
                
                return {'success': True}
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error processing VK reward demand: {e}")
            return {'success': False, 'error': str(e)}
    
    # === TWITCH CHANNEL POINTS ===
    
    async def get_twitch_custom_rewards(self, user_id: int, broadcaster_id: str) -> Dict[str, Any]:
        """Получить кастомные награды Twitch канала"""
        try:
            from core.database import get_db, UserToken
            db = next(get_db())
            
            try:
                user_token = db.query(UserToken).filter(
                    UserToken.user_id == user_id,
                    UserToken.platform == 'twitch'
                ).first()
                
                if not user_token:
                    return {'success': False, 'error': 'Twitch токен не найден'}
                
                # Используем Twitch API для получения кастомных наград
                rewards = await self.twitch_api.get_custom_rewards(
                    broadcaster_id, user_token.access_token
                )
                
                return {
                    'success': True,
                    'rewards': rewards or []
                }
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error getting Twitch custom rewards: {e}")
            return {'success': False, 'error': str(e)}
    
    async def create_twitch_custom_reward(
        self, 
        user_id: int, 
        broadcaster_id: str, 
        reward_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Создать кастомную награду Twitch"""
        try:
            from core.database import get_db, UserToken
            db = next(get_db())
            
            try:
                user_token = db.query(UserToken).filter(
                    UserToken.user_id == user_id,
                    UserToken.platform == 'twitch'
                ).first()
                
                if not user_token:
                    return {'success': False, 'error': 'Twitch токен не найден'}
                
                # Создаем награду через Twitch API
                result = await self.twitch_api.create_custom_reward(
                    broadcaster_id, user_token.access_token, reward_data
                )
                
                return {
                    'success': True,
                    'reward': result.get('data', [{}])[0] if result else None
                }
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error creating Twitch custom reward: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_twitch_reward_redemptions(
        self, 
        user_id: int, 
        broadcaster_id: str, 
        reward_id: str = None, 
        status: str = 'UNFULFILLED'
    ) -> Dict[str, Any]:
        """Получить обмены наград Twitch"""
        try:
            from core.database import get_db, UserToken
            db = next(get_db())
            
            try:
                user_token = db.query(UserToken).filter(
                    UserToken.user_id == user_id,
                    UserToken.platform == 'twitch'
                ).first()
                
                if not user_token:
                    return {'success': False, 'error': 'Twitch токен не найден'}
                
                redemptions = await self.twitch_api.get_custom_reward_redemptions(
                    broadcaster_id, user_token.access_token, reward_id, status
                )
                
                return {
                    'success': True,
                    'redemptions': redemptions.get('data', []) if redemptions else []
                }
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error getting Twitch reward redemptions: {e}")
            return {'success': False, 'error': str(e)}
    
    async def update_twitch_redemption_status(
        self, 
        user_id: int, 
        broadcaster_id: str, 
        reward_id: str, 
        redemption_ids: List[str], 
        status: str
    ) -> Dict[str, Any]:
        """Обновить статус обмена награды Twitch"""
        try:
            from core.database import get_db, UserToken
            db = next(get_db())
            
            try:
                user_token = db.query(UserToken).filter(
                    UserToken.user_id == user_id,
                    UserToken.platform == 'twitch'
                ).first()
                
                if not user_token:
                    return {'success': False, 'error': 'Twitch токен не найден'}
                
                result = await self.twitch_api.update_redemption_status(
                    broadcaster_id, user_token.access_token, reward_id, redemption_ids, status
                )
                
                return {'success': True}
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error updating Twitch redemption status: {e}")
            return {'success': False, 'error': str(e)}
