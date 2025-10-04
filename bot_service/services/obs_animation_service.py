# services/obs_animation_service.py
import logging
import json
import asyncio
from typing import Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class OBSAnimationService:
    """Сервис для управления анимациями в OBS"""
    
    def __init__(self, connection_manager):
        self.connection_manager = connection_manager
    
    async def trigger_lootbox_animation(self, channel_name: str, opening_data: Dict):
        """Запускает анимацию открытия лутбокса в OBS"""
        try:
            animation_data = {
                "type": "lootbox_opening",
                "channel": channel_name,
                "data": {
                    "opening_id": opening_data["opening_id"],
                    "lootbox_name": opening_data["lootbox_name"],
                    "reward": opening_data["reward"],
                    "user_name": opening_data.get("user_name", "Unknown"),
                    "timestamp": opening_data["opened_at"]
                }
            }
            
            # Отправляем в OBS через WebSocket
            await self.connection_manager.send_obs_message(
                message=json.dumps(animation_data),
                token=f"lootbox_{channel_name}"  # Токен для лутбокс анимаций
            )
            
            logger.info(f"Lootbox animation triggered for channel {channel_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error triggering lootbox animation: {e}")
            return False
    
    async def trigger_achievement_animation(self, channel_name: str, achievement_data: Dict):
        """Запускает анимацию получения достижения в OBS"""
        try:
            animation_data = {
                "type": "achievement_unlocked",
                "channel": channel_name,
                "data": {
                    "achievement_name": achievement_data["name"],
                    "achievement_description": achievement_data["description"],
                    "user_name": achievement_data.get("user_name", "Unknown"),
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
            
            # Отправляем в OBS через WebSocket
            await self.connection_manager.send_obs_message(
                message=json.dumps(animation_data),
                token=f"achievement_{channel_name}"  # Токен для анимаций достижений
            )
            
            logger.info(f"Achievement animation triggered for channel {channel_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error triggering achievement animation: {e}")
            return False
    
    async def trigger_donation_animation(self, channel_name: str, donation_data: Dict):
        """Запускает анимацию доната в OBS"""
        try:
            animation_data = {
                "type": "donation_received",
                "channel": channel_name,
                "data": {
                    "amount": donation_data["amount"],
                    "currency": donation_data["currency"],
                    "message": donation_data.get("message", ""),
                    "user_name": donation_data.get("user_name", "Anonymous"),
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
            
            # Отправляем в OBS через WebSocket
            await self.connection_manager.send_obs_message(
                message=json.dumps(animation_data),
                token=f"donation_{channel_name}"  # Токен для анимаций донатов
            )
            
            logger.info(f"Donation animation triggered for channel {channel_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error triggering donation animation: {e}")
            return False
    
    def get_obs_integration_url(self, channel_name: str, animation_type: str) -> str:
        """Возвращает URL для интеграции с OBS"""
        base_url = "ws://localhost:8000/ws/obs"
        
        if animation_type == "lootbox":
            token = f"lootbox_{channel_name}"
        elif animation_type == "achievement":
            token = f"achievement_{channel_name}"
        elif animation_type == "donation":
            token = f"donation_{channel_name}"
        else:
            token = f"general_{channel_name}"
        
        return f"{base_url}/{token}"
    
    def get_obs_script_template(self, channel_name: str) -> str:
        """Возвращает шаблон скрипта для OBS"""
        return f"""
-- OBS Lua Script для анимаций лутбоксов
-- Вставьте этот код в OBS Scripts

local obs = obslua
local websocket = nil
local channel_name = "{channel_name}"

function script_properties()
    local props = obs.obs_properties_create()
    obs.obs_properties_add_text(props, "channel_name", "Channel Name", obs.OBS_TEXT_DEFAULT)
    obs.obs_properties_add_text(props, "websocket_url", "WebSocket URL", obs.OBS_TEXT_DEFAULT)
    return props
end

function script_defaults(settings)
    obs.obs_data_set_default_string(settings, "channel_name", channel_name)
    obs.obs_data_set_default_string(settings, "websocket_url", "ws://localhost:8000/ws/obs/lootbox_" .. channel_name)
end

function script_update(settings)
    channel_name = obs.obs_data_get_string(settings, "channel_name")
    local url = obs.obs_data_get_string(settings, "websocket_url")
    
    if websocket then
        websocket:close()
    end
    
    websocket = require("websocket").client()
    websocket:on("message", function(message)
        local data = json.decode(message)
        handle_animation(data)
    end)
    
    websocket:connect(url)
end

function handle_animation(data)
    if data.type == "lootbox_opening" then
        -- Анимация открытия лутбокса
        local reward = data.data.reward
        print("🎁 Lootbox opened: " .. reward.name)
        
        -- Здесь добавьте код для показа анимации в OBS
        -- Например, изменение текста источника или запуск анимации
        
    elseif data.type == "achievement_unlocked" then
        -- Анимация достижения
        local achievement = data.data
        print("🏆 Achievement unlocked: " .. achievement.achievement_name)
        
    elseif data.type == "donation_received" then
        -- Анимация доната
        local donation = data.data
        print("💰 Donation received: " .. donation.amount .. " " .. donation.currency)
    end
end

function script_unload()
    if websocket then
        websocket:close()
    end
end
"""
