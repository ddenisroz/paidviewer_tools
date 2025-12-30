# bot_service/services/real_channel_points_service.py
"""Сервис для работы с реальными баллами канала Twitch и VK Live"""
import logging
from typing import List, Dict, Any, Callable, TypeVar
from functools import wraps

from api.vk_api import VKLiveAPI
from api.twitch_api import TwitchAPI
from core.database import db_session, UserToken

logger = logging.getLogger('bot_service')

T = TypeVar('T')


def with_platform_token(platform: str):
    """
    Декоратор для методов, требующих токен платформы.
    Автоматически получает токен и обрабатывает ошибки.
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(self, user_id: int, *args, **kwargs) -> Dict[str, Any]:
            try:
                with db_session() as db:
                    user_token = db.query(UserToken).filter(
                        UserToken.user_id == user_id,
                        UserToken.platform == platform
                    ).first()

                    if not user_token:
                        platform_name = 'VK' if platform == 'vk' else 'Twitch'
                        return {'success': False, 'error': f'{platform_name} токен не найден'}

                    # Передаем access_token в функцию
                    return await func(self, user_id, user_token.access_token, *args, **kwargs)
            except Exception as e:
                logger.error(f"Error in {func.__name__}: {e}")
                return {'success': False, 'error': str(e)}
        return wrapper
    return decorator


class RealChannelPointsService:
    """
    Сервис для работы с реальными баллами канала Twitch и VK Live.
    Использует официальные API для получения балансов и создания наград.
    """

    def __init__(self):
        self.vk_api = VKLiveAPI()
        from core.connection_manager import get_connection_manager
        connection_manager = get_connection_manager()
        self.twitch_api = TwitchAPI(connection_manager)

    # === VK LIVE CHANNEL POINTS ===

    @with_platform_token('vk')
    async def get_vk_channel_points_balance(
        self, user_id: int, access_token: str, channel_url: str
    ) -> Dict[str, Any]:
        """Получить баланс баллов канала VK Live для пользователя"""
        balance_info = await self.vk_api.get_channel_points_balance(channel_url, access_token)

        if not balance_info:
            return {'success': False, 'error': 'Не удалось получить баланс'}

        return {
            'success': True,
            'balance': balance_info.get('balance', {}).get('amount', 0),
            'is_infinite': balance_info.get('balance', {}).get('is_infinite', False),
            'point_info': balance_info.get('point', {})
        }

    @with_platform_token('vk')
    async def get_vk_channel_rewards(
        self, user_id: int, access_token: str, channel_url: str
    ) -> Dict[str, Any]:
        """Получить список наград VK Live канала"""
        rewards = await self.vk_api.get_channel_rewards(channel_url, access_token)
        return {'success': True, 'rewards': rewards or []}

    @with_platform_token('vk')
    async def create_vk_channel_reward(
        self, user_id: int, access_token: str, channel_url: str, reward_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Создать награду VK Live канала"""
        result = await self.vk_api.create_channel_reward(channel_url, access_token, reward_data)
        return {
            'success': True,
            'reward_id': result.get('reward', {}).get('id') if result else None
        }

    @with_platform_token('vk')
    async def get_vk_reward_demands(
        self, user_id: int, access_token: str, channel_url: str, limit: int = 20, offset: int = 0
    ) -> Dict[str, Any]:
        """Получить список запросов наград VK Live"""
        demands = await self.vk_api.get_reward_demands(channel_url, access_token, limit, offset)
        return {
            'success': True,
            'demands': demands.get('demands', []) if demands else [],
            'is_last': demands.get('extra', {}).get('is_last', True) if demands else True
        }

    @with_platform_token('vk')
    async def process_vk_reward_demand(
        self, user_id: int, access_token: str, channel_url: str,
        demand_ids: List[int], action: str
    ) -> Dict[str, Any]:
        """Обработать запрос награды VK Live (принять/отклонить)"""
        actions = {
            'accept': self.vk_api.accept_reward_demands,
            'reject': self.vk_api.reject_reward_demands
        }

        handler = actions.get(action)
        if not handler:
            return {'success': False, 'error': 'Неверное действие'}

        await handler(channel_url, access_token, demand_ids)
        return {'success': True}

    # === TWITCH CHANNEL POINTS ===

    @with_platform_token('twitch')
    async def get_twitch_custom_rewards(
        self, user_id: int, access_token: str, broadcaster_id: str
    ) -> Dict[str, Any]:
        """Получить кастомные награды Twitch канала"""
        rewards = await self.twitch_api.get_custom_rewards(broadcaster_id, access_token)
        return {'success': True, 'rewards': rewards or []}

    @with_platform_token('twitch')
    async def create_twitch_custom_reward(
        self, user_id: int, access_token: str, broadcaster_id: str, reward_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Создать кастомную награду Twitch"""
        result = await self.twitch_api.create_custom_reward(broadcaster_id, access_token, reward_data)
        return {
            'success': True,
            'reward': result.get('data', [{}])[0] if result else None
        }

    @with_platform_token('twitch')
    async def get_twitch_reward_redemptions(
        self, user_id: int, access_token: str, broadcaster_id: str,
        reward_id: str = None, status: str = 'UNFULFILLED'
    ) -> Dict[str, Any]:
        """Получить обмены наград Twitch"""
        redemptions = await self.twitch_api.get_custom_reward_redemptions(
            broadcaster_id, access_token, reward_id, status
        )
        return {
            'success': True,
            'redemptions': redemptions.get('data', []) if redemptions else []
        }

    @with_platform_token('twitch')
    async def update_twitch_redemption_status(
        self, user_id: int, access_token: str, broadcaster_id: str,
        reward_id: str, redemption_ids: List[str], status: str
    ) -> Dict[str, Any]:
        """Обновить статус обмена награды Twitch"""
        await self.twitch_api.update_redemption_status(
            broadcaster_id, access_token, reward_id, redemption_ids, status
        )
        return {'success': True}
