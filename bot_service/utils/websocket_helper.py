# bot_service/utils/websocket_helper.py
"""Вспомогательные функции для работы с WebSocket"""
import json
import uuid
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional

# Импортируем константы для TTS
from constants import TTS_DEFAULT_VOLUME

logger = logging.getLogger('bot_service')


async def broadcast_chat_message(
    username: str,
    content: str,
    platform: str,
    channel: str,
    message_id: Optional[str] = None,
    role: Optional[str] = None,
    badges: Optional[list] = None
) -> bool:
    """
    Отправить сообщение чата во все WebSocket соединения
    
    Args:
        username: Имя пользователя
        content: Содержимое сообщения
        platform: Платформа (twitch, vk, youtube, etc.)
        channel: Название канала
        message_id: ID сообщения (опционально, если None - генерируется автоматически)
        role: Роль пользователя (broadcaster, moderator, vip, subscriber)
        badges: Список значков пользователя ["broadcaster/1", "subscriber/12"]
    
    Returns:
        bool: True если сообщение отправлено хотя бы одному клиенту
    """
    try:
        from services.memory_websocket_manager import memory_websocket_manager
        from core.database import SessionLocal, ChatMessage, User, UserToken
        
        logger.info(f"📨 [BROADCAST] Incoming message: {platform}:{channel} | {username}: {content[:50]}")
        
        # Формируем сообщение для фронтенда
        # Используем все варианты полей для совместимости с разными компонентами
        import time
        chat_data = {
            "type": "message",  # Основной тип для ChatContext
            "id": message_id or str(uuid.uuid4()),
            "author": username,
            "author_name": username,
            "username": username,
            "content": content,
            "message": content,
            "text": content,
            "platform": platform,
            "channel": channel,
            "role": role,  # Роль пользователя (broadcaster, moderator, vip, subscriber)
            "badges": badges,  # Список значков
            "timestamp": int(time.time() * 1000)  # Миллисекунды (JavaScript Date.now() формат)
        }
        
        # Пытаемся сохранить сообщение в БД для истории
        try:
            db = SessionLocal()
            try:
                # Находим владельца канала для сохранения user_id
                user_id = None
                
                if platform == 'twitch':
                    # Ищем пользователя по имени канала Twitch (case-insensitive)
                    from sqlalchemy import func
                    channel_owner = db.query(User).filter(
                        func.lower(User.twitch_username) == channel.lower()
                    ).first()
                    if channel_owner:
                        user_id = channel_owner.id
                        logger.debug(f"✅ Found channel owner: user_id={user_id} for twitch channel {channel}")
                    else:
                        logger.warning(f"⚠️ Could not find Twitch channel owner for: {channel}")
                elif platform == 'vk':
                    # Ищем пользователя по имени канала VK (vk_channel_name или vk_username) - case-insensitive
                    from sqlalchemy import func
                    channel_owner = db.query(User).filter(
                        (func.lower(User.vk_channel_name) == channel.lower()) | (func.lower(User.vk_username) == channel.lower())
                    ).first()
                    if channel_owner:
                        user_id = channel_owner.id
                        logger.debug(f"✅ Found channel owner: user_id={user_id} for VK channel {channel}")
                    else:
                        logger.warning(f"⚠️ Could not find VK channel owner for: {channel}")
                
                # Если нашли владельца канала, сохраняем сообщение
                if user_id:
                    logger.info(f"💾 [DB] Saving message: user_id={user_id}, channel={channel}, platform={platform}, author={username}, role={role}")
                    try:
                        chat_message = ChatMessage(
                            user_id=user_id,
                            channel_name=channel,
                            platform=platform,
                            author_username=username,  # Сохраняем имя пользователя из чата
                            message=content,
                            role=role,  # Роль пользователя
                            badges=badges  # Значки пользователя (JSON массив)
                        )
                        db.add(chat_message)
                        db.flush()  # Получаем ID без commit (для проверки)
                        db.commit()
                        logger.info(f"💾 [DB] Message saved: ID={chat_message.id}, {platform}:{channel} from {username} (role={role}, badges={badges})")
                    except Exception as db_error:
                        # Обрабатываем ошибку UniqueViolation (конфликт ID в PostgreSQL)
                        if 'UniqueViolation' in str(db_error) or 'duplicate key' in str(db_error).lower():
                            logger.warning(f"⚠️ [DB] ID conflict detected, fixing sequence and retrying...")
                            db.rollback()
                            
                            # Исправляем sequence для PostgreSQL
                            try:
                                # Получаем максимальный ID из таблицы
                                from sqlalchemy import func, text
                                max_id_result = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM chat_messages"))
                                max_id = max_id_result.scalar() or 0
                                
                                # Обновляем sequence до максимального ID + 1
                                db.execute(text(f"SELECT setval('chat_messages_id_seq', {max_id + 1}, false)"))
                                db.commit()
                                
                                logger.info(f"✅ [DB] Sequence fixed: set to {max_id + 1}")
                                
                                # Повторяем попытку сохранения
                                chat_message = ChatMessage(
                                    user_id=user_id,
                                    channel_name=channel,
                                    platform=platform,
                                    author_username=username,
                                    message=content,
                                    role=role,
                                    badges=badges
                                )
                                db.add(chat_message)
                                db.commit()
                                logger.info(f"💾 [DB] Message saved after retry: ID={chat_message.id}, {platform}:{channel} from {username}")
                            except Exception as seq_error:
                                logger.error(f"❌ [DB] Failed to fix sequence: {seq_error}")
                                db.rollback()
                                # Продолжаем без сохранения в БД, но отправляем сообщение
                        else:
                            # Другая ошибка - логируем и продолжаем
                            logger.error(f"❌ [DB] Unexpected error saving message: {db_error}")
                            db.rollback()
                else:
                    logger.warning(f"⚠️ [DB] Could not find channel owner for {platform}:{channel}, skipping DB save")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"❌ [DB] Failed to save message: {e}", exc_info=True)
        
        # Отправляем всем подключенным клиентам
        total_connections = len(memory_websocket_manager.connections)
        logger.info(f"📨 [BROADCAST] Total WebSocket connections: {total_connections}")
        
        if total_connections == 0:
            logger.debug(f"⚠️ No WebSocket connections available for {platform} message")
            return False
        
        # ✅ ОПТИМИЗАЦИЯ: Batch отправка для лучшей производительности
        sent_count = 0
        message_json = json.dumps(chat_data)
        
        # Создаем список задач для параллельной отправки
        async def send_to_connection(conn_id: str, conn):
            try:
                await conn.websocket.send_text(message_json)
                return True
            except Exception as e:
                logger.error(f"❌ Failed to send {platform} message to {conn_id}: {e}")
                return False
        
        send_tasks = [
            send_to_connection(conn_id, connection)
            for conn_id, connection in memory_websocket_manager.connections.items()
        ]
        
        # Выполняем все отправки параллельно
        if send_tasks:
            results = await asyncio.gather(*send_tasks, return_exceptions=True)
            sent_count = sum(1 for r in results if r is True)
        
        logger.info(f"📤 {platform.upper()} message sent to {sent_count}/{total_connections} connections")
        return sent_count > 0
        
    except Exception as e:
        logger.error(f"❌ WebSocket broadcast error for {platform}: {e}")
        return False


async def handle_tts_for_message(
    text: str,
    username: str,
    channel_identifier: str,
    platform: str,
    tts_api,
    connection_manager,
    skip_if_command: bool = True,
    is_reply: bool = False,
    mentioned_users: list = None,
    reward_id: str = None  # NEW! ID награды если сообщение с наградой
) -> Dict[str, Any]:
    """
    Обработать TTS для сообщения
    
    Args:
        text: Текст сообщения
        username: Имя пользователя
        channel_identifier: Идентификатор канала (channel_name для Twitch, channel_id для VK)
        platform: Платформа (twitch, vk, etc.)
        tts_api: Экземпляр TTSAPI
        connection_manager: Менеджер соединений
        skip_if_command: Пропустить команды (начинаются с !)
        is_reply: Является ли сообщение ответом (reply)
        mentioned_users: Список упомянутых пользователей (@username)
        reward_id: ID награды если сообщение отправлено с наградой Channel Points
    
    Returns:
        Dict с результатом: {"success": bool, "error": str|None, "tts_type": str|None}
    """
    try:
        # Пропускаем команды если указано
        if skip_if_command and text.strip().startswith('!'):
            logger.info(f"⏭️ [{platform.upper()} TTS] Skipping command: {text[:50]}")
            return {"success": False, "error": "Message is a command"}
        
        logger.info(f"🎙️ [{platform.upper()} TTS] Processing message for TTS: '{text[:50]}...'")
        
        # ✅ ВАЖНО: is_tts_enabled() определяет ПОПЫТАЕМСЯ ЛИ МЫ AI TTS
        # Но НЕ БЛОКИРУЕТ базовую TTS как fallback!
        use_ai_tts_requested = False
        if connection_manager:
            use_ai_tts_requested = connection_manager.is_tts_enabled(channel_identifier)
            logger.info(f"🔍 [{platform.upper()} TTS] connection_manager.is_tts_enabled({channel_identifier}) = {use_ai_tts_requested}")
            logger.info(f"🔍 [{platform.upper()} TTS] Will try AI TTS: {use_ai_tts_requested}")
        else:
            logger.warning(f"⚠️ [{platform.upper()} TTS] No connection_manager, will check user settings")
        
        # Проверяем блокировку пользователя
        from api.moderation_api import is_user_blocked_from_tts
        if is_user_blocked_from_tts(channel_identifier, platform, username.lower()):
            logger.warning(f"⛔ User {username} is blocked from TTS in {platform} channel {channel_identifier}")
            return {"success": False, "error": "User is blocked from TTS"}
        
        # Получаем настройки пользователя для канала
        from core.database import SessionLocal, User, UserToken
        db = SessionLocal()
        try:
            # Проверяем заблокированных ботов (Nightbot, StreamElements, наш бот и т.д.)
            # ✅ ОПТИМИЗАЦИЯ: Используем кешированную проверку
            from utils.blocked_bot_cache import is_bot_blocked_cached
            if is_bot_blocked_cached(username, db):
                logger.debug(f"🤖 Bot {username} is in blocked list, skipping TTS")
                return {"success": False, "error": "Bot is blocked from TTS"}
            
            # Находим владельца канала
            # Case-insensitive поиск для всех платформ
            from sqlalchemy import func
            
            if platform == 'twitch':
                channel_owner = db.query(User).filter(
                    func.lower(User.twitch_username) == channel_identifier.lower()
                ).first()
            elif platform == 'vk':
                # Для VK ищем по vk_channel_name (nickname канала) - case-insensitive
                channel_owner = db.query(User).filter(
                    func.lower(User.vk_channel_name) == channel_identifier.lower()
                ).first()
                
                # Если не нашли по channel_name, пробуем по platform_user_id
                if not channel_owner:
                    user_token = db.query(UserToken).filter(
                        UserToken.platform == 'vk',
                        UserToken.platform_user_id == channel_identifier
                    ).first()
                    channel_owner = user_token.user if user_token else None
            else:
                logger.warning(f"Unknown platform: {platform}")
                return {"success": False, "error": f"Unknown platform: {platform}"}
            
            if not channel_owner:
                logger.warning(f"❌ [{platform.upper()} TTS] No user found for channel {channel_identifier}")
                return {"success": False, "error": "Channel owner not found"}
            
            user_id = channel_owner.id
            
            # ✅ КРИТИЧЕСКИ ВАЖНО: Проверяем включен ли ГЛОБАЛЬНО TTS для пользователя!
            if not channel_owner.tts_enabled:
                logger.info(f"ℹ️ [{platform.upper()} TTS] TTS is DISABLED GLOBALLY for user {user_id}")
                return {"success": False, "error": "TTS is disabled for this user"}
            
            # ✅ ОПТИМИЗАЦИЯ: Загружаем все настройки одним запросом с JOIN
            from core.database import TTSUserSettings, AudioSettings, LocalTTSEndpoint, UserVoiceSettings
            from sqlalchemy.orm import joinedload
            
            # Загружаем TTS настройки
            tts_user_settings = db.query(TTSUserSettings).filter(TTSUserSettings.user_id == user_id).first()
            audio_settings = db.query(AudioSettings).filter(AudioSettings.user_id == user_id).first()
            local_tts = db.query(LocalTTSEndpoint).filter(LocalTTSEndpoint.user_id == user_id).first()
            
            # Если настроек нет - создаем дефолтные
            if not tts_user_settings:
                logger.info(f"Creating default TTS settings for user {user_id}")
                tts_user_settings = TTSUserSettings(
                    user_id=user_id,
                    engine='gtts',
                    voice='female_1',
                    listening_mode='website',
                    tts_mode='all_messages',
                    tts_reward_ids={}
                )
                db.add(tts_user_settings)
                db.commit()
            
            # ✅ НОВАЯ ЛОГИКА: Проверяем режим TTS (все сообщения / за баллы)
            if tts_user_settings.tts_mode == 'channel_points':
                logger.info(f"🎁 [{platform.upper()} TTS] Channel Points mode enabled")
                
                # Проверяем есть ли награда TTS для этой платформы
                tts_reward_ids = tts_user_settings.tts_reward_ids or {}
                if platform not in tts_reward_ids:
                    logger.warning(f"❌ [{platform.upper()} TTS] No TTS reward configured for {platform}")
                    return {"success": False, "error": f"TTS reward not configured for {platform}"}
                
                expected_reward_id = tts_reward_ids[platform]
                logger.info(f"💎 [{platform.upper()} TTS] Expected reward ID: {expected_reward_id}")
                
                # Проверяем что сообщение пришло с правильной наградой
                if not reward_id:
                    logger.warning(f"❌ [{platform.upper()} TTS] Message not from reward redemption, skipping")
                    return {"success": False, "error": "Message not from TTS reward"}
                
                if reward_id != expected_reward_id:
                    logger.warning(f"❌ [{platform.upper()} TTS] Wrong reward ID: {reward_id} != {expected_reward_id}")
                    return {"success": False, "error": "Message from different reward"}
                
                logger.info(f"✅ [{platform.upper()} TTS] Message from correct TTS reward! Processing...")
            
            # ✅ НОВАЯ ЛОГИКА: Определяем главный engine, но ВСЕГДА включаем fallback
            use_ai_tts = (tts_user_settings.engine == 'f5tts')
            use_basic_tts = True  # ✅ ВСЕГДА включаем базовую TTS как fallback (даже если engine='f5tts')
            
            # ✅ ПРИОРИТЕТ: use_ai_tts_requested из connection_manager может ОТКЛЮЧИТЬ AI TTS
            # Это позволяет включить/отключить AI в реальном времени для канала
            if use_ai_tts and not use_ai_tts_requested:
                logger.info(f"🎙️ [{platform.upper()} TTS] AI TTS disabled via connection_manager for channel")
                use_ai_tts = False
                use_basic_tts = True  # Используем baseTTS как fallback
            
            # ✅ ВАЖНО: Если пользователь не выбрал explicit engine, 
            # или engine не установлен - ИСПОЛЬЗУЕМ БАЗОВУЮ TTS КАК DEFAULT
            if not use_ai_tts and not use_basic_tts:
                logger.info(f"🎙️ [{platform.upper()} TTS] Engine not set, using basic TTS as default")
                use_basic_tts = True
            
            # Проверяем локальный TTS endpoint если выбран F5-TTS
            has_local_endpoint = use_ai_tts and local_tts and local_tts.use_local
            
            # Проверяем whitelist ТОЛЬКО для облачного F5-TTS (если нет локального endpoint)
            if use_ai_tts and not has_local_endpoint:
                from core.database import WhitelistedChannel
                is_whitelisted = False
                
                # Проверяем по Twitch username
                if channel_owner.twitch_username:
                    twitch_whitelisted = db.query(WhitelistedChannel).filter(
                        WhitelistedChannel.channel_name == channel_owner.twitch_username.lower()
                    ).first()
                    is_whitelisted = bool(twitch_whitelisted)
                
                # Проверяем по VK username если не найден в Twitch
                if not is_whitelisted and channel_owner.vk_username:
                    vk_whitelisted = db.query(WhitelistedChannel).filter(
                        WhitelistedChannel.channel_name == channel_owner.vk_username.lower()
                    ).first()
                    is_whitelisted = bool(vk_whitelisted)
                
                # Если не в whitelist - fallback на gTTS
                if not is_whitelisted:
                    logger.warning(f"⚠️ [{platform.upper()} TTS] User {user_id} not in whitelist, falling back to gTTS")
                    use_ai_tts = False
                    use_basic_tts = True
            
            if has_local_endpoint:
                logger.info(f"🏠 [{platform.upper()} TTS] Using local TTS endpoint for user {user_id}: {local_tts.endpoint_url}")
            
            # ===== ПРОВЕРКА ВКЛЮЧЕННЫХ ПЛАТФОРМ =====
            # NOTE: Для базовой реализации все платформы включены по умолчанию
            # Можно добавить кастомное поле enabled_platforms в TTSUserSettings при необходимости
            # ===== ФИЛЬТРАЦИЯ ТЕКСТА И ПРОВЕРКА ПОЛЬЗОВАТЕЛЯ =====
            
            # ✅ ОПТИМИЗАЦИЯ: Проверяем фильтры слов и применяем их эффективнее
            from core.database import FilteredWord
            filtered_words = db.query(FilteredWord).filter(
                FilteredWord.user_id == user_id,
                FilteredWord.is_active == True,
                (FilteredWord.platform == 'all') | (FilteredWord.platform == platform)
            ).all()
            
            # ✅ ОПТИМИЗАЦИЯ: Применяем фильтры к тексту более эффективно
            filtered_text = text
            if filtered_words:
                import re
                # Создаем паттерн для всех слов сразу
                words_pattern = '|'.join(re.escape(fw.word.lower()) for fw in filtered_words)
                if words_pattern:
                    # Заменяем все слова одним regex вызовом
                    filtered_text = re.sub(
                        words_pattern,
                        lambda m: '*' * len(m.group(0)),
                        filtered_text,
                        flags=re.IGNORECASE
                    )
            
            # Проверяем заблокированного пользователя
            from core.database import TTSBlockedUser
            is_blocked = db.query(TTSBlockedUser).filter(
                TTSBlockedUser.user_id == user_id,
                TTSBlockedUser.username == username.lower(),
                TTSBlockedUser.platform == platform
            ).first()
            
            if is_blocked:
                logger.info(f"⛔ User {username} is blocked from TTS by owner")
                db.close()
                return {"success": False, "error": "User is blocked from TTS"}
            
            # 🛡️ ФИЛЬТР ОТВЕТОВ (если включен)
            if tts_user_settings.filter_replies and is_reply:
                logger.info(f"⏭️ [{platform.upper()} TTS] Skipping reply message (filter_replies=True)")
                db.close()
                return {"success": False, "error": "Reply messages are filtered"}
            
            # 🛡️ ФИЛЬТР УПОМИНАНИЙ (если включен)
            if tts_user_settings.filter_mentions and mentioned_users:
                # Проверяем есть ли упоминания в тексте (через @ или просто список)
                has_mentions = False
                if mentioned_users and len(mentioned_users) > 0:
                    has_mentions = True
                else:
                    # Дополнительная проверка через regex для @username
                    import re
                    mention_pattern = r'@\w+'
                    if re.search(mention_pattern, text):
                        has_mentions = True
                
                if has_mentions:
                    logger.info(f"⏭️ [{platform.upper()} TTS] Skipping message with mentions (filter_mentions=True)")
                    db.close()
                    return {"success": False, "error": "Messages with mentions are filtered"}
            
            # Используем отфильтрованный текст для TTS
            text_for_tts = filtered_text
            
            # Загружаем персональные настройки голоса пользователя (если есть)
            # 🚀 FIX: Если персональных настроек нет, не передаем voice_settings вообще,
            # чтобы tts_engine.py использовал дефолтные настройки из таблицы Voice
            tts_settings_dict = {
                "enable7TV": tts_user_settings.enable_7tv,
                "enableTwitch": tts_user_settings.enable_twitch,
                "enableProfanity": tts_user_settings.enable_lexicon_filter,
                "maxLength": tts_user_settings.max_message_length,
                "skipCommands": tts_user_settings.skip_commands,
                "voice": tts_user_settings.voice  # ✅ Передаем голос пользователя
            }
            
            # 🚀 FIX: Базовая громкость из AudioSettings (дефолт от админа/системы)
            # TTS_DEFAULT_VOLUME уже импортирован в начале файла
            base_volume_level = audio_settings.website_volume if audio_settings else TTS_DEFAULT_VOLUME
            if tts_user_settings.listening_mode == 'obs':
                base_volume_level = audio_settings.obs_volume if audio_settings else TTS_DEFAULT_VOLUME
            
            # 🚀 FIX: Загружаем персональные настройки голоса и применяем volume
            user_voice_config = None
            if use_ai_tts and tts_user_settings.voice:
                # Получаем voice_id из TTS Service по имени голоса
                # NOTE: Для полной интеграции нужно запрашивать voice_id из tts_service
                # Пока передаем имя голоса и настройки напрямую
                user_voice_config = db.query(UserVoiceSettings).filter(
                    UserVoiceSettings.user_id == user_id,
                    UserVoiceSettings.voice_name == tts_user_settings.voice
                ).first()
                
                if user_voice_config:
                    # ✅ Передаем персональные настройки только если они есть
                    # Если их нет, tts_engine.py использует дефолтные из таблицы Voice
                    voice_settings_dict = {}
                    
                    # ✅ cfg_strength: персональный или None (будет использован дефолт из Voice)
                    if user_voice_config.cfg_strength is not None:
                        voice_settings_dict["cfg_strength"] = user_voice_config.cfg_strength
                    
                    # ✅ speed_preset: персональный или None (будет использован дефолт из Voice)
                    if user_voice_config.speed_preset is not None:
                        voice_settings_dict["speed_preset"] = user_voice_config.speed_preset
                    
                    # ✅ volume обрабатывается отдельно через final_volume_level (не передаем в voice_settings)
                    # volume будет применен через параметр volume_level функции
                    
                    if voice_settings_dict:
                        tts_settings_dict["voice_settings"] = voice_settings_dict
                        logger.info(f"🎛️ [{platform.upper()} TTS] Using personal voice settings: {voice_settings_dict}")
                else:
                    # ✅ Персональных настроек нет - tts_engine.py использует дефолты из Voice таблицы
                    logger.debug(f"🎛️ [{platform.upper()} TTS] No personal voice settings found, will use defaults from Voice table")
            
            # 🚀 FIX: Финальная громкость: персональный volume из voice_settings или базовый
            final_volume_level = base_volume_level
            if user_voice_config and user_voice_config.volume is not None:
                final_volume_level = user_voice_config.volume
                logger.debug(f"🔊 [{platform.upper()} TTS] Using personal volume: {final_volume_level}% (base: {base_volume_level}%)")
            else:
                logger.debug(f"🔊 [{platform.upper()} TTS] Using base volume: {final_volume_level}%")
            
            # Отправляем запрос на TTS с настройками пользователя
            logger.info(f"🎙️ [{platform.upper()} TTS] Processing: {username}: {text[:50]}... (engine={tts_user_settings.engine}, volume={final_volume_level}%)")
            
            result = await tts_api.send_tts_request(
                channel_name=channel_identifier,
                text=text_for_tts, # Используем отфильтрованный текст
                author=username,
                user_id=user_id,
                volume_level=final_volume_level,  # ✅ Используем финальную громкость (персональную или базовую)
                use_ai_tts=use_ai_tts,
                use_basic_tts=use_basic_tts,
                connection_manager=connection_manager,
                tts_settings=tts_settings_dict
            )
            
            if result.get("success"):
                tts_type = result.get("tts_type", "unknown")
                logger.info(f"✅ [{platform.upper()} TTS] Message queued: {username} ({tts_type})")
                logger.info(f"✅ [{platform.upper()} TTS] Audio URL: {result.get('audio_url')}")
                logger.info(f"✅ [{platform.upper()} TTS] Voice: {result.get('voice', 'unknown')}")
                logger.info(f"✅ [{platform.upper()} TTS] Duration: {result.get('duration', 0)}s")
                
                # ✅ Автоматическое принятие наград TTS для VK и Twitch
                if reward_id and tts_user_settings.tts_mode == 'channel_points':
                    try:
                        from core.database import UserToken
                        from core.token_encryption import decrypt_token as decrypt_access_token
                        from api.points_api_endpoints import _decrypt_access_token, _get_vk_channel_name
                        
                        if platform == 'vk':
                            # ✅ Автоматическое принятие для VK
                            from api.vk_api import vk_api
                            
                            # Получаем токен VK
                            user_token = db.query(UserToken).filter(
                                UserToken.user_id == user_id,
                                UserToken.platform == 'vk'
                            ).first()
                            
                            if user_token:
                                channel_name = _get_vk_channel_name(user_id, db)
                                if channel_name:
                                    # Получаем активные demands для TTS награды
                                    demands_data = await vk_api.get_reward_demands(
                                        channel_url=channel_name,
                                        access_token=decrypt_access_token(user_token.access_token),
                                        limit=50,
                                        offset=0
                                    )
                                    
                                    if demands_data and isinstance(demands_data, dict):
                                        demands_list = demands_data.get("demands", []) or demands_data.get("items", []) or []
                                        if isinstance(demands_list, list):
                                            # Фильтруем demands для TTS награды
                                            tts_demands = [
                                                demand for demand in demands_list
                                                if isinstance(demand, dict) and 
                                                str(demand.get("reward_id") or demand.get("reward", {}).get("id", "")) == str(reward_id)
                                            ]
                                            
                                            if tts_demands:
                                                # Извлекаем ID demands
                                                demand_ids = [
                                                    int(demand.get("id") or demand.get("demand_id", 0))
                                                    for demand in tts_demands
                                                    if demand.get("id") or demand.get("demand_id")
                                                ]
                                                
                                                if demand_ids:
                                                    # ✅ Автоматически принимаем награды TTS
                                                    accept_result = await vk_api.accept_reward_demands(
                                                        channel_url=channel_name,
                                                        access_token=decrypt_access_token(user_token.access_token),
                                                        demand_ids=demand_ids
                                                    )
                                                    if accept_result:
                                                        logger.info(f"✅ [VK TTS] Auto-accepted {len(demand_ids)} TTS reward demands")
                                                    else:
                                                        logger.warning(f"⚠️ [VK TTS] Failed to auto-accept TTS reward demands")
                        
                        elif platform == 'twitch':
                            # ✅ Автоматическое принятие для Twitch
                            from api.twitch_api import TwitchAPI
                            from core.connection_manager import get_connection_manager
                            
                            # Получаем токен Twitch
                            user_token = db.query(UserToken).filter(
                                UserToken.user_id == user_id,
                                UserToken.platform == 'twitch',
                                UserToken.is_active == True
                            ).first()
                            
                            if user_token and user_token.platform_user_id:
                                connection_manager = get_connection_manager()
                                twitch_api = TwitchAPI(connection_manager)
                                
                                # Получаем активные redemption для TTS награды
                                try:
                                    redemptions_response = await twitch_api.get_custom_reward_redemptions(
                                        broadcaster_id=user_token.platform_user_id,
                                        reward_id=reward_id,
                                        access_token=_decrypt_access_token(user_token.access_token),
                                        status='UNFULFILLED',  # Только невыполненные
                                        first=50  # Получаем больше для поиска
                                    )
                                    
                                    # Twitch API возвращает {'data': [...]}
                                    redemptions = []
                                    if redemptions_response and isinstance(redemptions_response, dict):
                                        redemptions = redemptions_response.get('data', [])
                                    elif isinstance(redemptions_response, list):
                                        redemptions = redemptions_response
                                    
                                    if redemptions and isinstance(redemptions, list):
                                        # Фильтруем redemption по username (ищем для текущего пользователя)
                                        user_redemptions = [
                                            r for r in redemptions
                                            if r.get('user_login', '').lower() == username.lower() or
                                               r.get('user_name', '').lower() == username.lower()
                                        ]
                                        
                                        # Если не нашли по username, берем последний (самый свежий) UNFULFILLED
                                        target_redemptions = user_redemptions if user_redemptions else redemptions
                                        
                                        # Сортируем по дате (самый свежий последний)
                                        target_redemptions.sort(key=lambda x: x.get('redeemed_at', ''), reverse=False)
                                        
                                        if target_redemptions:
                                            # Берем последний (самый свежий) redemption
                                            latest_redemption = target_redemptions[-1]
                                            latest_redemption_id = latest_redemption.get('id')
                                            
                                            if latest_redemption_id:
                                                # ✅ Автоматически принимаем награду TTS
                                                fulfill_result = await twitch_api.update_redemption_status(
                                                    broadcaster_id=user_token.platform_user_id,
                                                    reward_id=reward_id,
                                                    redemption_id=latest_redemption_id,
                                                    access_token=_decrypt_access_token(user_token.access_token),
                                                    status='FULFILLED'
                                                )
                                                
                                                if fulfill_result:
                                                    logger.info(f"✅ [TWITCH TTS] Auto-fulfilled TTS reward redemption: {latest_redemption_id} for {username}")
                                                else:
                                                    logger.warning(f"⚠️ [TWITCH TTS] Failed to auto-fulfill TTS reward redemption")
                                except Exception as twitch_error:
                                    logger.warning(f"⚠️ [TWITCH TTS] Error getting/fulfilling redemptions: {twitch_error}")
                    except Exception as auto_accept_error:
                        logger.warning(f"⚠️ [{platform.upper()} TTS] Error auto-accepting reward: {auto_accept_error}")
                        # Не прерываем обработку TTS при ошибке принятия награды
                
                # Отправляем готовое аудио на фронтенд через WebSocket
                await broadcast_tts_audio(
                audio_data={
                    "audio_url": result.get("audio_url"),
                    "voice": result.get("voice", "unknown"),
                    "volume": final_volume_level,  # ✅ Исправлено: было volume_level
                    "tts_type": tts_type,
                    "duration": result.get("duration", 0),
                    "text": text,  # Add message text for display
                    "username": username  # Add username for display
                },
                    channel_name=channel_identifier,
                    platform=platform
                )
            else:
                logger.error(f"❌ [{platform.upper()} TTS] Synthesis FAILED")
                logger.error(f"❌ [{platform.upper()} TTS] Result: {result}")
                logger.error(f"❌ [{platform.upper()} TTS] Error: {result.get('error')}")
            
            return result
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ [{platform.upper()} TTS] Error processing TTS: {e}")
        import traceback
        logger.error(f"❌ [{platform.upper()} TTS] Traceback: {traceback.format_exc()}")
        return {"success": False, "error": str(e)}


async def broadcast_tts_audio(
    audio_data: Dict[str, Any],
    channel_name: str,
    platform: str = "twitch"
) -> bool:
    """
    Отправить готовое TTS аудио на фронтенд через WebSocket
    
    Args:
        audio_data: Данные аудио {url, voice, volume, tts_type, duration}
        channel_name: Имя канала
        platform: Платформа (twitch, vk)
    
    Returns:
        bool: True если аудио отправлено хотя бы одному клиенту
    """
    try:
        from services.memory_websocket_manager import memory_websocket_manager
        
        # Формируем событие аудио для фронтенда
        tts_event = {
            "type": "tts_audio",
            "data": {
                "audio_url": audio_data.get("audio_url"),
                "voice": audio_data.get("voice", "unknown"),
                "volume": audio_data.get("volume", TTS_DEFAULT_VOLUME),
                "tts_type": audio_data.get("tts_type", "unknown"),
                "duration": audio_data.get("duration", 0),
                "text": audio_data.get("text", ""),  # Message text for display
                "username": audio_data.get("username", ""),  # Username for display
                "channel": channel_name,
                "platform": platform,
                "timestamp": datetime.now().isoformat()
            }
        }
        
        total_connections = len(memory_websocket_manager.connections)
        
        if total_connections == 0:
            logger.debug(f"⚠️ No WebSocket connections for TTS audio playback")
            return False
        
        # ✅ ОПТИМИЗАЦИЯ: Batch отправка для лучшей производительности
        sent_count = 0
        tts_event_json = json.dumps(tts_event)
        
        # Создаем список задач для параллельной отправки
        async def send_to_connection(conn_id: str, conn):
            try:
                await conn.websocket.send_text(tts_event_json)
                return True
            except Exception as e:
                logger.error(f"❌ Failed to send TTS audio to {conn_id}: {e}")
                return False
        
        send_tasks = [
            send_to_connection(conn_id, connection)
            for conn_id, connection in memory_websocket_manager.connections.items()
        ]
        
        # Выполняем все отправки параллельно
        if send_tasks:
            results = await asyncio.gather(*send_tasks, return_exceptions=True)
            sent_count = sum(1 for r in results if r is True)
        
        logger.info(f"🔊 TTS audio sent to {sent_count}/{total_connections} connections (voice={audio_data.get('voice')})")
        return sent_count > 0
        
    except Exception as e:
        logger.error(f"❌ WebSocket TTS audio broadcast error: {e}")
        return False


async def broadcast_drops_event(drops_data: Dict[str, Any]) -> bool:
    """
    Отправить событие Drops во все WebSocket соединения
    
    Args:
        drops_data: Данные о полученном Drops
    
    Returns:
        bool: True если событие отправлено хотя бы одному клиенту
    """
    try:
        from services.memory_websocket_manager import memory_websocket_manager
        
        # Формируем событие Drops для фронтенда
        event_data = {
            "type": "drops",
            "event": "reward_received",
            "data": drops_data,
            "timestamp": datetime.now().isoformat()
        }
        
        # Отправляем всем подключенным клиентам
        await memory_websocket_manager.broadcast_to_all(json.dumps(event_data))
        
        logger.info(f"🎁 [DROPS] Broadcasted drops event: {drops_data.get('viewer_name')} got {drops_data.get('reward')}")
        return True
        
    except Exception as e:
        logger.error(f"Error broadcasting drops event: {e}")
        return False
