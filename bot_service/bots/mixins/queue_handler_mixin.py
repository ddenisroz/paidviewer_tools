# features/commands/mixins/queue_handler_mixin.py
"""Mixin for Queue management commands (Song Request, Queue, etc.)"""
import logging

logger = logging.getLogger(__name__)


class QueueHandlerMixin:
    """Mixin for processing queue-related commands (sr, skip, clear, wronglink, queue)"""
    
    # Expected attributes/methods from main class
    logger: logging.Logger
    
    async def _handle_sr(self, ctx, bot, args, platform, db):
        """Handler для !sr (Song Request)"""
        try:
            if not args:
                await ctx.send(f"@{ctx.author.name} [ERROR] Использование: !sr <YouTube URL или ID>")
                return

            # Вызываем существующий метод из commands_handler
            if hasattr(bot, 'commands_handler'):
                await bot.commands_handler.song_request_command(ctx, url=args)

        except Exception as e:
            self.logger.error(f"Error in !sr handler: {e}")
            await ctx.send(f"@{ctx.author.name} [ERROR] Ошибка добавления видео")

    async def _handle_sr_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !sr в VK"""
        try:
            if not args:
                await vk_bot.send_message(channel_name, f"@{author_name} [ERROR] Использование: !sr <YouTube URL>")
                return

            video_url = args

            # Импортируем сервисы
            from services.youtube.queue_service import QueueService
            queue_service = QueueService()

            # Получаем user_id владельца канала из базы данных
            channel_owner_id = await self._get_channel_owner_id_vk(channel_name)

            if not channel_owner_id:
                await vk_bot.send_message(channel_name, f"@{author_name} [ERROR] Канал не зарегистрирован в системе")
                return

            # Добавляем видео в очередь
            result = await queue_service.add_video_to_queue(
                user_id=channel_owner_id,
                video_url=video_url,
                channel_name=channel_name,
                platform='vk',
                requester_name=author_name,
                requester_id=author_id,
                is_paid=False,
                db=db
            )

            if result['success']:
                queue_item = result['queue_item']
                await vk_bot.send_message(
                    channel_name,
                    f"[OK] @{author_name} Добавлено в очередь: {queue_item['title']} "
                    f"(позиция {queue_item['position']}, {queue_item.get('duration', 'Unknown')})"
                )
            else:
                await vk_bot.send_message(channel_name, f"[ERROR] @{author_name} {result['error']}")

        except Exception as e:
            self.logger.error(f"Error in VK song request: {e}")
            await vk_bot.send_message(channel_name, f"@{author_name} [ERROR] Ошибка добавления видео")

    async def _handle_skip(self, ctx, bot, args, platform, db):
        """Handler для !skip (Twitch)"""
        try:
            from services.youtube.queue_service import QueueService
            from core.database import User

            # Получаем user_id владельца канала
            from repositories.user_repository import UserRepository
            user = UserRepository(db).get_by_twitch_username(ctx.channel.name)

            if not user:
                await ctx.send(f"@{ctx.author.name} [ERROR] Канал не найден")
                return

            queue_service = QueueService()
            queue = queue_service.get_queue(user.id, db)

            if not queue:
                await ctx.send(f"@{ctx.author.name} [INFO] Очередь пуста")
                return

            # Пропускаем первое видео
            first_video = queue[0]
            success = queue_service.remove_from_queue(user.id, first_video['id'], db)

            if success:
                await ctx.send(f"@{ctx.author.name} [SKIP] Видео пропущено: {first_video['title']}")
                self.logger.info(f"[OK] Video skipped for {ctx.channel.name}")
            else:
                await ctx.send(f"@{ctx.author.name} [ERROR] Не удалось пропустить видео")

        except Exception as e:
            self.logger.error(f"Error in !skip handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} [ERROR] Ошибка пропуска видео")

    async def _handle_skip_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !skip (VK)"""
        try:
            from services.youtube.queue_service import QueueService
            from core.database import User

            # Получаем user_id владельца канала
            from repositories.user_repository import UserRepository
            user = UserRepository(db).get_by_vk_username(channel_name)

            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} [ERROR] Канал не найден")
                return

            queue_service = QueueService()
            queue = queue_service.get_queue(user.id, db)

            if not queue:
                await vk_bot.send_message(channel_name, f"@{author_name} [INFO] Очередь пуста")
                return

            # Пропускаем первое видео
            first_video = queue[0]
            success = queue_service.remove_from_queue(user.id, first_video['id'], db)

            if success:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [SKIP] Видео пропущено: {first_video['title']}")
                self.logger.info(f"[OK] Video skipped for VK {channel_name}")
            else:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [ERROR] Не удалось пропустить видео")

        except Exception as e:
            self.logger.error(f"Error in !skip VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name,
                f"@{author_name} [ERROR] Ошибка пропуска видео")

    async def _handle_clear(self, ctx, bot, args, platform, db):
        """Handler для !clear (Twitch)"""
        try:
            from core.database import YouTubeQueue
            from repositories.user_repository import UserRepository

            # Получаем user_id владельца канала
            user = UserRepository(db).get_by_twitch_username(ctx.channel.name)

            if not user:
                await ctx.send(f"@{ctx.author.name} [ERROR] Канал не найден")
                return

            # Очищаем очередь
            # Очищаем очередь
            from services.youtube.queue_service import QueueService
            queue_service = QueueService()
            deleted_count = queue_service.clear_queue(user.id, db)

            if deleted_count > 0:
                await ctx.send(f"@{ctx.author.name} [DELETE] Очередь очищена ({deleted_count} видео)")
                self.logger.info(f"[OK] Queue cleared for {ctx.channel.name}: {deleted_count} videos")
            else:
                await ctx.send(f"@{ctx.author.name} [INFO] Очередь уже пуста")

        except Exception as e:
            self.logger.error(f"Error in !clear handler: {e}", exc_info=True)
            db.rollback()
            await ctx.send(f"@{ctx.author.name} [ERROR] Ошибка очистки очереди")

    async def _handle_clear_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !clear (VK)"""
        try:
            from core.database import YouTubeQueue
            from repositories.user_repository import UserRepository

            # Получаем user_id владельца канала
            user = UserRepository(db).get_by_vk_username(channel_name)

            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} [ERROR] Канал не найден")
                return

            # Очищаем очередь
            # Очищаем очередь
            from services.youtube.queue_service import QueueService
            queue_service = QueueService()
            deleted_count = queue_service.clear_queue(user.id, db)

            if deleted_count > 0:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [DELETE] Очередь очищена ({deleted_count} видео)")
                self.logger.info(f"[OK] Queue cleared for VK {channel_name}: {deleted_count} videos")
            else:
                await vk_bot.send_message(channel_name, f"@{author_name} [INFO] Очередь уже пуста")

        except Exception as e:
            self.logger.error(f"Error in !clear VK handler: {e}", exc_info=True)
            db.rollback()
            await vk_bot.send_message(channel_name,
                f"@{author_name} [ERROR] Ошибка очистки очереди")

    async def _handle_queue(self, ctx, bot, args, platform, db):
        """Handler для !queue (Twitch)"""
        try:
            from services.youtube.queue_service import QueueService
            from core.database import User

            # Получаем user_id владельца канала
            from repositories.user_repository import UserRepository
            user = UserRepository(db).get_by_twitch_username(ctx.channel.name)

            if not user:
                await ctx.send(f"@{ctx.author.name} [ERROR] Канал не найден")
                return

            queue_service = QueueService()
            queue = queue_service.get_queue(user.id, db)

            if not queue:
                await ctx.send(f"@{ctx.author.name} [INFO] Очередь пуста")
                return

            # Показываем первые 5 видео
            queue_list = []
            for i, video in enumerate(queue[:5], 1):
                title = video['title'][:50] + '...' if len(video['title']) > 50 else video['title']
                queue_list.append(f"{i}. {title}")

            queue_text = " | ".join(queue_list)
            total = len(queue)

            if total > 5:
                await ctx.send(f"[LIST] Очередь ({total} видео): {queue_text} и ещё {total - 5}...")
            else:
                await ctx.send(f"[LIST] Очередь ({total} видео): {queue_text}")

        except Exception as e:
            self.logger.error(f"Error in !queue handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} [ERROR] Ошибка получения очереди")

    async def _handle_wronglink(self, ctx, bot, args, platform, db):
        """Handler для !wronglink (Twitch) - удаление последнего своего видео"""
        try:
            from services.youtube.queue_service import QueueService
            from core.database import User

            # Получаем user_id владельца канала
            from repositories.user_repository import UserRepository
            user = UserRepository(db).get_by_twitch_username(ctx.channel.name)

            if not user:
                await ctx.send(f"@{ctx.author.name} [ERROR] Канал не найден")
                return

            queue_service = QueueService()
            result = queue_service.remove_last_user_video(
                user_id=user.id,
                requester_id=str(ctx.author.id),
                requester_name=ctx.author.name,
                platform='twitch',
                db=db
            )

            if result['success']:
                refund_msg = ""
                if result.get('refunded'):
                    refund_msg = f" (возвращено {result['points_refunded']} баллов)"
                await ctx.send(f"{result['message']}{refund_msg}")
            else:
                await ctx.send(result['error'])

        except Exception as e:
            self.logger.error(f"Error in !wronglink handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} [ERROR] Ошибка удаления видео")

    async def _handle_wronglink_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !wronglink (VK) - удаление последнего своего видео"""
        try:
            from services.youtube.queue_service import QueueService
            from core.database import User

            # Получаем user_id владельца канала
            from repositories.user_repository import UserRepository
            user = UserRepository(db).get_by_vk_username(channel_name)

            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} [ERROR] Канал не найден")
                return

            queue_service = QueueService()
            result = queue_service.remove_last_user_video(
                user_id=user.id,
                requester_id=str(author_id),
                requester_name=author_name,
                platform='vk',
                db=db
            )

            if result['success']:
                refund_msg = ""
                if result.get('refunded'):
                    refund_msg = f" (возвращено {result['points_refunded']} баллов)"
                await vk_bot.send_message(channel_name, f"{result['message']}{refund_msg}")
            else:
                await vk_bot.send_message(channel_name, result['error'])

        except Exception as e:
            self.logger.error(f"Error in !wronglink VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name, f"@{author_name} [ERROR] Ошибка удаления видео")

    async def _handle_queue_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !queue (VK)"""
        try:
            from services.youtube.queue_service import QueueService
            from core.database import User

            # Получаем user_id владельца канала
            from repositories.user_repository import UserRepository
            user = UserRepository(db).get_by_vk_username(channel_name)

            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} [ERROR] Канал не найден")
                return

            queue_service = QueueService()
            queue = queue_service.get_queue(user.id, db)

            if not queue:
                await vk_bot.send_message(channel_name, f"@{author_name} [INFO] Очередь пуста")
                return

            # Показываем первые 5 видео
            queue_list = []
            for i, video in enumerate(queue[:5], 1):
                title = video['title'][:50] + '...' if len(video['title']) > 50 else video['title']
                queue_list.append(f"{i}. {title}")

            queue_text = " | ".join(queue_list)
            total = len(queue)

            if total > 5:
                await vk_bot.send_message(channel_name,
                    f"[LIST] Очередь ({total} видео): {queue_text} и ещё {total - 5}...")
            else:
                await vk_bot.send_message(channel_name,
                    f"[LIST] Очередь ({total} видео): {queue_text}")

        except Exception as e:
            self.logger.error(f"Error in !queue VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name,
                f"@{author_name} [ERROR] Ошибка получения очереди")
