# bot_service/integrations/drops_integration.py
"""
Интеграция системы дропов с виджетами
"""
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from core.database import get_db, User
from websocket_handlers import send_lootbox_opened, send_chat_message
from api.drops_triggers import check_trigger_condition

class DropsIntegration:
    def __init__(self):
        self.user_streaks = {}  # {user_id: {'last_seen': datetime, 'streak_days': int}}
        self.user_message_counts = {}  # {user_id: {'count': int, 'last_reset': datetime}}
    
    async def handle_donation(self, user_id: str, username: str, amount: float, message: str = ""):
        """Обработка доната"""
        event_data = {
            "username": username,
            "amount": amount,
            "message": message,
            "event_type": "donation"
        }
        
        # Проверяем триггеры
        await self._check_triggers(user_id, event_data)
        
        # Отправляем сообщение в чат
        await send_chat_message(
            username="Система",
            message=f"Спасибо {username} за донат {amount}₽!",
            role="system",
            user_id=user_id
        )
    
    async def handle_stream_attendance(self, user_id: str, username: str):
        """Обработка присутствия на стриме"""
        now = datetime.now()
        
        if user_id not in self.user_streaks:
            self.user_streaks[user_id] = {
                'last_seen': now,
                'streak_days': 1
            }
        else:
            last_seen = self.user_streaks[user_id]['last_seen']
            if now.date() > last_seen.date():
                # Новый день
                if (now.date() - last_seen.date()).days == 1:
                    # Последовательный день
                    self.user_streaks[user_id]['streak_days'] += 1
                else:
                    # Пропуск дней, сброс стрика
                    self.user_streaks[user_id]['streak_days'] = 1
                
                self.user_streaks[user_id]['last_seen'] = now
        
        streak_days = self.user_streaks[user_id]['streak_days']
        
        event_data = {
            "username": username,
            "streak_days": streak_days,
            "event_type": "attendance"
        }
        
        # Проверяем триггеры
        await self._check_triggers(user_id, event_data)
        
        # Уведомление о стрике
        if streak_days in [7, 14, 30, 60, 100]:
            await send_chat_message(
                username="Система",
                message=f"🎉 {username} достиг стрика {streak_days} дней!",
                role="system",
                user_id=user_id
            )
    
    async def handle_message(self, user_id: str, username: str, message: str, platform: str = "twitch"):
        """Обработка сообщения в чате"""
        now = datetime.now()
        
        if user_id not in self.user_message_counts:
            self.user_message_counts[user_id] = {
                'count': 0,
                'last_reset': now
            }
        
        # Сбрасываем счетчик в начале дня
        if now.date() > self.user_message_counts[user_id]['last_reset'].date():
            self.user_message_counts[user_id]['count'] = 0
            self.user_message_counts[user_id]['last_reset'] = now
        
        self.user_message_counts[user_id]['count'] += 1
        
        message_count = self.user_message_counts[user_id]['count']
        
        event_data = {
            "username": username,
            "message_count": message_count,
            "platform": platform,
            "event_type": "message"
        }
        
        # Проверяем триггеры
        await self._check_triggers(user_id, event_data)
        
        # Уведомления о рекордах
        if message_count in [50, 100, 200, 500, 1000]:
            await send_chat_message(
                username="Система",
                message=f"📝 {username} написал {message_count} сообщений сегодня!",
                role="system",
                user_id=user_id
            )
    
    async def handle_subscription(self, user_id: str, username: str, tier: str, is_resub: bool = False):
        """Обработка подписки"""
        event_data = {
            "username": username,
            "tier": tier,
            "is_resub": is_resub,
            "event_type": "subscription"
        }
        
        # Проверяем триггеры
        await self._check_triggers(user_id, event_data)
        
        # Отправляем сообщение в чат
        sub_type = "ресаб" if is_resub else "подписку"
        await send_chat_message(
            username="Система",
            message=f"🎉 Спасибо {username} за {sub_type} {tier} уровня!",
            role="system",
            user_id=user_id
        )
    
    async def handle_follow(self, user_id: str, username: str):
        """Обработка подписки на канал"""
        event_data = {
            "username": username,
            "event_type": "follow"
        }
        
        # Проверяем триггеры
        await self._check_triggers(user_id, event_data)
        
        # Отправляем сообщение в чат
        await send_chat_message(
            username="Система",
            message=f"👋 Добро пожаловать, {username}!",
            role="system",
            user_id=user_id
        )
    
    async def _check_triggers(self, user_id: str, event_data: Dict[str, Any]):
        """Проверка триггеров для события"""
        try:
            # Импортируем здесь, чтобы избежать циклических импортов
            from api.drops_triggers import user_drop_triggers
            
            if user_id not in user_drop_triggers:
                return
            
            triggered_triggers = []
            
            for trigger_id, trigger in user_drop_triggers[user_id].items():
                if not trigger.get("enabled", True):
                    continue
                
                if check_trigger_condition(trigger, event_data):
                    # Триггер сработал
                    await send_lootbox_opened(
                        username=event_data.get("username", "Пользователь"),
                        rarity=trigger["rarity"],
                        reward=trigger["reward"].get("name", "Награда"),
                        user_id=user_id
                    )
                    
                    triggered_triggers.append(trigger_id)
            
            if triggered_triggers:
                print(f"Triggered {len(triggered_triggers)} triggers for user {user_id}")
                
        except Exception as e:
            print(f"Error checking triggers: {e}")
    
    def get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """Получить статистику пользователя"""
        streak_info = self.user_streaks.get(user_id, {'streak_days': 0, 'last_seen': None})
        message_info = self.user_message_counts.get(user_id, {'count': 0, 'last_reset': None})
        
        return {
            "streak_days": streak_info['streak_days'],
            "messages_today": message_info['count'],
            "last_seen": streak_info['last_seen'].isoformat() if streak_info['last_seen'] else None,
            "last_message_reset": message_info['last_reset'].isoformat() if message_info['last_reset'] else None
        }
    
    def reset_daily_stats(self):
        """Сброс дневной статистики (вызывать в начале дня)"""
        now = datetime.now()
        for user_id in self.user_message_counts:
            self.user_message_counts[user_id]['count'] = 0
            self.user_message_counts[user_id]['last_reset'] = now

# Глобальный экземпляр
drops_integration = DropsIntegration()

# Функции для использования в других частях приложения
async def handle_donation_event(user_id: str, username: str, amount: float, message: str = ""):
    """Обработка события доната"""
    await drops_integration.handle_donation(user_id, username, amount, message)

async def handle_attendance_event(user_id: str, username: str):
    """Обработка события присутствия на стриме"""
    await drops_integration.handle_stream_attendance(user_id, username)

async def handle_message_event(user_id: str, username: str, message: str, platform: str = "twitch"):
    """Обработка события сообщения"""
    await drops_integration.handle_message(user_id, username, message, platform)

async def handle_subscription_event(user_id: str, username: str, tier: str, is_resub: bool = False):
    """Обработка события подписки"""
    await drops_integration.handle_subscription(user_id, username, tier, is_resub)

async def handle_follow_event(user_id: str, username: str):
    """Обработка события подписки на канал"""
    await drops_integration.handle_follow(user_id, username)

def get_user_drops_stats(user_id: str) -> Dict[str, Any]:
    """Получить статистику дропов пользователя"""
    return drops_integration.get_user_stats(user_id)
