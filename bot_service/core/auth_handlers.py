# bot_service/core/auth_handlers.py
"""РћР±СЂР°Р±РѕС‚С‡РёРєРё Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё"""
from __future__ import annotations
import logging
from fastapi import HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from core.database import get_db
from auth.auth import get_current_user
from services.user_identity_service import UserIdentityService, UserType

logger = logging.getLogger(__name__)

class AuthHandlers:
    """РљР»Р°СЃСЃ РґР»СЏ РѕР±СЂР°Р±РѕС‚РєРё Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё"""

    def __init__(self):
        # We don't need TwitchAPI here anymore.
        pass

    async def twitch_login(self):
        """Twitch OAuth login"""
        from core.config import settings
        client_id = settings.twitch_client_id
        redirect_uri = f"{settings.backend_url}/auth/twitch/callback"
        scope = "user:read:email channel:manage:broadcast"

        auth_url = f"https://id.twitch.tv/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}"
        return RedirectResponse(url=auth_url)

    async def api_twitch_login(self):
        """API endpoint РґР»СЏ Twitch login"""
        from core.config import settings
        client_id = settings.twitch_client_id
        redirect_uri = f"{settings.backend_url}/auth/twitch/callback"
        scope = "user:read:email channel:manage:broadcast"

        auth_url = f"https://id.twitch.tv/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}"
        return {"auth_url": auth_url}

    async def api_twitch_auth(self):
        """API endpoint РґР»СЏ Twitch auth"""
        from core.config import settings
        client_id = settings.twitch_client_id
        redirect_uri = f"{settings.backend_url}/auth/twitch/callback"
        scope = "user:read:email channel:manage:broadcast"

        auth_url = f"https://id.twitch.tv/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}"
        return {"auth_url": auth_url}

    async def twitch_callback(self, code: str, request: Request, db: Session = Depends(get_db)):
        """Twitch OAuth callback"""
        try:
            logger.info(f"Twitch callback - code: {code[:10]}...")

            # РџРѕР»СѓС‡Р°РµРј С‚РµРєСѓС‰СѓСЋ СЃРµСЃСЃРёСЋ (РµСЃР»Рё РµСЃС‚СЊ)
            session_id = request.cookies.get("session_id")
            current_user_from_session = None
            if session_id:
                from core.session_manager import session_manager
                session_data = session_manager.validate_session(session_id)
                if session_data:
                    current_user_from_session = session_data
                    logger.info(f"Found existing session for user_id: {session_data.get('user_id')}")

            # Use Platform Registry for Authentication
            from platforms.registry import platform_registry
            twitch_platform = platform_registry.get('twitch')
            
            if not twitch_platform:
                 raise HTTPException(status_code=500, detail="Twitch platform not initialized")

            # РџРѕР»СѓС‡Р°РµРј С‚РѕРєРµРЅ РґРѕСЃС‚СѓРїР°
            logger.info("Getting access token from Twitch...")
            token_data = await twitch_platform.authenticate(code)

            if not token_data:
                raise HTTPException(status_code=400, detail="Failed to get access token")

            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            scopes = token_data.get("scope", []) 
            
            # Ensure scopes is a list
            if isinstance(scopes, str):
                scopes = scopes.split(" ")

            logger.info(f"Twitch scopes received: {scopes}")

            if not access_token:
                raise HTTPException(status_code=400, detail="Failed to get access token")

            # РџРѕР»СѓС‡Р°РµРј РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ РїРѕР»СЊР·РѕРІР°С‚РµР»Рµ
            logger.info("Getting user data from Twitch...")
            user_data = await twitch_platform.get_user_info(access_token)

            if not user_data:
                logger.error("Failed to get user data from Twitch")
                raise HTTPException(status_code=400, detail="Failed to get user info")

            twitch_user_id = user_data.get("id")
            twitch_username = user_data.get("display_name") or user_data.get("login") # Fallback to login if display_name missing

            logger.info(f"Twitch user data: id={twitch_user_id}, username={twitch_username}")

            if not twitch_user_id:
                logger.error("No user ID in Twitch response")
                raise HTTPException(status_code=400, detail="Failed to get user info")

            # РСЃРїРѕР»СЊР·СѓРµРј С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅС‹Р№ СЃРµСЂРІРёСЃ СЃРѕР·РґР°РЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№
            from core.user_creation_service import user_creation_service

            # РћРїСЂРµРґРµР»СЏРµРј, СЌС‚Рѕ РїСЂРёРІСЏР·РєР° РёРЅС‚РµРіСЂР°С†РёРё РёР»Рё РЅРѕРІС‹Р№ РІС…РѕРґ
            is_linking_integration = False
            current_user_id = None
            if current_user_from_session:
                existing_user_id = current_user_from_session.get('user_id')
                if existing_user_id and existing_user_id > 0:  # РќРµ РіРѕСЃС‚РµРІР°СЏ СЃРµСЃСЃРёСЏ
                    is_linking_integration = True
                    current_user_id = existing_user_id
                    logger.info(f"[LINK] Linking Twitch account to existing user_id: {existing_user_id}")

            # РЎРѕР·РґР°РµРј РёР»Рё РЅР°С…РѕРґРёРј РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СЃ РІРєР»СЋС‡РµРЅРёРµРј scopes
            user = await user_creation_service.find_or_create_user(
                db=db,
                platform="twitch",
                platform_user_id=twitch_user_id,
                username=twitch_username,
                avatar_url=user_data.get("profile_image_url"),
                access_token=access_token,
                refresh_token=refresh_token,
                scopes=scopes,
                current_user_id=current_user_id,
                is_admin=False
            )

            # --- Remaining Logic (Settings, Bot Connection, Session) ---
            user_id = user.id
            logger.info(f"[OK] User resolved: ID={user_id}, twitch_username={user.twitch_username}")

            # РљР РРўРР§РќРћ: РЎРѕР·РґР°РµРј UserSettings РµСЃР»Рё РµРіРѕ РЅРµС‚
            from core.database import UserSettings
            existing_settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
            if not existing_settings:
                logger.info(f"[NEW] Creating UserSettings for user {user_id}")
                user_settings = UserSettings(
                    user_id=user_id,
                    channel_name=twitch_username.lower(),
                    chat_enabled=True
                )
                db.add(user_settings)
                db.commit()
                logger.info(f"[OK] UserSettings created for {twitch_username}")

                # РџРѕРґРєР»СЋС‡Р°РµРј Р±РѕС‚Р° Рє РєР°РЅР°Р»Сѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
                try:
                    from startup.bot_registry import get_bot_registry
                    bot_instance = get_bot_registry().twitch_bot
                    if bot_instance:
                        import asyncio
                        # РџСЂРѕРІРµСЂСЏРµРј С‡С‚Рѕ Р±РѕС‚ РЅРµ СѓР¶Рµ РїРѕРґРєР»СЋС‡РµРЅ Рє СЌС‚РѕРјСѓ РєР°РЅР°Р»Сѓ
                        if not bot_instance.is_connected_to_channel(twitch_username.lower()):
                            asyncio.create_task(bot_instance.join_channel(twitch_username.lower()))
                            logger.info(f"[BOT] Bot joining channel: {twitch_username.lower()}")
                        else:
                            logger.info(f"[OK] Bot already connected to channel: {twitch_username.lower()}")
                except Exception as e:
                    logger.warning(f"Could not connect bot to channel on login: {e}")

            # РЈРїСЂР°РІР»РµРЅРёРµ СЃРµСЃСЃРёСЏРјРё
            from core.session_manager import session_manager

            if is_linking_integration:
                # Р•СЃР»Рё СЌС‚Рѕ РїСЂРёРІСЏР·РєР° РІС‚РѕСЂРѕР№ РїР»Р°С‚С„РѕСЂРјС‹ - РќР• Р·Р°РІРµСЂС€Р°РµРј СЃС‚Р°СЂС‹Рµ СЃРµСЃСЃРёРё, РёСЃРїРѕР»СЊР·СѓРµРј С‚РµРєСѓС‰СѓСЋ
                logger.info("[LINK] Integration linking - using current session")
                session_id = request.cookies.get("session_id")
                if not session_id:
                     # Р•СЃР»Рё РїРѕ РєР°РєРѕР№-С‚Рѕ РїСЂРёС‡РёРЅРµ cookie РЅРµС‚ - СЃРѕР·РґР°РµРј РЅРѕРІСѓСЋ СЃРµСЃСЃРёСЋ
                    logger.warning("No session cookie found during integration linking, creating new session")
                    device_info = {
                        "user_agent": request.headers.get("user-agent"),
                        "ip": getattr(request.client, 'host', 'unknown'),
                        "monitored_channel": twitch_username.lower(),  # РСЃРїРѕР»СЊР·СѓРµРј username, Р° РЅРµ ID
                        "platform": "twitch"
                    }
                    session_id = session_manager.create_session(user_id, device_info=device_info)

                    # РЈРІРµРґРѕРјР»СЏРµРј connection_manager Рѕ РЅРѕРІРѕР№ Р°РєС‚РёРІРЅРѕР№ СЃРµСЃСЃРёРё
                    try:
                        from core.connection_manager import get_connection_manager
                        connection_manager = get_connection_manager()
                        connection_manager.add_active_session(twitch_username.lower(), session_id, "twitch")
                        logger.info(f"[OK] Connection manager notified about linking session for {twitch_username}")
                    except Exception as e:
                        logger.error(f"Error notifying connection_manager: {e}")
            else:
                # Р•СЃР»Рё СЌС‚Рѕ РЅРѕРІС‹Р№ РІС…РѕРґ - Р·Р°РІРµСЂС€Р°РµРј Р’РЎР• СЃС‚Р°СЂС‹Рµ СЃРµСЃСЃРёРё (РїСЂРёРЅС†РёРї РѕРґРЅРѕР№ Р°РєС‚РёРІРЅРѕР№ СЃРµСЃСЃРёРё)
                logger.info(f"[SECURITY] New login detected for user {user_id}. Terminating ALL old sessions...")
                session_manager.terminate_user_sessions(user_id, "new_login", db)
                logger.info("[OK] All old sessions terminated. Creating new session...")

                # РЎРѕР·РґР°РµРј РЅРѕРІСѓСЋ СЃРµСЃСЃРёСЋ РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СЃ РїСЂР°РІРёР»СЊРЅС‹Рј device_info
                device_info = {
                    "user_agent": request.headers.get("user-agent"),
                    "ip": getattr(request.client, 'host', 'unknown'),
                    "monitored_channel": twitch_username.lower(),  # РСЃРїРѕР»СЊР·СѓРµРј username, Р° РЅРµ ID
                    "platform": "twitch"
                }
                session_id = session_manager.create_session(user_id, device_info=device_info)
                logger.info(f"[OK] New session created: {session_id}")

                # РЈРІРµРґРѕРјР»СЏРµРј connection_manager Рѕ РЅРѕРІРѕР№ Р°РєС‚РёРІРЅРѕР№ СЃРµСЃСЃРёРё
                try:
                    from core.connection_manager import get_connection_manager
                    connection_manager = get_connection_manager()
                    connection_manager.add_active_session(twitch_username.lower(), session_id, "twitch")
                    logger.info(f"[OK] Connection manager notified about new session for {twitch_username}")
                except Exception as e:
                    logger.error(f"Error notifying connection_manager: {e}")

            # РЎРѕР·РґР°РµРј РѕС‚РІРµС‚ СЃ httpOnly cookie
            from fastapi.responses import RedirectResponse
            from core.config import settings

            # РСЃРїРѕР»СЊР·СѓРµРј 302 РІРјРµСЃС‚Рѕ 307 РґР»СЏ Р»СѓС‡С€РµР№ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё СЃ cookies
            response = RedirectResponse(url=f"{settings.frontend_url}/dashboard", status_code=302)

            # РЇРІРЅРѕ СѓРґР°Р»СЏРµРј СЃС‚Р°СЂСѓСЋ cookie РїРµСЂРµРґ СѓСЃС‚Р°РЅРѕРІРєРѕР№ РЅРѕРІРѕР№
            response.delete_cookie(key="session_id", path="/")

            # РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј РЅРѕРІСѓСЋ cookie
            from core.cookie_config import get_session_cookie_settings
            cookie_settings = get_session_cookie_settings(session_id)
            response.set_cookie(**cookie_settings)

            logger.info("Twitch callback completed successfully, redirecting to dashboard")
            return response

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in Twitch callback: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail="Authentication failed")

    # VK OAuth С‚РµРїРµСЂСЊ РїРѕР»РЅРѕСЃС‚СЊСЋ РѕР±СЂР°Р±Р°С‚С‹РІР°РµС‚СЃСЏ С‡РµСЂРµР· auth/vk_auth.py СЂРѕСѓС‚РµСЂ
    # РњРµС‚РѕРґС‹ vk_login() Рё vk_callback() СѓРґР°Р»РµРЅС‹

    async def logout(
        self,
        current_user: dict = Depends(get_current_user),
        db: Session | None = None,
    ):
        """Logout user and terminate all sessions/tokens."""
        from fastapi.responses import JSONResponse
        from core.database import User
        from core.session_manager import session_manager

        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")

        user_type = UserIdentityService.get_user_type(current_user)
        user_id = current_user.get("id")

        owns_db_session = db is None
        db_session = db or next(get_db())

        try:
            if user_id:
                if user_type == UserType.AUTHENTICATED and user_id > 0:
                    logger.info(f"[BOT] Logout: Disconnecting bot from user {user_id} channels")
                    user = db_session.query(User).filter(User.id == user_id).first()
                    if user:
                        if user.twitch_username:
                            logger.info(f"[BOT] Disconnecting Twitch bot from channel: {user.twitch_username}")
                            try:
                                from startup.bot_registry import get_bot_registry

                                bot_instance = get_bot_registry().twitch_bot
                                if bot_instance:
                                    await bot_instance.part_channels([user.twitch_username])
                                    logger.info(f"[OK] Twitch bot disconnected from {user.twitch_username}")
                            except Exception as e:
                                logger.error(f"[ERROR] Error disconnecting Twitch bot: {e}")

                        if user.vk_channel_name:
                            logger.info(f"[BOT] Disconnecting VK Live bot from channel: {user.vk_channel_name}")
                            try:
                                from startup.bot_registry import get_bot_registry

                                vk_live_bot_instance = get_bot_registry().vk_bot
                                if vk_live_bot_instance:
                                    await vk_live_bot_instance.disconnect_from_channel(user.vk_channel_name)
                                    logger.info(f"[OK] VK Live bot disconnected from {user.vk_channel_name}")
                            except Exception as e:
                                logger.error(f"[ERROR] Error disconnecting VK Live bot: {e}")

                if user_type == UserType.AUTHENTICATED and user_id > 0:
                    logger.info(f"[DELETE] Logout: Deleting ALL tokens for user {user_id}")
                    session_manager.clear_all_user_tokens(user_id)
                    logger.info(f"[OK] Tokens deleted. User {user_id} will need to re-authenticate")

                logger.info(f"[DELETE] Logout: Terminating all sessions for user {user_id}")
                try:
                    session_manager.terminate_user_sessions(user_id, "user_logout", db_session)
                    logger.info(f"[OK] All sessions terminated for user {user_id}")
                except Exception as e:
                    logger.error(f"Error terminating sessions during logout: {e}")
        finally:
            if owns_db_session:
                db_session.close()

        is_guest = user_type == UserType.GUEST
        response = JSONResponse(
            content={
                "success": True,
                "message": "Logged out successfully",
                "tokens_deleted": not is_guest,
            }
        )

        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRFToken"
        response.headers["Access-Control-Allow-Credentials"] = "true"

        response.delete_cookie(
            key="session_id",
            httponly=True,
            samesite="lax",
        )

        logger.info(f"[LOGOUT] User {user_id} logged out successfully")
        return response

# РЎРѕР·РґР°РµРј СЌРєР·РµРјРїР»СЏСЂ РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ
auth_handlers = AuthHandlers()
