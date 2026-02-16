# bot_service/bots/mixins/memealerts_handler_mixin.py
"""Mixin for MemeAlerts commands (memegrant)."""
import logging

from services.memealerts_service import MemeAlertsService

logger = logging.getLogger(__name__)


class MemeAlertsHandlerMixin:
    """Mixin for MemeAlerts-related commands."""

    logger: logging.Logger

    async def _handle_memegrant(self, ctx, bot, args, platform, db):
        """Handler for !memegrant (Twitch)"""
        try:
            if not args:
                await ctx.send(f"@{ctx.author.name} [ERROR] Использование: !memegrant <nickname> <amount>")
                return

            parts = args.split()
            if len(parts) < 2:
                await ctx.send(f"@{ctx.author.name} [ERROR] Использование: !memegrant <nickname> <amount>")
                return

            nickname = parts[0].lstrip("@")
            try:
                amount = int(parts[1])
            except ValueError:
                await ctx.send(f"@{ctx.author.name} [ERROR] Количество должно быть числом")
                return

            if amount <= 0:
                await ctx.send(f"@{ctx.author.name} [ERROR] Количество должно быть больше 0")
                return

            from repositories.user_repository import UserRepository
            user = UserRepository(db).get_by_twitch_username(ctx.channel.name)
            if not user:
                await ctx.send(f"@{ctx.author.name} [ERROR] Канал не найден")
                return

            service = MemeAlertsService(db)
            result = await service.grant_coins(
                user_id=user.id,
                nickname_or_id=nickname,
                amount=amount,
                platform="twitch",
                channel_name=ctx.channel.name,
                issued_by=ctx.author.name,
                source="command",
            )

            if result.get("success"):
                await ctx.send(f"@{ctx.author.name} [OK] Выдано {amount} мемкоинов пользователю {nickname}")
            else:
                await ctx.send(f"@{ctx.author.name} [ERROR] {result.get('error', 'Не удалось выдать мемкоины')}")

        except Exception as e:
            self.logger.error(f"Error in !memegrant handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} [ERROR] Ошибка выдачи мемкоинов")

    async def _handle_memegrant_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler for !memegrant (VK)"""
        try:
            if not args:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [ERROR] Использование: !memegrant <nickname> <amount>")
                return

            parts = args.split()
            if len(parts) < 2:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [ERROR] Использование: !memegrant <nickname> <amount>")
                return

            nickname = parts[0].lstrip("@")
            try:
                amount = int(parts[1])
            except ValueError:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [ERROR] Количество должно быть числом")
                return

            if amount <= 0:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [ERROR] Количество должно быть больше 0")
                return

            from repositories.user_repository import UserRepository
            user = UserRepository(db).get_by_vk_username(channel_name)
            if not user:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [ERROR] Канал не найден")
                return

            service = MemeAlertsService(db)
            result = await service.grant_coins(
                user_id=user.id,
                nickname_or_id=nickname,
                amount=amount,
                platform="vk",
                channel_name=channel_name,
                issued_by=author_name,
                source="command",
            )

            if result.get("success"):
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [OK] Выдано {amount} мемкоинов пользователю {nickname}")
            else:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [ERROR] {result.get('error', 'Не удалось выдать мемкоины')}")

        except Exception as e:
            self.logger.error(f"Error in !memegrant VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name,
                f"@{author_name} [ERROR] Ошибка выдачи мемкоинов")
