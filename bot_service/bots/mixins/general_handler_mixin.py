# features/commands/mixins/general_handler_mixin.py
"""Mixin for General commands (Help, YouTube Volume, Analyze)"""
import logging

logger = logging.getLogger(__name__)


class GeneralHandlerMixin:
    """Mixin for processing general commands"""

    # Expected attributes/methods from main class
    logger: logging.Logger

    async def _handle_help(self, ctx, bot, args, platform, db):
        """Handler для !help (Twitch) - показывает только основные команды"""
        try:
            # Получаем user_id владельца канала
            # Получаем user_id владельца канала
            from repositories.user_repository import UserRepository
            user = UserRepository(db).get_by_twitch_username(ctx.channel.name)

            if not user:
                await ctx.send(f"@{ctx.author.name} [ERROR] Канал не найден")
                return

            # Получаем доступные команды
            from repositories.command_repository import CommandRepository
            command_repo = CommandRepository(db)
            
            # Основные команды для отображения (по порядку важности)
            core_command_names = ['sr', 'voice', 'queue', 'title', 'game', 'ttsvolume']

            # Получаем все команды (global + override + custom для этого пользователя)
            all_commands = command_repo.get_all_enabled_commands(user.id, 'twitch')

            # Убираем дубликаты по имени команды (override > global)
            # Сначала добавляем override, потом global
            commands_by_name = {}
            for cmd in sorted(all_commands, key=lambda x: (x.command_type == 'global', x.command_name)):
                if cmd.command_name not in commands_by_name:
                    commands_by_name[cmd.command_name] = cmd

            # Фильтруем только основные команды в заданном порядке
            featured_commands = []
            for core_name in core_command_names:
                if core_name in commands_by_name:
                    featured_commands.append(commands_by_name[core_name])

            # Определяем название команды voice (может быть переименована пользователем)
            voice_cmd_name = 'voice'  # Дефолтное значение
            if 'voice' in commands_by_name:
                voice_cmd_name = commands_by_name['voice'].command_name

            # Формируем список команд
            cmd_list = []
            for cmd in featured_commands:
                cmd_list.append(f"!{cmd.command_name}")

            if cmd_list:
                commands_text = ", ".join(cmd_list)
                help_text = (
                    f"[LIST] Команды: {commands_text} | "
                    f"[TTS] !{voice_cmd_name} <имя> (Алёна/Дмитрий/random) | "
                    f"[VOLUME] TTS в дашборде → выбрать платформу → включить. Громкость: !ttsvolume <0-100>"
                )
                await ctx.send(help_text)
            else:
                await ctx.send(f"@{ctx.author.name} [INFO] Команды не найдены")

        except Exception as e:
            self.logger.error(f"Error in !help handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} [ERROR] Ошибка получения списка команд")

    async def _handle_help_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !help (VK) - показывает только основные команды"""
        try:
            # Получаем user_id владельца канала
            # Получаем user_id владельца канала
            from repositories.user_repository import UserRepository
            user = UserRepository(db).get_by_vk_username(channel_name)

            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} [ERROR] Канал не найден")
                return

            # Получаем доступные команды
            from repositories.command_repository import CommandRepository
            command_repo = CommandRepository(db)

            # Основные команды для отображения (по порядку важности)
            core_command_names = ['sr', 'voice', 'queue', 'title', 'game', 'ttsvolume']

            # Получаем все команды (global + override + custom для этого пользователя)
            all_commands = command_repo.get_all_enabled_commands(user.id, 'vk')

            # Убираем дубликаты по имени команды (override > global)
            # Сначала добавляем override, потом global
            commands_by_name = {}
            for cmd in sorted(all_commands, key=lambda x: (x.command_type == 'global', x.command_name)):
                if cmd.command_name not in commands_by_name:
                    commands_by_name[cmd.command_name] = cmd

            # Фильтруем только основные команды в заданном порядке
            featured_commands = []
            for core_name in core_command_names:
                if core_name in commands_by_name:
                    featured_commands.append(commands_by_name[core_name])

            # Определяем название команды voice (может быть переименована пользователем)
            voice_cmd_name = 'voice'  # Дефолтное значение
            if 'voice' in commands_by_name:
                voice_cmd_name = commands_by_name['voice'].command_name

            # Формируем список команд
            cmd_list = []
            for cmd in featured_commands:
                cmd_list.append(f"!{cmd.command_name}")

            if cmd_list:
                commands_text = ", ".join(cmd_list)
                help_text = (
                    f"[LIST] Команды: {commands_text} | "
                    f"[TTS] !{voice_cmd_name} <имя> (Алёна/Дмитрий/random) | "
                    f"[VOLUME] TTS в дашборде → выбрать платформу → включить. Громкость: !ttsvolume <0-100>"
                )
                await vk_bot.send_message(channel_name, help_text)
            else:
                await vk_bot.send_message(channel_name, f"@{author_name} [INFO] Команды не найдены")

        except Exception as e:
            self.logger.error(f"Error in !help VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name,
                f"@{author_name} [ERROR] Ошибка получения списка команд")

    async def _handle_ytvolume(self, ctx, bot, args, platform, db):
        """Handler для !ytvolume (Twitch)"""
        try:
            if not args:
                await ctx.send(f"@{ctx.author.name} [ERROR] Использование: !ytvolume <0-100>")
                return

            try:
                volume = int(args)
                if not 0 <= volume <= 100:
                    raise ValueError
            except ValueError:
                await ctx.send(f"@{ctx.author.name} [ERROR] Громкость должна быть от 0 до 100")
                return

            # Получаем user_id владельца канала
            # Получаем user_id владельца канала
            from repositories.user_repository import UserRepository
            user = UserRepository(db).get_by_twitch_username(ctx.channel.name)

            if not user:
                await ctx.send(f"@{ctx.author.name} [ERROR] Канал не найден")
                return

            # Устанавливаем громкость YouTube через UserSettings
            from repositories.user_settings_repository import UserSettingsRepository
            settings_repo = UserSettingsRepository(db)
            settings = settings_repo.get_or_create(user_id=user.id)
            settings_repo.update_settings(settings, {"youtube_volume": volume})
            db.commit()

            await ctx.send(f"@{ctx.author.name} [AUDIO] Громкость YouTube: {volume}%")
            self.logger.info(f"[OK] YouTube volume set to {volume}% for {ctx.channel.name}")

        except Exception as e:
            self.logger.error(f"Error in !ytvolume handler: {e}", exc_info=True)
            db.rollback()
            await ctx.send(f"@{ctx.author.name} [ERROR] Ошибка изменения громкости")

    async def _handle_ytvolume_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !ytvolume (VK)"""
        try:
            if not args:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [ERROR] Использование: !ytvolume <0-100>")
                return

            try:
                volume = int(args)
                if not 0 <= volume <= 100:
                    raise ValueError
            except ValueError:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [ERROR] Громкость должна быть от 0 до 100")
                return

            # Получаем user_id владельца канала
            # Получаем user_id владельца канала
            from repositories.user_repository import UserRepository
            user = UserRepository(db).get_by_vk_username(channel_name)

            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} [ERROR] Канал не найден")
                return

            # Устанавливаем громкость YouTube через UserSettings
            from repositories.user_settings_repository import UserSettingsRepository
            settings_repo = UserSettingsRepository(db)
            settings = settings_repo.get_or_create(user_id=user.id)
            settings_repo.update_settings(settings, {"youtube_volume": volume})
            db.commit()

            await vk_bot.send_message(channel_name,
                f"@{author_name} [AUDIO] Громкость YouTube: {volume}%")
            self.logger.info(f"[OK] YouTube volume set to {volume}% for VK {channel_name}")

        except Exception as e:
            self.logger.error(f"Error in !ytvolume VK handler: {e}", exc_info=True)
            db.rollback()
            await vk_bot.send_message(channel_name,
                f"@{author_name} [ERROR] Ошибка изменения громкости")

    async def _handle_analyze(self, ctx, bot, args, platform, db):
        """Handler для !analyze (Twitch)"""
        try:
            if not args:
                await ctx.send(f"@{ctx.author.name} [ERROR] Использование: !analyze <username>")
                return

            target_username = args.strip().split()[0].lstrip('@')
            if not target_username:
                await ctx.send(f"@{ctx.author.name} [ERROR] Укажите пользователя для анализа")
                return

            from repositories.user_repository import UserRepository
            user = UserRepository(db).get_by_twitch_username(ctx.channel.name)

            if not user:
                await ctx.send(f"@{ctx.author.name} [ERROR] Канал не найден")
                return

            from services.psychology_service import PsychologyService
            service = PsychologyService(db)
            result = await service.analyze_user_psychology(
                target_username=target_username,
                platform=platform,
                analyzed_by_user_id=user.id,
                analyzed_by_username=ctx.author.name,
                channel_name=ctx.channel.name
            )

            if result:
                await ctx.send(result)
            else:
                await ctx.send(f"@{ctx.author.name} [ERROR] Не удалось выполнить анализ")

            self.logger.info(f"!analyze completed for {target_username} on {ctx.channel.name}")
        except Exception as e:
            self.logger.error(f"Error in !analyze handler: {e}", exc_info=True)

    async def _handle_analyze_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !analyze (VK)"""
        try:
            if not args:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [ERROR] Использование: !analyze <username>")
                return

            target_username = args.strip().split()[0].lstrip('@')
            if not target_username:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [ERROR] Укажите пользователя для анализа")
                return

            from repositories.user_repository import UserRepository
            user = UserRepository(db).get_by_vk_username(channel_name)

            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} [ERROR] Канал не найден")
                return

            from services.psychology_service import PsychologyService
            service = PsychologyService(db)
            result = await service.analyze_user_psychology(
                target_username=target_username,
                platform='vk',
                analyzed_by_user_id=user.id,
                analyzed_by_username=author_name,
                channel_name=channel_name
            )

            if result:
                await vk_bot.send_message(channel_name, result)
            else:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} [ERROR] Не удалось выполнить анализ")

            self.logger.info(f"!analyze completed for {target_username} on VK {channel_name}")
        except Exception as e:
            self.logger.error(f"Error in !analyze VK handler: {e}", exc_info=True)
