# bot_service/api/additional_api.py
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from core.database import get_db, User, UserToken, ChatMessage, UserSession
from auth.auth import get_current_user, get_current_user_optional
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["additional"])

@router.get("/auth/status")
async def get_auth_status(
    request: Request,
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Получить статус аутентификации и интеграций пользователя"""
    try:
        if not user:
            return {
                "authenticated": False,
                "user": None,
                "integrations": {
                    "twitch": {"connected": False},
                    "vk": {"connected": False},
                    "donationalerts": {"connected": False}
                }
            }
        
        user_id = user.get("id")
        
        # Получаем пользователя из БД
        db_user = db.query(User).filter(User.id == user_id).first()
        if not db_user:
            return {
                "authenticated": False,
                "user": None,
                "integrations": {
                    "twitch": {"connected": False},
                    "vk": {"connected": False},
                    "donationalerts": {"connected": False}
                }
            }
        
        # 🔐 БЕЗОПАСНОСТЬ: Получаем linked_platforms из текущей сессии
        session_id = request.cookies.get('session_id')
        linked_platforms = []
        
        if session_id:
            session = db.query(UserSession).filter(UserSession.session_id == session_id).first()
            if session and session.device_info:
                linked_platforms = session.device_info.get('linked_platforms', [])
                logger.info(f"🔐 Session {session_id[:8]}... has linked_platforms: {linked_platforms}")
        
        # Получаем токены интеграций
        tokens = db.query(UserToken).filter(UserToken.user_id == user_id).all()
        
        # Формируем информацию об интеграциях
        integrations = {
            "twitch": {"connected": False, "username": None},
            "vk": {"connected": False, "username": None},
            "donationalerts": {"connected": False, "username": None}
        }
        
        # 🔐 ФИЛЬТРАЦИЯ: Показываем только платформы из linked_platforms
        for token in tokens:
            # Пропускаем платформы, которые не в linked_platforms (если список не пустой)
            if linked_platforms and token.platform not in linked_platforms:
                logger.info(f"🔐 Platform {token.platform} not in linked_platforms, skipping...")
                continue
            
            if token.platform == "twitch":
                integrations["twitch"] = {
                    "connected": True,
                    "username": db_user.twitch_username,
                    "avatar_url": token.avatar_url
                }
            elif token.platform == "vk":
                integrations["vk"] = {
                    "connected": True,
                    "username": db_user.vk_username,
                    "avatar_url": token.avatar_url
                }
            elif token.platform == "donationalerts":
                integrations["donationalerts"] = {
                    "connected": True,
                    "username": token.platform_user_id
                }
        
        # Формируем ответ
        return {
            "authenticated": True,
            "user": {
                "id": db_user.id,
                "is_admin": db_user.is_admin,
                "is_guest": user.get("is_guest", False),
                "twitch_username": db_user.twitch_username,
                "vk_username": db_user.vk_username,
                "tts_enabled": db_user.tts_enabled,
                "created_at": db_user.created_at.isoformat() if db_user.created_at else None
            },
            "integrations": integrations
        }
        
    except Exception as e:
        logger.error(f"Error getting auth status: {e}", exc_info=True)
        return {
            "authenticated": False,
            "user": None,
            "integrations": {
                "twitch": {"connected": False},
                "vk": {"connected": False},
                "donationalerts": {"connected": False}
            }
        }

@router.get("/auth/user/me")
async def get_user_me(user: dict = Depends(get_current_user)):
    """Получить информацию о текущем пользователе"""
    return JSONResponse(content={
        "id": user.get("id"),
        "twitch_username": user.get("twitch_username"),
        "vk_username": user.get("vk_username"),
        "is_admin": user.get("is_admin", False),
        "created_at": user.get("created_at")
    })

@router.get("/auth/session/status")
async def get_session_status(user: dict = Depends(get_current_user)):
    """Получить статус сессии"""
    return JSONResponse(content={
        "authenticated": True,
        "user_id": user.get("id"),
        "session_valid": True,
        "expires_at": None
    })

@router.post("/clear-verifications")
async def clear_verifications(user: dict = Depends(get_current_user)):
    """Очистить верификации"""
    try:
        # Очистка верификаций (заглушка)
        logger.info(f"Clear verifications requested by user {user['id']}")
        return JSONResponse(content={"success": True, "message": "Verifications cleared"})
    except Exception as e:
        logger.error(f"Error clearing verifications: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)

@router.get("/integrations")
async def get_integrations(user: dict = Depends(get_current_user)):
    """Получить список интеграций пользователя с валидацией токенов"""
    try:
        from core.database import get_db, UserToken, User
        from core.token_utils import validate_platform_token
        
        user_id = user.get("id")
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        # Получаем токены пользователя из базы данных
        db = next(get_db())
        try:
            user_tokens = db.query(UserToken).filter(UserToken.user_id == user_id).all()
            user_obj = db.query(User).filter(User.id == user_id).first()
            
            integrations = {}
            for token in user_tokens:
                if token.access_token:
                    # ВАЛИДАЦИЯ ТОКЕНА ЧЕРЕЗ API ПЛАТФОРМЫ
                    is_valid = await validate_platform_token(token)
                    
                    if is_valid:
                        platform = token.platform
                        # Получаем username из базы данных пользователя
                        username = None
                        if platform == "twitch" and user_obj:
                            username = user_obj.twitch_username
                        elif platform == "vk" and user_obj:
                            username = user_obj.vk_username
                        elif platform == "donationalerts" and user_obj:
                            username = getattr(user_obj, 'donationalerts_username', None)
                        
                        integrations[platform] = {
                            "connected": True,
                            "username": username,
                            "platform_user_id": token.platform_user_id,
                            "avatar_url": token.avatar_url
                        }
                    else:
                        # Токен недействителен - НЕ добавляем в интеграции, НО НЕ удаляем (может быть временная проблема)
                        logger.warning(f"⚠️ Invalid token for {token.platform} user {user_id}, skipping integration (keeping token for retry)")
                        # Не удаляем токен - возможно это временная проблема с API платформы
            
            return JSONResponse(content={"integrations": integrations})
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting integrations: {e}")
        return JSONResponse(content={"integrations": {}}, status_code=500)

@router.post("/integrations/{platform}/disconnect")
async def disconnect_integration(platform: str, user: dict = Depends(get_current_user)):
    """
    Отключить интеграцию (отключить бота, но сохранить токены)
    
    Токены ОСТАЮТСЯ в БД для быстрого переподключения.
    При следующем входе боты подключатся автоматически.
    """
    from core.database import SessionLocal, User, UserToken
    from core.connection_manager import get_connection_manager
    
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID not found")
    
    logger.info(f"🔌 [DISCONNECT] User {user_id} disconnecting {platform} integration...")
    
    # Получаем информацию о пользователе
    db = SessionLocal()
    try:
        db_user = db.query(User).filter(User.id == user_id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        connection_manager = get_connection_manager()
        
        # Отключаем бота от канала в зависимости от платформы
        if platform == "twitch":
            channel_name = db_user.twitch_username
            if channel_name:
                # Отключаем Twitch бота
                try:
                    from main import bot_instance
                    if bot_instance:
                        # TwitchIO не имеет метода part, но мы можем отключить TTS
                        connection_manager.disable_tts_for_channel(channel_name.lower())
                        logger.info(f"✅ Disconnected Twitch bot from {channel_name}")
                except Exception as e:
                    logger.error(f"Error disconnecting Twitch bot: {e}")
                    raise HTTPException(status_code=500, detail=f"Failed to disconnect Twitch bot: {str(e)}")
                    
        elif platform == "vk":
            channel_name = db_user.vk_channel_name or db_user.vk_username
            if channel_name:
                # Отключаем VK бота
                try:
                    import main
                    logger.info(f"🔍 VK bot instance status: {main.vk_live_bot_instance is not None}")
                    if main.vk_live_bot_instance:
                        # Отключаем от канала
                        await main.vk_live_bot_instance.disconnect_from_channel(channel_name)
                        connection_manager.disable_tts_for_channel(channel_name.lower())
                        logger.info(f"✅ Disconnected VK bot from {channel_name}")
                    else:
                        logger.warning(f"⚠️ VK bot instance not found, only disabling TTS")
                        connection_manager.disable_tts_for_channel(channel_name.lower())
                except Exception as e:
                    logger.error(f"Error disconnecting VK bot: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    raise HTTPException(status_code=500, detail=f"Failed to disconnect VK bot: {str(e)}")
        
        # Устанавливаем is_active=False для токена (но НЕ удаляем!)
        token = db.query(UserToken).filter(
            UserToken.user_id == user_id,
            UserToken.platform == platform
        ).first()
        
        if token:
            if hasattr(token, 'is_active'):
                token.is_active = False
            db.commit()
            logger.info(f"✅ Marked {platform} token as inactive for user {user_id}")
        
        logger.info(f"✅ Integration {platform} disconnected for user {user_id} (tokens preserved)")
        return JSONResponse(content={"success": True, "message": f"{platform} bot disconnected (tokens saved for quick reconnect)"})
        
    finally:
        db.close()

@router.post("/integrations/{platform}/remove")
async def remove_integration(platform: str, user: dict = Depends(get_current_user)):
    """
    ПОЛНОСТЬЮ удалить интеграцию (удалить токены и отключить бота)
    
    Используйте это если нужно полностью отвязать аккаунт.
    После этого потребуется полная переавторизация.
    """
    try:
        from core.session_manager import session_manager
        from core.database import SessionLocal, User
        from core.connection_manager import get_connection_manager
        
        user_id = user.get("id")
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        # Получаем информацию о пользователе
        db = SessionLocal()
        try:
            db_user = db.query(User).filter(User.id == user_id).first()
            if not db_user:
                raise HTTPException(status_code=404, detail="User not found")
            
            connection_manager = get_connection_manager()
            
            # Отключаем бота от канала
            if platform == "twitch":
                channel_name = db_user.twitch_username
                if channel_name:
                    connection_manager.disable_tts_for_channel(channel_name.lower())
                    
            elif platform == "vk":
                channel_name = db_user.vk_channel_name or db_user.vk_username
                if channel_name:
                    try:
                        import main
                        if main.vk_live_bot_instance:
                            await main.vk_live_bot_instance.disconnect_from_channel(channel_name)
                        else:
                            logger.warning(f"⚠️ VK bot instance not found for removal")
                    except Exception as e:
                        logger.error(f"Error disconnecting VK bot: {e}")
                        import traceback
                        logger.error(traceback.format_exc())
                    connection_manager.disable_tts_for_channel(channel_name.lower())
                    
        finally:
            db.close()
        
        # УДАЛЯЕМ токены
        success = session_manager.remove_platform_token(user_id, platform)
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to remove {platform} integration")
        
        logger.info(f"✅ Integration {platform} REMOVED for user {user_id} (tokens deleted)")
        return JSONResponse(content={"success": True, "message": f"{platform} integration fully removed. Re-authorization required."})
        
    except Exception as e:
        logger.error(f"Error removing {platform} integration: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)

@router.get("/chat/history")
async def get_chat_history(
    channel: str = None,
    platform: str = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Получить историю сообщений чата"""
    try:
        logger.info(f"📜 [CHAT HISTORY] Request received: channel={channel}, platform={platform}, limit={limit}")
        
        # Если пользователь не авторизован, возвращаем пустой список
        if not current_user:
            logger.warning("📜 [CHAT HISTORY] No authenticated user - returning empty list")
            return JSONResponse(content={"success": True, "messages": []})
        
        user_id = current_user.get("id")
        logger.info(f"📜 [CHAT HISTORY] User ID: {user_id}")
        
        # Если не указан канал, используем канал пользователя
        if not channel:
            db_user = db.query(User).filter(User.id == user_id).first()
            if not db_user:
                logger.warning(f"📜 [CHAT HISTORY] User {user_id} not found in database")
                return JSONResponse(content={"messages": []})
            
            # Выбираем первый доступный канал
            if db_user.twitch_username:
                channel = db_user.twitch_username
                platform = "twitch"
                logger.info(f"📜 [CHAT HISTORY] Using Twitch channel: {channel}")
            elif db_user.vk_username:
                channel = db_user.vk_username
                platform = "vk"
                logger.info(f"📜 [CHAT HISTORY] Using VK channel: {channel}")
            else:
                logger.warning(f"📜 [CHAT HISTORY] User {user_id} has no channels")
                return JSONResponse(content={"messages": []})
        
        logger.info(f"📜 [CHAT HISTORY] Querying messages: user_id={user_id}, channel={channel}, platform={platform}, limit={limit}")
        
        # Получаем последние сообщения для этого канала (case-insensitive для имени канала)
        from sqlalchemy import func
        query = db.query(ChatMessage).filter(
            ChatMessage.user_id == user_id,
            func.lower(ChatMessage.channel_name) == channel.lower(),  # Case-insensitive поиск
            ChatMessage.is_deleted == False
        )
        
        logger.info(f"📜 [CHAT HISTORY] Using case-insensitive search for channel: {channel}")
        
        if platform:
            query = query.filter(ChatMessage.platform == platform)
        
        # Получаем сообщения в обратном порядке (самые свежие сверху)
        try:
            messages = query.order_by(ChatMessage.timestamp.desc()).limit(limit).all()
            logger.info(f"📜 [CHAT HISTORY] Found {len(messages)} messages in database")
        except Exception as db_error:
            # Fallback если нет колонки author_username (старая БД)
            logger.warning(f"⚠️ Database schema mismatch: {db_error}")
            logger.info("ℹ️ Falling back to basic query without author_username")
            
            # Переделаем запрос без author_username
            try:
                from sqlalchemy import text
                # Использу ем RAW SQL для старой БД
                sql_query = """
                    SELECT id, user_id, channel_name, platform, message, timestamp, is_deleted
                    FROM chat_messages 
                    WHERE user_id = ? AND channel_name = ? AND is_deleted = 0
                """
                if platform:
                    sql_query += " AND platform = ?"
                    sql_query += " ORDER BY timestamp DESC LIMIT ?"
                    result = db.execute(text(sql_query), (user_id, channel, platform, limit))
                else:
                    sql_query += " ORDER BY timestamp DESC LIMIT ?"
                    result = db.execute(text(sql_query), (user_id, channel, limit))
                
                messages = []
                for row in result:
                    messages.append(type('Message', (), {
                        'id': row[0],
                        'user_id': row[1],
                        'channel_name': row[2],
                        'platform': row[3],
                        'message': row[4],
                        'timestamp': row[5],
                        'is_deleted': row[6],
                        'author_username': None  # Fallback
                    })())
            except Exception as fallback_error:
                logger.error(f"❌ Fallback query also failed: {fallback_error}")
                return JSONResponse(content={
                    "success": False,
                    "error": "Database schema mismatch. Please reinitialize database."
                }, status_code=500)
        
        # Преобразуем в нужный формат
        import json
        messages_data = []
        for msg in reversed(messages):  # Реверсируем обратно для хронологического порядка
            # Парсим badges если это строка JSON
            badges_list = getattr(msg, 'badges', None)
            if isinstance(badges_list, str):
                try:
                    badges_list = json.loads(badges_list)
                except:
                    badges_list = None
            
            messages_data.append({
                "id": msg.id,
                "author": getattr(msg, 'author_username', None) or 'unknown',  # Используем author вместо username для совместимости с ChatCard
                "author_name": getattr(msg, 'author_username', None) or 'unknown',
                "content": msg.message,
                "message": msg.message,  # Добавляем поле message для совместимости
                "platform": msg.platform,
                "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
                "channel": msg.channel_name,
                "role": getattr(msg, 'role', None),  # Роль пользователя
                "badges": badges_list  # Значки пользователя (массив)
            })
        
        # Отладка: выводим первое сообщение с badges
        if messages_data and len(messages_data) > 0:
            logger.info(f"🎖️ [CHAT HISTORY API] Sample message: author={messages_data[0]['author']}, role={messages_data[0]['role']}, badges={messages_data[0]['badges']}")
        
        logger.info(f"✅ [CHAT HISTORY] Returning {len(messages_data)} messages for {platform}:{channel}")
        
        return JSONResponse(content={
            "success": True,
            "messages": messages_data,
            "total": len(messages_data)
        })
        
    except Exception as e:
        logger.error(f"❌ [CHAT HISTORY] Error: {e}", exc_info=True)
        return JSONResponse(content={
            "success": False,
            "messages": [],
            "error": str(e)
        }, status_code=500)
