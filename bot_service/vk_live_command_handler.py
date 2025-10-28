# bot_service/vk_live_command_handler.py
import asyncio
import logging
import re
from typing import Dict, List, Optional, Callable
from datetime import datetime, timedelta
from utils.role_checker import RoleChecker

logger = logging.getLogger('bot_service')

class VKLiveCommandHandler:
    """
    Обработчик команд для VK Live чата
    Поддерживает модерацию и управление каналом
    """
    
    def __init__(self, vk_live_bot):
        self.vk_live_bot = vk_live_bot
        self.commands: Dict[str, Dict] = {}
        self.cooldowns: Dict[str, Dict[str, datetime]] = {}  # command -> {user_id -> last_used}
        
        # Регистрируем стандартные команды
        self._register_default_commands()
    
    async def _get_channel_owner_id(self, channel: str) -> Optional[int]:
        """Получение ID владельца канала из базы данных"""
        try:
            from core.database import User, UserToken, get_db
            
            db = next(get_db())
            try:
                # Ищем пользователя по vk_channel_name (правильное поле!)
                vk_user = db.query(User).filter(
                    User.vk_channel_name == channel.lower()
                ).first()
                
                if vk_user:
                    return vk_user.id
                
                # Fallback: ищем по vk_username для обратной совместимости
                vk_user = db.query(User).filter(
                    User.vk_username == channel.lower()
                ).first()
                
                return vk_user.id if vk_user else None
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error getting channel owner ID for {channel}: {e}")
            return None
    
    def _register_default_commands(self):
        """Регистрация стандартных команд"""
        
        # === КОМАНДЫ МОДЕРАЦИИ (требуют права модератора) ===
        self.register_command(
            name="mute",
            handler=self._cmd_mute,
            description="Замутить пользователя",
            usage="!mute @пользователь [время_в_минутах]",
            requires_mod=True,
            cooldown=5
        )
        
        self.register_command(
            name="ban",
            handler=self._cmd_ban,
            description="Забанить пользователя",
            usage="!ban @пользователь [причина]",
            requires_mod=True,
            cooldown=5
        )
        
        self.register_command(
            name="unban",
            handler=self._cmd_unban,
            description="Разбанить пользователя",
            usage="!unban @пользователь",
            requires_mod=True,
            cooldown=5
        )
        
        self.register_command(
            name="clear",
            handler=self._cmd_clear,
            description="Очистить чат",
            usage="!clear [количество_сообщений]",
            requires_mod=True,
            cooldown=30
        )
        
        # === КОМАНДЫ TTS (доступны всем) ===
        self.register_command(
            name="tts",
            handler=self._cmd_tts_toggle,
            description="Включить/выключить TTS",
            usage="!tts [on|off]",
            requires_mod=False,
            cooldown=10
        )
        
        # === ИНФОРМАЦИОННЫЕ КОМАНДЫ ===
        self.register_command(
            name="help",
            handler=self._cmd_help,
            description="Показать список команд",
            usage="!help [команда]",
            requires_mod=False,
            cooldown=30
        )
        
        self.register_command(
            name="ping",
            handler=self._cmd_ping,
            description="Проверить работу бота",
            usage="!ping",
            requires_mod=False,
            cooldown=5
        )
        
        self.register_command(
            name="uptime",
            handler=self._cmd_uptime,
            description="Время работы бота",
            usage="!uptime",
            requires_mod=False,
            cooldown=10
        )
        
        # === КОМАНДЫ YOUTUBE ОЧЕРЕДИ ===
        self.register_command(
            name="sr",
            handler=self._cmd_song_request,
            description="Заказать YouTube видео",
            usage="!sr <URL>",
            requires_mod=False,
            cooldown=30
        )
        
        # === КОМАНДЫ ГЭМБЛИНГА ===
        
        
        self.register_command(
            name="balance",
            handler=self._cmd_check_balance,
            description="Проверить баланс баллов",
            usage="!balance",
            requires_mod=False,
            cooldown=10
        )
        
        self.register_command(
            name="queue",
            handler=self._cmd_queue,
            description="Показать очередь видео",
            usage="!queue",
            requires_mod=False,
            cooldown=10
        )
        
        self.register_command(
            name="next",
            handler=self._cmd_next_video,
            description="Следующее видео",
            usage="!next",
            requires_mod=True,
            cooldown=5
        )
        
        self.register_command(
            name="skip",
            handler=self._cmd_skip_video,
            description="Пропустить текущее видео",
            usage="!skip [номер]",
            requires_mod=True,
            cooldown=5
        )
    
    def register_command(self, name: str, handler: Callable, description: str = "", 
                        usage: str = "", requires_mod: bool = False, cooldown: int = 0):
        """Регистрация команды"""
        self.commands[name.lower()] = {
            'handler': handler,
            'description': description,
            'usage': usage,
            'requires_mod': requires_mod,
            'cooldown': cooldown
        }
        logger.info(f"📝 Registered VK Live command: !{name}")
    
    async def handle_message(self, channel_name: str, message_data: dict):
        """Обработка сообщения для поиска команд"""
        try:
            message = message_data.get('message', '').strip()
            
            # Быстрая проверка: является ли командой
            if not message or not message.startswith('!'):
                return
            
            # Парсим команду
            parts = message[1:].split()
            if not parts:
                return
            
            command_name = parts[0].lower()
            
            # Проверяем существование команды
            if command_name not in self.commands:
                return
            
            # Получаем данные автора
            author_nick = message_data.get('author_nick', 'Unknown')
            author_id = str(message_data.get('author_id', ''))
            is_moderator = message_data.get('is_moderator', False)
            is_owner = message_data.get('is_owner', False)
            
            command_info = self.commands[command_name]
            
            # Проверяем права доступа
            if command_info['requires_mod'] and not (is_owner or is_moderator):
                await self._send_response(
                    channel_name, 
                    f"@{author_nick} ❌ Эта команда доступна только модераторам"
                )
                return
            
            # Проверяем кулдаун
            if command_info['cooldown'] > 0:
                if not self._check_cooldown(command_name, author_id, command_info['cooldown']):
                    remaining = self._get_cooldown_remaining(command_name, author_id, command_info['cooldown'])
                    await self._send_response(
                        channel_name,
                        f"@{author_nick} ⏰ Команда на кулдауне. Осталось: {remaining}с"
                    )
                    return
            
            # Выполняем команду
            logger.info(f"🎯 VK Live command executed: !{command_name} by {author_nick} in {channel_name}")
            await command_info['handler'](channel_name, author_nick, author_id, parts[1:], message_data)
            
        except Exception as e:
            logger.error(f"Error handling VK Live command: {e}")
    
    def _check_cooldown(self, command: str, user_id: str, cooldown_seconds: int) -> bool:
        """Проверка кулдауна команды"""
        if cooldown_seconds <= 0:
            return True
        
        if command not in self.cooldowns:
            self.cooldowns[command] = {}
        
        now = datetime.now()
        last_used = self.cooldowns[command].get(user_id)
        
        if not last_used:
            self.cooldowns[command][user_id] = now
            return True
        
        time_passed = (now - last_used).total_seconds()
        if time_passed >= cooldown_seconds:
            self.cooldowns[command][user_id] = now
            return True
        
        return False
    
    def _get_cooldown_remaining(self, command: str, user_id: str, cooldown_seconds: int) -> int:
        """Получение оставшегося времени кулдауна"""
        if command not in self.cooldowns or user_id not in self.cooldowns[command]:
            return 0
        
        now = datetime.now()
        last_used = self.cooldowns[command][user_id]
        time_passed = (now - last_used).total_seconds()
        
        return max(0, int(cooldown_seconds - time_passed))
    
    async def _send_response(self, channel_name: str, message: str):
        """Отправка ответа в чат"""
        try:
            await self.vk_live_bot.send_message(channel_name, message)
        except Exception as e:
            logger.error(f"Failed to send VK Live command response: {e}")
    
    # === КОМАНДЫ МОДЕРАЦИИ ===
    
    async def _cmd_mute(self, channel: str, author: str, author_id: str, args: List[str], message_data: dict):
        """Команда мута пользователя"""
        try:
            if not args:
                await self._send_response(channel, f"@{author} Использование: !mute @пользователь [минуты]")
                return
            
            # Парсим упоминание пользователя
            target_user = args[0].lstrip('@')
            duration_minutes = 5  # По умолчанию 5 минут
            
            if len(args) > 1:
                try:
                    duration_minutes = int(args[1])
                    duration_minutes = max(1, min(duration_minutes, 1440))  # От 1 минуты до 24 часов
                except ValueError:
                    await self._send_response(channel, f"@{author} ❌ Неверное время. Используйте число (минуты)")
                    return
            
            # Получение user_id по нику требует отдельного API запроса
            # Пока используем заглушку
            target_user_id = 0  # Нужно получить через VK API
            
            if target_user_id == 0:
                await self._send_response(channel, f"@{author} ❌ Пользователь {target_user} не найден")
                return
            
            # Выполняем мут
            duration_seconds = duration_minutes * 60
            success = await self.vk_live_bot.mute_user(channel, target_user_id, duration_seconds)
            
            if success:
                await self._send_response(channel, 
                    f"✅ Пользователь {target_user} замучен на {duration_minutes} минут")
            else:
                await self._send_response(channel, f"❌ Не удалось замутить {target_user}")
                
        except Exception as e:
            logger.error(f"Error in mute command: {e}")
            await self._send_response(channel, f"@{author} ❌ Ошибка выполнения команды")
    
    async def _cmd_ban(self, channel: str, author: str, author_id: str, args: List[str], message_data: dict):
        """Команда бана пользователя"""
        try:
            if not args:
                await self._send_response(channel, f"@{author} Использование: !ban @пользователь [причина]")
                return
            
            target_user = args[0].lstrip('@')
            reason = " ".join(args[1:]) if len(args) > 1 else "Нарушение правил чата"
            
            # Получение user_id и выполнение бана через VK API
            # success = await self.vk_live_bot.ban_user(channel, target_user_id, reason)
            
            await self._send_response(channel, 
                f"⚠️ Функция бана пользователей пока не реализована в VK Live API")
                
        except Exception as e:
            logger.error(f"Error in ban command: {e}")
            await self._send_response(channel, f"@{author} ❌ Ошибка выполнения команды")
    
    async def _cmd_unban(self, channel: str, author: str, author_id: str, args: List[str], message_data: dict):
        """Команда разбана пользователя"""
        try:
            if not args:
                await self._send_response(channel, f"@{author} Использование: !unban @пользователь")
                return
            
            target_user = args[0].lstrip('@')
            
            # VK Live API не поддерживает разбан пользователей
            await self._send_response(channel, 
                f"⚠️ VK Live API не поддерживает разбан пользователей")
                
        except Exception as e:
            logger.error(f"Error in unban command: {e}")
            await self._send_response(channel, f"@{author} ❌ Ошибка выполнения команды")
    
    async def _cmd_clear(self, channel: str, author: str, author_id: str, args: List[str], message_data: dict):
        """Команда очистки чата"""
        try:
            # VK Live API не поддерживает удаление сообщений
            await self._send_response(channel, 
                f"⚠️ VK Live API не поддерживает удаление сообщений из чата")
                
        except Exception as e:
            logger.error(f"Error in clear command: {e}")
            await self._send_response(channel, f"@{author} ❌ Ошибка выполнения команды")
    
    # === КОМАНДЫ TTS ===
    
    async def _cmd_tts_toggle(self, channel: str, author: str, author_id: str, args: List[str], message_data: dict):
        """Команда управления TTS"""
        try:
            action = args[0].lower() if args else "toggle"
            
            # Проверяем статус TTS
            is_enabled = self.vk_live_bot.connection_manager.is_tts_enabled(channel, 'vk')
            
            if action in ['on', 'вкл', 'включить']:
                if is_enabled:
                    await self._send_response(channel, f"@{author} 🎤 TTS уже включен")
                else:
                    self.vk_live_bot.connection_manager.enable_tts(channel, 'vk')
                    await self._send_response(channel, f"@{author} ✅ TTS включен")
            elif action in ['off', 'выкл', 'выключить']:
                if not is_enabled:
                    await self._send_response(channel, f"@{author} 🔇 TTS уже выключен")
                else:
                    self.vk_live_bot.connection_manager.disable_tts(channel, 'vk')
                    await self._send_response(channel, f"@{author} ❌ TTS выключен")
            else:
                # Toggle
                if is_enabled:
                    self.vk_live_bot.connection_manager.disable_tts(channel, 'vk')
                    await self._send_response(channel, f"@{author} ❌ TTS выключен")
                else:
                    self.vk_live_bot.connection_manager.enable_tts(channel, 'vk')
                    await self._send_response(channel, f"@{author} ✅ TTS включен")
                    
        except Exception as e:
            logger.error(f"Error in TTS command: {e}")
            await self._send_response(channel, f"@{author} ❌ Ошибка выполнения команды")
    
    # === ИНФОРМАЦИОННЫЕ КОМАНДЫ ===
    
    async def _cmd_help(self, channel: str, author: str, author_id: str, args: List[str], message_data: dict):
        """Команда помощи"""
        try:
            is_mod = message_data.get('is_moderator', False) or message_data.get('is_owner', False)
            
            if args and args[0].lower() in self.commands:
                # Информация о конкретной команде
                cmd_name = args[0].lower()
                cmd_info = self.commands[cmd_name]
                await self._send_response(channel, 
                    f"@{author} 📖 !{cmd_name}: {cmd_info['description']} | {cmd_info['usage']}")
            else:
                # Список всех доступных команд
                user_commands = []
                mod_commands = []
                
                for cmd_name, cmd_info in self.commands.items():
                    if cmd_info['requires_mod']:
                        mod_commands.append(f"!{cmd_name}")
                    else:
                        user_commands.append(f"!{cmd_name}")
                
                response = f"@{author} 🤖 Доступные команды: {', '.join(user_commands)}"
                if is_mod and mod_commands:
                    response += f" | 👑 Модератор: {', '.join(mod_commands)}"
                
                await self._send_response(channel, response)
                
        except Exception as e:
            logger.error(f"Error in help command: {e}")
            await self._send_response(channel, f"@{author} ❌ Ошибка выполнения команды")
    
    async def _cmd_ping(self, channel: str, author: str, author_id: str, args: List[str], message_data: dict):
        """Команда проверки работы бота"""
        try:
            await self._send_response(channel, f"@{author} 🏓 Pong! Бот работает исправно")
        except Exception as e:
            logger.error(f"Error in ping command: {e}")
    
    async def _cmd_uptime(self, channel: str, author: str, author_id: str, args: List[str], message_data: dict):
        """Команда времени работы бота"""
        try:
            # Получаем статистику из оптимизированного reader'а
            if hasattr(self.vk_live_bot, 'chat_reader') and self.vk_live_bot.chat_reader:
                if hasattr(self.vk_live_bot.chat_reader, 'get_performance_stats'):
                    stats = self.vk_live_bot.chat_reader.get_performance_stats()
                    uptime_seconds = stats.get('uptime_seconds', 0)
                    
                    hours = int(uptime_seconds // 3600)
                    minutes = int((uptime_seconds % 3600) // 60)
                    seconds = int(uptime_seconds % 60)
                    
                    uptime_str = f"{hours}ч {minutes}м {seconds}с"
                    total_messages = stats.get('total_messages', 0)
                    
                    await self._send_response(channel, 
                        f"@{author} ⏰ Uptime: {uptime_str} | 📨 Сообщений: {total_messages}")
                else:
                    await self._send_response(channel, f"@{author} ⏰ Бот работает")
            else:
                await self._send_response(channel, f"@{author} ⏰ Бот работает")
                
        except Exception as e:
            logger.error(f"Error in uptime command: {e}")
            await self._send_response(channel, f"@{author} ❌ Ошибка выполнения команды")
    
    # === КОМАНДЫ YOUTUBE ОЧЕРЕДИ ===
    
    async def _cmd_song_request(self, channel: str, author: str, author_id: str, args: List[str], message_data: dict):
        """Команда заказа YouTube видео"""
        try:
            if not args:
                await self._send_response(channel, f"@{author} Использование: !sr <YouTube URL>")
                return
            
            video_url = args[0]
            
            # Импортируем сервисы
            from services.queue_service import QueueService
            from core.database import get_db
            
            queue_service = QueueService()
            
            # Получаем user_id владельца канала из базы данных
            channel_owner_id = await self._get_channel_owner_id(channel)
            
            if not channel_owner_id:
                await self._send_response(channel, f"@{author} ❌ Канал не зарегистрирован в системе")
                return
            
            # Определяем платформу
            platform = 'vk' if hasattr(self.vk_live_bot, 'chat_reader') else 'twitch'
            
            db = next(get_db())
            try:
                result = await queue_service.add_video_to_queue(
                    user_id=channel_owner_id,
                    video_url=video_url,
                    channel_name=channel,
                    platform=platform,
                    requester_name=author,
                    requester_id=author_id,
                    is_paid=False,  # Пока без баллов
                    db=db
                )
                
                if result['success']:
                    queue_item = result['queue_item']
                    await self._send_response(channel, 
                        f"✅ @{author} Добавлено в очередь: {queue_item['title']} "
                        f"(позиция {queue_item['position']}, {queue_item.get('duration', 'Unknown')})")
                else:
                    await self._send_response(channel, f"❌ @{author} {result['error']}")
                    
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error in song request command: {e}")
            await self._send_response(channel, f"@{author} ❌ Ошибка добавления видео")
    
    async def _cmd_queue(self, channel: str, author: str, author_id: str, args: List[str], message_data: dict):
        """Команда просмотра очереди"""
        try:
            from services.queue_service import QueueService
            from core.database import get_db
            
            queue_service = QueueService()
            channel_owner_id = await self._get_channel_owner_id(channel)
            
            if not channel_owner_id:
                await self._send_response(channel, f"@{author} ❌ Канал не зарегистрирован в системе")
                return
            
            db = next(get_db())
            try:
                queue_items = queue_service.get_queue(channel_owner_id, db)
                
                if not queue_items:
                    await self._send_response(channel, f"@{author} 📃 Очередь пуста")
                    return
                
                # Показываем первые 3 видео
                response = f"@{author} 📃 Очередь ({len(queue_items)} видео):\n"
                for i, item in enumerate(queue_items[:3]):
                    response += f"{i+1}. {item['title']} ({item['duration']}) - {item['requester_name']}\n"
                
                if len(queue_items) > 3:
                    response += f"... и еще {len(queue_items) - 3} видео"
                
                await self._send_response(channel, response)
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error in queue command: {e}")
            await self._send_response(channel, f"@{author} ❌ Ошибка получения очереди")
    
    async def _cmd_next_video(self, channel: str, author: str, author_id: str, args: List[str], message_data: dict):
        """Команда следующего видео"""
        try:
            from services.queue_service import QueueService
            from core.database import get_db
            
            queue_service = QueueService()
            channel_owner_id = await self._get_channel_owner_id(channel)
            
            if not channel_owner_id:
                await self._send_response(channel, f"@{author} ❌ Канал не зарегистрирован в системе")
                return
            
            db = next(get_db())
            try:
                next_video = queue_service.get_next_video(channel_owner_id, db)
                
                if not next_video:
                    await self._send_response(channel, f"@{author} 📃 Очередь пуста")
                    return
                
                await self._send_response(channel, 
                    f"▶️ @{author} Следующее: {next_video['title']} "
                    f"({next_video['duration']}) - {next_video['requester_name']}")
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error in next video command: {e}")
            await self._send_response(channel, f"@{author} ❌ Ошибка получения следующего видео")
    
    async def _cmd_skip_video(self, channel: str, author: str, author_id: str, args: List[str], message_data: dict):
        """Команда пропуска видео"""
        try:
            from services.queue_service import QueueService
            from core.database import get_db
            
            queue_service = QueueService()
            channel_owner_id = await self._get_channel_owner_id(channel)
            
            if not channel_owner_id:
                await self._send_response(channel, f"@{author} ❌ Канал не зарегистрирован в системе")
                return
            
            # Если указан номер в очереди
            if args:
                try:
                    position = int(args[0])
                    await self._send_response(channel, 
                        f"@{author} ⚠️ Пропуск по номеру пока не реализован")
                    return
                except ValueError:
                    await self._send_response(channel, 
                        f"@{author} Использование: !skip [номер]")
                    return
            
            # Пропускаем следующее видео
            db = next(get_db())
            try:
                next_video = queue_service.get_next_video(channel_owner_id, db)
                
                if not next_video:
                    await self._send_response(channel, f"@{author} 📃 Очередь пуста")
                    return
                
                success = queue_service.remove_from_queue(channel_owner_id, next_video['id'], db)
                
                if success:
                    await self._send_response(channel, 
                        f"⏭️ @{author} Пропущено: {next_video['title']}")
                else:
                    await self._send_response(channel, f"@{author} ❌ Не удалось пропустить видео")
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error in skip command: {e}")
            await self._send_response(channel, f"@{author} ❌ Ошибка пропуска видео")
    
    # === КОМАНДЫ ГЭМБЛИНГА ===
    
    
    
    async def _cmd_check_balance(self, channel: str, author: str, author_id: str, args: List[str], message_data: dict):
        """Команда проверки баланса баллов"""
        try:
            from services.points_service import PointsService
            from core.database import get_db
            
            points_service = PointsService()
            channel_owner_id = await self._get_channel_owner_id(channel)
            
            if not channel_owner_id:
                await self._send_response(channel, f"@{author} ❌ Канал не зарегистрирован в системе")
                return
            
            platform = 'vk' if hasattr(self.vk_live_bot, 'chat_reader') else 'twitch'
            
            db = next(get_db())
            try:
                balance = points_service.get_user_points(
                    channel_owner_id, author_id, platform, channel, db
                )
                
                await self._send_response(channel, 
                    f"💰 @{author} Ваш баланс: {balance:,} баллов")
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error in balance command: {e}")
            await self._send_response(channel, f"@{author} ❌ Ошибка проверки баланса")
