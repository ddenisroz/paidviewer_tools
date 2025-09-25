"""
Модуль для отключения ботов от каналов пользователей
"""
import logging
import aiohttp

logger = logging.getLogger(__name__)

async def _get_vk_channel_url(vk_integration: dict, unified_user_id: int) -> str:
    """Получает channel_url из VK Live API для пользователя"""
    try:
        # Получаем токен из базы данных по unified_user_id
        from core.session_manager import session_manager
        tokens = session_manager.get_user_tokens(unified_user_id, "vk")
        if not tokens or not tokens.get("access_token"):
            logger.warning(f"No VK access token found for unified user {unified_user_id}")
            return None
            
        # Получаем информацию о пользователе из VK API
        async with aiohttp.ClientSession() as session:
            endpoint = "https://apidev.live.vkvideo.ru/v1/current_user"
            headers = {"Authorization": f"Bearer {tokens['access_token']}"}
            
            async with session.get(endpoint, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if isinstance(data, dict) and "data" in data:
                        channel_url = data["data"].get("channel", {}).get("url")
                        if channel_url:
                            logger.info(f"Retrieved VK channel URL: {channel_url}")
                            return channel_url
                        else:
                            logger.warning("No channel URL found in VK API response")
                    else:
                        logger.warning("Invalid VK API response format")
                else:
                    logger.warning(f"VK API returned status {response.status}")
                    
    except Exception as e:
        logger.error(f"Error getting VK channel URL: {e}")
        
    return None

async def disconnect_user_bots(user_data: dict, bot_instance=None, vk_live_bot_instance=None):
    """Отключает ботов от каналов пользователя при logout"""
    logger.info(f"Starting bot disconnection for user: {user_data}")
    try:
        # Отключаем Twitch бота
        if bot_instance and user_data.get("integrations", {}).get("twitch"):
            twitch_username = user_data["integrations"]["twitch"].get("display_name")
            if twitch_username:
                success = await bot_instance.leave_channel(twitch_username)
                if success:
                    logger.info(f"Twitch bot disconnected from {twitch_username} on logout")
                else:
                    logger.warning(f"Failed to disconnect Twitch bot from {twitch_username} on logout")
        
        # Отключаем VK Live бота
        logger.info(f"VK Live bot instance: {vk_live_bot_instance is not None}")
        logger.info(f"VK integration data: {user_data.get('integrations', {}).get('vk')}")
        if vk_live_bot_instance and user_data.get("integrations", {}).get("vk"):
            logger.info("Attempting to disconnect VK Live bot...")
            # Получаем channel_url из VK API для правильного отключения
            vk_channel = await _get_vk_channel_url(user_data["integrations"]["vk"], user_data["id"])
            logger.info(f"Retrieved VK channel: {vk_channel}")
            if vk_channel:
                # Сначала отключаемся от канала
                await vk_live_bot_instance.leave_channel(vk_channel)
                # Затем полностью останавливаем бота
                await vk_live_bot_instance.stop_bot()
                logger.info(f"VK Live bot disconnected and stopped from {vk_channel} on logout")
            else:
                logger.warning("Could not get VK Live channel URL for bot disconnection")
        else:
            logger.warning("VK Live bot instance not available or no VK integration found")
                    
    except Exception as e:
        logger.error(f"Error disconnecting user bots on logout: {e}")
