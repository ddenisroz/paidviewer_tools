# bot_service/admin_api.py
import logging
import os
import glob
from typing import List
from datetime import datetime
from sqlalchemy.orm import Session
from core.database import User, WhitelistedChannel, BlockedBot
from models.pydantic_models import (
    WhitelistedChannelPublic, 
    AddToWhitelistRequest, 
    WhitelistResponse,
    BlockedBotPublic,
    AddBlockedBotRequest,
    UserPublic
)

logger = logging.getLogger(__name__)

class AdminAPI:
    def __init__(self):
        pass

    async def get_whitelist(self, db: Session) -> WhitelistResponse:
        """Получить список пользователей в whitelist"""
        whitelist_users = db.query(WhitelistedChannel).all()
        return WhitelistResponse(
            whitelist_users=[WhitelistedChannelPublic.from_orm(user) for user in whitelist_users]
        )

    async def add_to_whitelist(self, request: AddToWhitelistRequest, db: Session) -> dict:
        """Добавить пользователя в whitelist"""
        username = request.username.lower()
        
        # Проверяем, не добавлен ли уже
        existing = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == username
        ).first()
        
        if existing:
            logger.warning(f"⚠️ WHITELIST: Попытка добавить уже существующий канал '{username}'")
            return {"message": f"User {username} is already in whitelist"}
        
        # Добавляем в whitelist
        whitelist_user = WhitelistedChannel(
            channel_name=username
        )
        db.add(whitelist_user)
        db.commit()
        
        logger.info(f"✅ WHITELIST: Канал '{username}' добавлен в белый список")
        return {"message": f"User {username} added to whitelist"}

    async def remove_from_whitelist(self, request: AddToWhitelistRequest, db: Session) -> dict:
        """Удалить пользователя из whitelist"""
        username = request.username.lower()
        
        whitelist_user = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == username
        ).first()
        
        if not whitelist_user:
            logger.warning(f"⚠️ WHITELIST: Попытка удалить несуществующий канал '{username}'")
            return {"message": f"User {username} not found in whitelist"}
        
        db.delete(whitelist_user)
        db.commit()
        
        logger.info(f"🗑️ WHITELIST: Канал '{username}' удален из белого списка")
        return {"message": f"User {username} removed from whitelist"}

    async def get_blocked_bots(self, db: Session) -> List[BlockedBotPublic]:
        """Получить список заблокированных ботов"""
        blocked_bots = db.query(BlockedBot).all()
        return [BlockedBotPublic.from_orm(bot) for bot in blocked_bots]

    async def add_blocked_bot(self, request: AddBlockedBotRequest, db: Session) -> dict:
        """Добавить бота в список заблокированных"""
        bot_name = request.bot_name.lower()
        
        # Проверяем, не заблокирован ли уже
        existing = db.query(BlockedBot).filter(
            BlockedBot.bot_name == bot_name
        ).first()
        
        if existing:
            return {"message": f"Bot {bot_name} is already blocked"}
        
        # Добавляем в список заблокированных
        blocked_bot = BlockedBot(bot_name=bot_name)
        db.add(blocked_bot)
        db.commit()
        
        logger.info(f"Bot {bot_name} added to blocked list")
        return {"message": f"Bot {bot_name} added to blocked list"}

    async def remove_blocked_bot(self, bot_name: str, db: Session) -> dict:
        """Удалить бота из списка заблокированных"""
        bot_name = bot_name.lower()
        
        blocked_bot = db.query(BlockedBot).filter(
            BlockedBot.bot_name == bot_name
        ).first()
        
        if not blocked_bot:
            return {"message": f"Bot {bot_name} not found in blocked list"}
        
        db.delete(blocked_bot)
        db.commit()
        
        logger.info(f"Bot {bot_name} removed from blocked list")
        return {"message": f"Bot {bot_name} removed from blocked list"}

    async def get_users(self, db: Session) -> List[UserPublic]:
        """Получить список всех пользователей"""
        users = db.query(User).all()
        return [UserPublic.from_orm(user) for user in users]

    async def update_user(self, user_id: int, request: dict, db: Session) -> dict:
        """Обновить пользователя"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": "User not found"}
        
        # Обновляем поля
        if 'display_name' in request:
            user.display_name = request['display_name']
        if 'is_admin' in request:
            user.is_admin = request['is_admin']
        
        db.commit()
        
        logger.info(f"User {user_id} updated")
        return {"message": f"User {user_id} updated successfully"}

    async def delete_user(self, user_id: int, db: Session) -> dict:
        """Удалить пользователя"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": "User not found"}
        
        # Нельзя удалить самого себя
        # Это будет проверяться в endpoint
        
        db.delete(user)
        db.commit()
        
        logger.info(f"User {user_id} deleted")
        return {"message": f"User {user_id} deleted successfully"}

    async def block_user(self, user_id: int, request: dict, db: Session) -> dict:
        """Заблокировать пользователя"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": "User not found"}
        
        reason = request.get('reason', 'Blocked by administrator')
        
        user.is_blocked = True
        user.blocked_reason = reason
        user.blocked_at = datetime.utcnow()
        
        db.commit()
        
        logger.info(f"User {user_id} blocked: {reason}")
        return {"message": f"User {user_id} blocked successfully"}

    async def unblock_user(self, user_id: int, db: Session) -> dict:
        """Разблокировать пользователя"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": "User not found"}
        
        user.is_blocked = False
        user.blocked_reason = None
        user.blocked_at = None
        
        db.commit()
        
        logger.info(f"User {user_id} unblocked")
        return {"message": f"User {user_id} unblocked successfully"}

    async def get_bots_status(self) -> dict:
        """Получить статус всех ботов"""
        # Здесь можно добавить проверку статуса ботов через connection_manager
        # Пока возвращаем базовую информацию
        return {
            "bots": [
                {
                    "name": "twitch_bot",
                    "status": "running",  # running, stopped, error
                    "last_activity": datetime.utcnow().isoformat(),
                    "platform": "twitch"
                },
                {
                    "name": "vk_live_bot", 
                    "status": "running",
                    "last_activity": datetime.utcnow().isoformat(),
                    "platform": "vk_live"
                }
            ]
        }

    async def restart_bot(self, bot_name: str) -> dict:
        """Перезапустить бота"""
        try:
            # Импортируем глобальные переменные из main
            import sys
            import os
            sys.path.append(os.path.dirname(os.path.dirname(__file__)))
            from main import bot_instance, bot_task, vk_live_bot_instance, vk_live_bot_task
            import asyncio
            
            if bot_name == "twitch_bot":
                logger.info(f"🔄 BOT RESTART: Перезапускаем Twitch бота...")
                
                # Останавливаем текущий бот
                if bot_instance:
                    try:
                        await bot_instance.stop_bot()
                        logger.info("Twitch bot stopped")
                    except Exception as e:
                        logger.error(f"Error stopping Twitch bot: {e}")
                
                if bot_task:
                    bot_task.cancel()
                    try:
                        await bot_task
                    except asyncio.CancelledError:
                        pass
                
                # Перезапускаем бота
                from bots.twitch_bot import Bot
                from core.connection_manager import get_connection_manager
                
                bot_token = os.getenv("TWITCH_BOT_TOKEN")
                if not bot_token:
                    return {"error": "TWITCH_BOT_TOKEN not configured"}
                
                # Получаем активные каналы
                connection_manager = get_connection_manager()
                active_channels = connection_manager.get_active_channels()
                # active_channels - это список строк (названий каналов)
                channel_names = active_channels
                
                # Создаем новый экземпляр бота
                new_bot_instance = Bot(bot_token, channel_names, connection_manager)
                new_bot_task = asyncio.create_task(new_bot_instance.start_bot())
                
                # Обновляем глобальные переменные
                import main
                main.bot_instance = new_bot_instance
                main.bot_task = new_bot_task
                
                logger.info(f"Twitch bot restarted with channels: {channel_names}")
                return {"message": f"Twitch bot restarted successfully", "channels": channel_names}
                
            elif bot_name == "vk_live_bot":
                logger.info(f"Restarting VK Live bot...")
                
                # Останавливаем текущий бот
                if vk_live_bot_instance:
                    try:
                        await vk_live_bot_instance.stop_bot()
                        logger.info("VK Live bot stopped")
                    except Exception as e:
                        logger.error(f"Error stopping VK Live bot: {e}")
                
                if vk_live_bot_task:
                    vk_live_bot_task.cancel()
                    try:
                        await vk_live_bot_task
                    except asyncio.CancelledError:
                        pass
                
                # Перезапускаем бота
                from bots.vk_live_bot import VKLiveBot
                from core.connection_manager import get_connection_manager
                
                vk_token = os.getenv("VK_LIVE_USER_TOKEN")
                if not vk_token:
                    return {"error": "VK_LIVE_USER_TOKEN not configured"}
                
                # Получаем активные каналы
                connection_manager = get_connection_manager()
                active_channels = connection_manager.get_active_channels()
                # active_channels - это список строк (названий каналов)
                channel_names = active_channels
                
                # Создаем новый экземпляр бота
                new_vk_bot_instance = VKLiveBot(vk_token, connection_manager)
                new_vk_bot_task = asyncio.create_task(new_vk_bot_instance.start_bot())
                
                # Обновляем глобальные переменные
                import main
                main.vk_live_bot_instance = new_vk_bot_instance
                main.vk_live_bot_task = new_vk_bot_task
                
                # Подключаем к каналам
                for channel_name in channel_names:
                    await new_vk_bot_instance.join_channel(channel_name)
                
                logger.info(f"VK Live bot restarted with channels: {channel_names}")
                return {"message": f"VK Live bot restarted successfully", "channels": channel_names}
            
            else:
                return {"error": f"Unknown bot: {bot_name}"}
                
        except Exception as e:
            logger.error(f"Error restarting bot {bot_name}: {e}")
            return {"error": f"Failed to restart bot: {str(e)}"}

    async def restart_tts_engine(self) -> dict:
        """Перезагрузить TTS движок"""
        try:
            import httpx
            
            # Получаем URL TTS сервиса
            tts_service_url = os.getenv("TTS_SERVICE_URL", "http://localhost:8001")
            
            # Отправляем запрос на перезагрузку TTS движка
            async with httpx.AsyncClient() as client:
                response = await client.post(f"{tts_service_url}/api/tts/restart")
                
                if response.status_code == 200:
                    logger.info("TTS engine restart requested successfully")
                    return {"message": "TTS engine restart requested successfully"}
                else:
                    logger.error(f"TTS engine restart failed: {response.status_code}")
                    return {"error": f"TTS engine restart failed: {response.status_code}"}
                    
        except Exception as e:
            logger.error(f"Error restarting TTS engine: {e}")
            return {"error": f"Failed to restart TTS engine: {str(e)}"}

    async def restart_bot_service(self) -> dict:
        """Перезагрузить весь Bot Service"""
        try:
            import sys
            import os
            import asyncio
            import subprocess
            
            logger.info("Restarting Bot Service...")
            
            # Получаем путь к скрипту запуска
            current_dir = os.path.dirname(os.path.dirname(__file__))
            restart_script = os.path.join(current_dir, "restart_bot_service.py")
            
            # Если скрипт перезапуска существует, используем его
            if os.path.exists(restart_script):
                subprocess.Popen([sys.executable, restart_script], 
                               cwd=current_dir, 
                               stdout=subprocess.DEVNULL, 
                               stderr=subprocess.DEVNULL)
                logger.info("Bot Service restart script started")
                return {"message": "Bot Service restart initiated"}
            else:
                # Альтернативный способ - перезапуск через системные команды
                logger.info("Restart script not found, using alternative method")
                
                # Останавливаем все боты
                await self.restart_bot("twitch_bot")
                await self.restart_bot("vk_live_bot")
                
                logger.info("Bot Service restarted successfully")
                return {"message": "Bot Service restarted successfully"}
                
        except Exception as e:
            logger.error(f"Error restarting Bot Service: {e}")
            return {"error": f"Failed to restart Bot Service: {str(e)}"}

    async def get_bots_logs(self) -> dict:
        """Получить логи ботов"""
        # Здесь можно добавить чтение логов из файлов
        # Пока возвращаем заглушку
        return {
            "logs": [
                {
                    "timestamp": datetime.utcnow().isoformat(),
                    "level": "INFO",
                    "bot": "twitch_bot",
                    "message": "Bot started successfully"
                },
                {
                    "timestamp": datetime.utcnow().isoformat(),
                    "level": "INFO", 
                    "bot": "vk_live_bot",
                    "message": "Bot connected to VK Live"
                }
            ]
        }

    async def get_system_logs(self, level: str = None, search: str = None, limit: int = 100) -> dict:
        """Получить системные логи с фильтрацией"""
        logs = []
        
        try:
            # Ищем файлы логов в папке logs
            log_files = []
            log_dir = os.path.join(os.path.dirname(__file__), '..', 'logs')
            if os.path.exists(log_dir):
                log_files.extend(glob.glob(os.path.join(log_dir, '*.log')))
            
            # Также ищем в корневой папке logs
            root_log_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'logs')
            if os.path.exists(root_log_dir):
                log_files.extend(glob.glob(os.path.join(root_log_dir, '*.log')))
            
            # Читаем логи из всех найденных файлов
            for log_file in log_files:
                try:
                    with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                        for line in f:
                            line = line.strip()
                            if not line:
                                continue
                            
                            # Парсим строку лога (простой формат)
                            # Предполагаем формат: TIMESTAMP LEVEL MODULE: MESSAGE
                            parts = line.split(' ', 3)
                            if len(parts) >= 4:
                                timestamp_str = parts[0] + ' ' + parts[1]
                                log_level = parts[2]
                                message_part = parts[3]
                                
                                # Извлекаем модуль из сообщения
                                module = "system"
                                if ':' in message_part:
                                    module_part, message = message_part.split(':', 1)
                                    module = module_part.strip()
                                    message = message.strip()
                                else:
                                    message = message_part
                                
                                # Парсим timestamp
                                try:
                                    # Пробуем разные форматы timestamp
                                    timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                                except:
                                    try:
                                        timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                                    except:
                                        timestamp = datetime.utcnow()
                                
                                logs.append({
                                    "timestamp": timestamp.isoformat(),
                                    "level": log_level.upper(),
                                    "module": module,
                                    "message": message
                                })
                            else:
                                # Если не удалось распарсить, добавляем как есть
                                logs.append({
                                    "timestamp": datetime.utcnow().isoformat(),
                                    "level": "INFO",
                                    "module": "system",
                                    "message": line
                                })
                except Exception as e:
                    logger.error(f"Error reading log file {log_file}: {e}")
                    continue
            
            # Сортируем по времени (новые сверху)
            logs.sort(key=lambda x: x["timestamp"], reverse=True)
            
        except Exception as e:
            logger.error(f"Error reading system logs: {e}")
            # Если не удалось прочитать логи, возвращаем пустой список
            logs = []
        
        # Фильтрация по уровню
        if level:
            logs = [log for log in logs if log["level"] == level.upper()]
        
        # Фильтрация по поиску
        if search:
            logs = [log for log in logs if search.lower() in log["message"].lower()]
        
        # Ограничение количества
        logs = logs[:limit]
        
        return {
            "logs": logs,
            "total": len(logs),
            "filters": {
                "level": level,
                "search": search,
                "limit": limit
            }
        }

    async def export_system_logs(self, level: str = None, search: str = None) -> dict:
        """Экспортировать системные логи"""
        # Здесь можно добавить генерацию файла для экспорта
        # Пока возвращаем заглушку
        logs_data = await self.get_system_logs(level, search, 1000)
        
        # Генерируем CSV содержимое
        csv_content = "timestamp,level,module,message\n"
        for log in logs_data["logs"]:
            csv_content += f"{log['timestamp']},{log['level']},{log['module']},\"{log['message']}\"\n"
        
        return {
            "content": csv_content,
            "filename": f"system_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv",
            "mime_type": "text/csv"
        }