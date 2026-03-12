"""
РњРµРЅРµРґР¶РµСЂ СЃРµСЃСЃРёР№ РґР»СЏ РјСѓР»СЊС‚РёРїР»Р°С‚С„РѕСЂРјРµРЅРЅРѕР№ Р°РІС‚РѕСЂРёР·Р°С†РёРё
"""
import uuid
import logging
from datetime import timedelta
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from core.datetime_utils import utcnow_naive
from core.log_sanitizer import mask_session_id
from core.database import (
    User, UserToken, UserSession, UserSettings, TTSUserSettings,
    db_session
)

# NOTE: Guest mode removed - all users must authenticate via OAuth

logger = logging.getLogger(__name__)

class SessionManager:
    """РњРµРЅРµРґР¶РµСЂ РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ РјСѓР»СЊС‚РёРїР»Р°С‚С„РѕСЂРјРµРЅРЅС‹РјРё СЃРµСЃСЃРёСЏРјРё РЅР° РѕСЃРЅРѕРІРµ РµРґРёРЅРѕР№ СѓС‡РµС‚РЅРѕР№ Р·Р°РїРёСЃРё."""

    def __init__(self):
        # Р‘РµСЃРєРѕРЅРµС‡РЅР°СЏ СЃРµСЃСЃРёСЏ - СЃРµСЃСЃРёСЏ Р¶РёРІРµС‚ РґРѕ СЏРІРЅРѕРіРѕ Р»РѕРіР°СѓС‚Р° РёР»Рё Р»РѕРіРёРЅР° СЃ РґСЂСѓРіРѕРіРѕ СѓСЃС‚СЂРѕР№СЃС‚РІР°
        # РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј РѕС‡РµРЅСЊ Р±РѕР»СЊС€РѕР№ С‚Р°Р№РјР°СѓС‚ (10 Р»РµС‚) РґР»СЏ РїСЂРѕРІРµСЂРєРё, РЅРѕ С„Р°РєС‚РёС‡РµСЃРєРё СЃРµСЃСЃРёСЏ Р±РµСЃРєРѕРЅРµС‡РЅР°
        self.session_timeout = timedelta(days=3650)  # 10 Р»РµС‚ (РїСЂР°РєС‚РёС‡РµСЃРєРё Р±РµСЃРєРѕРЅРµС‡РЅРѕ)
        # РќР• СЂР°Р·Р»РѕРіРёРЅРёРІР°РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РїСЂРё:
        # - СЃРІРѕСЂР°С‡РёРІР°РЅРёРё Р±СЂР°СѓР·РµСЂР°
        # - СЃРјРµРЅРµ РІРєР»Р°РґРєРё
        # - Р·Р°РєСЂС‹С‚РёРё Р±СЂР°СѓР·РµСЂР°
        # - РїРѕС‚РµСЂРµ С„РѕРєСѓСЃР° РѕРєРЅР°
        # - РґРѕР»РіРѕРј РїРµСЂРµСЂС‹РІРµ РІ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРё
        # РЎРµСЃСЃРёСЏ Р·Р°РІРµСЂС€Р°РµС‚СЃСЏ РўРћР›Р¬РљРћ РїСЂРё:
        # - СЏРІРЅРѕРј Р»РѕРіР°СѓС‚Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
        # - Р»РѕРіРёРЅРµ СЃ РґСЂСѓРіРѕРіРѕ СѓСЃС‚СЂРѕР№СЃС‚РІР° (РІСЃРµ СЃС‚Р°СЂС‹Рµ СЃРµСЃСЃРёРё Р·Р°РІРµСЂС€Р°СЋС‚СЃСЏ)


    def _merge_user_accounts(self, source_user_id: int, target_user_id: int, db: Session):
        """РћР±СЉРµРґРёРЅСЏРµС‚ РґРІР° Р°РєРєР°СѓРЅС‚Р°: РїРµСЂРµРЅРѕСЃРёС‚ РІСЃРµ РґР°РЅРЅС‹Рµ РѕС‚ source Рє target"""
        try:
            logger.info(f"Merging user {source_user_id} into user {target_user_id}")

            # РџРѕР»СѓС‡Р°РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№
            source_user = db.query(User).filter(User.id == source_user_id).first()
            target_user = db.query(User).filter(User.id == target_user_id).first()

            if not source_user or not target_user:
                raise ValueError("Source or target user not found")

            # РџРµСЂРµРЅРѕСЃРёРј username'С‹ РµСЃР»Рё РёС… РЅРµС‚ Сѓ target
            if not target_user.twitch_username and source_user.twitch_username:
                target_user.twitch_username = source_user.twitch_username
            if not target_user.vk_username and source_user.vk_username:
                target_user.vk_username = source_user.vk_username

            # РџРµСЂРµРЅРѕСЃРёРј С‚РѕРєРµРЅС‹
            source_tokens = db.query(UserToken).filter(UserToken.user_id == source_user_id).all()
            for token in source_tokens:
                # РџСЂРѕРІРµСЂСЏРµРј, РЅРµС‚ Р»Рё СѓР¶Рµ С‚РѕРєРµРЅР° СЌС‚РѕР№ РїР»Р°С‚С„РѕСЂРјС‹ Сѓ target
                existing_token = db.query(UserToken).filter(
                    UserToken.user_id == target_user_id,
                    UserToken.platform == token.platform
                ).first()

                if not existing_token:
                    # РџРµСЂРµРЅРѕСЃРёРј С‚РѕРєРµРЅ
                    token.user_id = target_user_id
                else:
                    # РћР±РЅРѕРІР»СЏРµРј СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ С‚РѕРєРµРЅ
                    existing_token.access_token = token.access_token
                    existing_token.refresh_token = token.refresh_token
                    existing_token.expires_at = token.expires_at
                    existing_token.scopes = token.scopes
                    existing_token.avatar_url = token.avatar_url
                    existing_token.platform_user_id = token.platform_user_id

                    # РЈРґР°Р»СЏРµРј СЃС‚Р°СЂС‹Р№ С‚РѕРєРµРЅ
                    db.delete(token)

            # РџРµСЂРµРЅРѕСЃРёРј РЅР°СЃС‚СЂРѕР№РєРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
            source_settings = db.query(UserSettings).filter(UserSettings.user_id == source_user_id).first()
            target_settings = db.query(UserSettings).filter(UserSettings.user_id == target_user_id).first()

            if source_settings and target_settings:
                # РћР±РЅРѕРІР»СЏРµРј РЅР°СЃС‚СЂРѕР№РєРё target РґР°РЅРЅС‹РјРё РёР· source (РїСЂРёРѕСЂРёС‚РµС‚ Сѓ source)
                for column in UserSettings.__table__.columns:
                    if column.name not in ['id', 'user_id']:
                        source_value = getattr(source_settings, column.name)
                        if source_value is not None:
                            setattr(target_settings, column.name, source_value)

            # РџРµСЂРµРЅРѕСЃРёРј TTS РЅР°СЃС‚СЂРѕР№РєРё
            source_tts_settings = db.query(TTSUserSettings).filter(TTSUserSettings.user_id == source_user_id).first()
            target_tts_settings = db.query(TTSUserSettings).filter(TTSUserSettings.user_id == target_user_id).first()

            if source_tts_settings and target_tts_settings:
                # РћР±РЅРѕРІР»СЏРµРј TTS РЅР°СЃС‚СЂРѕР№РєРё target РґР°РЅРЅС‹РјРё РёР· source
                for column in TTSUserSettings.__table__.columns:
                    if column.name not in ['id', 'user_id', 'created_at', 'updated_at']:
                        source_value = getattr(source_tts_settings, column.name)
                        if source_value is not None:
                            setattr(target_tts_settings, column.name, source_value)

            # РћР±РЅРѕРІР»СЏРµРј СЃРµСЃСЃРёРё: РјРµРЅСЏРµРј user_id СЃ source РЅР° target
            db.query(UserSession).filter(UserSession.user_id == source_user_id).update({
                UserSession.user_id: target_user_id
            })

            # РџРµСЂРµРЅРѕСЃРёРј РґСЂСѓРіРёРµ СЃРІСЏР·Р°РЅРЅС‹Рµ РґР°РЅРЅС‹Рµ (РµСЃР»Рё РµСЃС‚СЊ)
            # Р—РґРµСЃСЊ РјРѕР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ РїРµСЂРµРЅРѕСЃ РєРѕРјР°РЅРґ, РіРѕР»РѕСЃРѕРІ, РёСЃС‚РѕСЂРёРё Рё С‚.Рґ.

            # РЈРґР°Р»СЏРµРј source_user, С‚Р°Рє РєР°Рє РІСЃРµ РґР°РЅРЅС‹Рµ РїРµСЂРµРЅРµСЃРµРЅС‹
            db.delete(source_user)
            logger.info(f"[DELETE] Source user {source_user_id} deleted after merge")

            db.commit()
            logger.info(f"Successfully merged user {source_user_id} into user {target_user_id}")

        except Exception as e:
            db.rollback()
            logger.error(f"Error merging user accounts: {e}")
            raise

    def terminate_user_sessions_for_channel(self, user_id: int, channel_name: str, reason: str = "user_logout"):
        """Р—Р°РІРµСЂС€Р°РµС‚ РІСЃРµ СЃРµСЃСЃРёРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РґР»СЏ РєР°РЅР°Р»Р° РїСЂРё Р»РѕРіР°СѓС‚Рµ"""
        from sqlalchemy import text

        with db_session() as db:
            # PostgreSQL РёСЃРїРѕР»СЊР·СѓРµС‚ РѕРїРµСЂР°С‚РѕСЂ ->> РґР»СЏ РёР·РІР»РµС‡РµРЅРёСЏ JSON Р·РЅР°С‡РµРЅРёР№
            json_query = "device_info->>'monitored_channel' = :channel"

            user_sessions = db.query(UserSession).filter(
                UserSession.user_id == user_id,
                UserSession.is_active,
                text(json_query)
            ).params(channel=channel_name).all()

            for session in user_sessions:
                session.is_active = False
                session.ended_at = utcnow_naive()
                session.device_info = {
                    **session.device_info,
                    "termination_reason": reason,
                    "terminated_at": utcnow_naive().isoformat()
                }
                logger.info(
                    "Terminated user session %s for channel %s: %s",
                    mask_session_id(session.session_id),
                    channel_name,
                    reason,
                )

            logger.info(f"Terminated {len(user_sessions)} user sessions for channel {channel_name}")

    def save_user_tokens(self, user_id: int, platform: str, platform_user_id: str,
                        avatar_url: str = None, access_token: str = None,
                        refresh_token: str = None, expires_at = None,
                        scopes: list = None):
        """
        РЎРѕС…СЂР°РЅСЏРµС‚ РёР»Рё РѕР±РЅРѕРІР»СЏРµС‚ С‚РѕРєРµРЅС‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РґР»СЏ РїР»Р°С‚С„РѕСЂРјС‹.
        РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїРѕР»РЅР°СЏ OAuth Р°РІС‚РѕСЂРёР·Р°С†РёСЏ.
        """
        from core.token_encryption import encrypt_token

        logger.info(f"[SAVE] Saving tokens for user {user_id}, platform {platform}")

        # РЁРёС„СЂСѓРµРј С‚РѕРєРµРЅС‹ РїРµСЂРµРґ СЃРѕС…СЂР°РЅРµРЅРёРµРј
        encrypted_access_token = encrypt_token(access_token) if access_token else None
        encrypted_refresh_token = encrypt_token(refresh_token) if refresh_token else None

        with db_session() as db:
            existing_token = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == platform
            ).first()

            if existing_token:
                logger.info(f"[REFRESH] Updating existing token for user {user_id}, platform {platform}")
                existing_token.platform_user_id = platform_user_id
                existing_token.avatar_url = avatar_url
                existing_token.access_token = encrypted_access_token
                existing_token.refresh_token = encrypted_refresh_token
                existing_token.expires_at = expires_at
                existing_token.scopes = scopes
                existing_token.auth_type = "full"
                if hasattr(existing_token, 'is_active'):
                    existing_token.is_active = True
            else:
                logger.info(f"[NEW] Creating new token for user {user_id}, platform {platform}")
                new_token = UserToken(
                    user_id=user_id,
                    platform=platform,
                    platform_user_id=platform_user_id,
                    avatar_url=avatar_url,
                    access_token=encrypted_access_token,
                    refresh_token=encrypted_refresh_token,
                    expires_at=expires_at,
                    scopes=scopes,
                    auth_type="full"
                )
                db.add(new_token)

        logger.info(f"[OK] Successfully saved tokens for user {user_id}, platform {platform}")

    def create_session(self, user_id: int, device_info: Optional[Dict] = None) -> str:
        """РЎРѕР·РґР°РµС‚ РЅРѕРІСѓСЋ СЃРµСЃСЃРёСЋ РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ, Р·Р°РІРµСЂС€Р°СЏ РІСЃРµ РµРіРѕ РїСЂРµРґС‹РґСѓС‰РёРµ СЃРµСЃСЃРёРё."""
        logger.info(f"[SESSION] create_session called for user_id: {user_id}")

        session_id = str(uuid.uuid4())

        # SECURITY: Р’ СЃРµСЃСЃРёРё РґРѕСЃС‚СѓРїРЅР° С‚РѕР»СЊРєРѕ РїР»Р°С‚С„РѕСЂРјР°, С‡РµСЂРµР· РєРѕС‚РѕСЂСѓСЋ Р·Р°Р»РѕРіРёРЅРёР»РёСЃСЊ
        if device_info:
            login_platform = device_info.get('platform')
            if login_platform:
                device_info['linked_platforms'] = [login_platform]
                logger.info(f"[SECURITY] Session created with ONLY {login_platform} platform access")

        with db_session() as db:
            self.terminate_user_sessions(user_id, "new_login", db)

            new_session = UserSession(
                user_id=user_id,
                session_id=session_id,
                device_info=device_info or {},
                is_active=True
            )
            db.add(new_session)
            db.flush()
            db.refresh(new_session)

            logger.info("[OK] Session %s created for user %s", mask_session_id(session_id), user_id)

        return session_id

    def update_session(self, session_id: int, device_info: Optional[Dict] = None) -> bool:
        """РћР±РЅРѕРІР»СЏРµС‚ СЃСѓС‰РµСЃС‚РІСѓСЋС‰СѓСЋ СЃРµСЃСЃРёСЋ РЅРѕРІС‹РјРё РґР°РЅРЅС‹РјРё"""
        try:
            with db_session() as db:
                session = db.query(UserSession).filter(UserSession.id == session_id).first()
                if not session:
                    logger.warning(f"Session {session_id} not found")
                    return False

                if device_info:
                    session.device_info = device_info
                session.updated_at = utcnow_naive()

            logger.info(f"[OK] Session {session_id} updated successfully")
            return True
        except Exception as e:
            logger.error(f"[ERROR] Error updating session {session_id}: {e}")
            return False

    def get_user_tokens(self, user_id: int, platform: str) -> Optional[Dict]:
        """РџРѕР»СѓС‡Р°РµС‚ С‚РѕРєРµРЅС‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СЃ СЂР°СЃС€РёС„СЂРѕРІРєРѕР№"""
        from core.token_encryption import decrypt_token, is_token_encrypted

        try:
            with db_session() as db:
                token_record = db.query(UserToken).filter(
                    UserToken.user_id == user_id,
                    UserToken.platform == platform
                ).first()

                if not token_record:
                    return None

                # Р Р°СЃС€РёС„СЂРѕРІС‹РІР°РµРј С‚РѕРєРµРЅС‹
                access_token = token_record.access_token
                refresh_token = token_record.refresh_token

                if access_token and is_token_encrypted(access_token):
                    access_token = decrypt_token(access_token)

                if refresh_token and is_token_encrypted(refresh_token):
                    refresh_token = decrypt_token(refresh_token)

                return {
                    'access_token': access_token,
                    'refresh_token': refresh_token,
                    'expires_at': token_record.expires_at,
                    'scopes': token_record.scopes,
                    'platform_user_id': token_record.platform_user_id,
                    'avatar_url': token_record.avatar_url
                }
        except Exception as e:
            logger.error(f"Error getting tokens for user {user_id}, platform {platform}: {e}")
            return None


    def terminate_user_sessions(self, user_id: int, reason: str = "logout", db: Optional[Session] = None) -> None:
        """Р—Р°РІРµСЂС€Р°РµС‚ РІСЃРµ Р°РєС‚РёРІРЅС‹Рµ СЃРµСЃСЃРёРё СѓРєР°Р·Р°РЅРЅРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ."""
        def _terminate(session_db: Session):
            sessions = session_db.query(UserSession).filter(
                UserSession.user_id == user_id,
                UserSession.is_active
            ).all()

            if not sessions:
                return

            for session in sessions:
                session.is_active = False
                logger.info(
                    "Terminated session %s for user %s, reason: %s",
                    mask_session_id(session.session_id),
                    user_id,
                    reason,
                )

            logger.info(f"Sessions terminated for user {user_id}, reason: {reason}")

        if db is not None:
            _terminate(db)
            db.commit()
        else:
            with db_session() as new_db:
                _terminate(new_db)

    def clear_user_tokens(self, user_id: int) -> bool:
        """РЈРґР°Р»СЏРµС‚ РІСЃРµ С‚РѕРєРµРЅС‹ РёРЅС‚РµРіСЂР°С†РёР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РїСЂРё logout"""
        try:
            with db_session() as db:
                tokens = db.query(UserToken).filter_by(user_id=user_id).all()
                logger.info(f"[DELETE] Clearing {len(tokens)} tokens for user {user_id}")

                deleted_count = db.query(UserToken).filter_by(user_id=user_id).delete()

            logger.info(f"[OK] Successfully removed {deleted_count} tokens for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"[ERROR] Error clearing tokens for user {user_id}: {e}")
            return False

    def remove_platform_token(self, user_id: int, platform: str) -> bool:
        """РЈРґР°Р»СЏРµС‚ С‚РѕРєРµРЅС‹ РєРѕРЅРєСЂРµС‚РЅРѕР№ РїР»Р°С‚С„РѕСЂРјС‹ РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"""
        try:
            with db_session() as db:
                tokens = db.query(UserToken).filter_by(user_id=user_id, platform=platform).all()

                if not tokens:
                    logger.warning(f"No {platform} tokens found for user {user_id}")
                    return True

                logger.info(f"[DELETE] Removing {len(tokens)} {platform} tokens for user {user_id}")
                deleted_count = db.query(UserToken).filter_by(user_id=user_id, platform=platform).delete()

            logger.info(f"[OK] Successfully removed {deleted_count} {platform} tokens for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"[ERROR] Error removing {platform} tokens for user {user_id}: {e}")
            return False

    def terminate_session(self, session_id: str, reason: str = "logout") -> bool:
        """Р—Р°РІРµСЂС€Р°РµС‚ РєРѕРЅРєСЂРµС‚РЅСѓСЋ СЃРµСЃСЃРёСЋ РїРѕ РµРµ ID."""
        try:
            device_info = None
            with db_session() as db:
                session = db.query(UserSession).filter_by(session_id=session_id, is_active=True).first()
                if not session:
                    return False

                session.is_active = False
                device_info = session.device_info

            logger.info("Terminated session %s, reason: %s", mask_session_id(session_id), reason)

            # РЈРІРµРґРѕРјР»СЏРµРј connection_manager Рѕ Р·Р°РІРµСЂС€РµРЅРёРё СЃРµСЃСЃРёРё
            try:
                from core.connection_manager import get_connection_manager
                connection_manager = get_connection_manager()

                if device_info:
                    channel_name = device_info.get("monitored_channel")
                    if channel_name:
                        connection_manager.remove_active_session(channel_name, session_id)
            except Exception as e:
                logger.error(f"Error notifying connection_manager about session termination: {e}")

            return True
        except Exception as e:
            logger.error("Error terminating session %s: %s", mask_session_id(session_id), e)
            return False

    def validate_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """РџСЂРѕРІРµСЂСЏРµС‚ РІР°Р»РёРґРЅРѕСЃС‚СЊ СЃРµСЃСЃРёРё Рё РІРѕР·РІСЂР°С‰Р°РµС‚ РґР°РЅРЅС‹Рµ Рѕ РїРѕР»СЊР·РѕРІР°С‚РµР»Рµ."""
        if not session_id or len(session_id) < 10:
            logger.warning("Invalid session_id format: %s", mask_session_id(session_id))
            return None

        try:
            with db_session() as db:
                session = db.query(UserSession).filter_by(session_id=session_id, is_active=True).first()

                if not session:
                    logger.debug("Invalid or inactive session: %s", mask_session_id(session_id))
                    return None

                # РћР±РЅРѕРІР»СЏРµРј last_activity С‚РѕР»СЊРєРѕ РµСЃР»Рё РїСЂРѕС€Р»Рѕ Р±РѕР»СЊС€Рµ 1 С‡Р°СЃР°
                time_since_activity = utcnow_naive() - session.last_activity
                if time_since_activity > timedelta(hours=1):
                    session.last_activity = utcnow_naive()

                user = db.query(User).filter_by(id=session.user_id).first()
                if not user:
                    logger.warning("User not found for session %s", mask_session_id(session_id))
                    return None

                login_platform = None
                if session.device_info and isinstance(session.device_info, dict):
                    login_platform = session.device_info.get('platform')

                # Fallback: derive login_platform from user's linked platforms
                if not login_platform:
                    if user.twitch_username:
                        login_platform = 'twitch'
                    elif user.vk_username:
                        login_platform = 'vk'

                return {
                    "user_id": user.id,
                    "id": user.id,
                    "session_id": session_id,
                    "is_admin": bool(getattr(user, "role", None) == "admin" or user.is_admin),
                    "is_blocked": user.is_blocked,
                    "blocked_reason": user.blocked_reason,
                    "blocked_at": user.blocked_at,
                    "integrations": {},
                    "login_platform": login_platform
                }
        except Exception as e:
            logger.error("Error validating session %s: %s", mask_session_id(session_id), e)
            return None

    def clear_all_user_tokens(self, user_id: int) -> bool:
        """РЈРґР°Р»РёС‚СЊ Р’РЎР• С‚РѕРєРµРЅС‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РїСЂРё Р»РѕРіР°СѓС‚Рµ. РђР»РёР°СЃ РґР»СЏ clear_user_tokens."""
        return self.clear_user_tokens(user_id)

    async def _notify_all_sessions_terminated_for_channel(self, channel_name: str, reason: str):
        """Р’СЃРїРѕРјРѕРіР°С‚РµР»СЊРЅС‹Р№ РјРµС‚РѕРґ РґР»СЏ СѓРІРµРґРѕРјР»РµРЅРёР№"""
        try:
            from core.connection_manager import get_connection_manager
            manager = get_connection_manager()
            await manager.notify_all_sessions_terminated_for_channel(channel_name, reason)
        except Exception as e:
            logger.error(f"Error in _notify_all_sessions_terminated_for_channel: {e}")

    def cleanup_old_sessions(self, days_old: int = 7) -> int:
        """РЈРґР°Р»СЏРµС‚ СЃС‚Р°СЂС‹Рµ РЅРµР°РєС‚РёРІРЅС‹Рµ СЃРµСЃСЃРёРё СЃС‚Р°СЂС€Рµ СѓРєР°Р·Р°РЅРЅРѕРіРѕ РєРѕР»РёС‡РµСЃС‚РІР° РґРЅРµР№."""
        from core.database import (
            UserSettings, TTSUserSettings, AudioSettings,
            LocalTTSEndpoint, FilteredWord, TTSBlockedUser,
            YouTubeQueue, DropsConfig, DropsReward,
            UserStreak, DropsHistory, MythicalDropsSession,
            UserToken
        )

        # РўР°Р±Р»РёС†С‹ РґР»СЏ РѕС‡РёСЃС‚РєРё РіРѕСЃС‚РµРІС‹С… СЃРµСЃСЃРёР№
        legacy_session_tables = [
            UserSettings, TTSUserSettings, AudioSettings, LocalTTSEndpoint,
            FilteredWord, TTSBlockedUser, YouTubeQueue, UserToken,
            DropsConfig, DropsReward, UserStreak, DropsHistory, MythicalDropsSession
        ]

        try:
            with db_session() as db:
                cutoff_date = utcnow_naive() - timedelta(days=days_old)

                old_sessions = db.query(UserSession).filter(
                    UserSession.is_active.is_(False),
                    UserSession.last_activity < cutoff_date
                ).all()

                count = len(old_sessions)
                if count == 0:
                    logger.debug(f"No old sessions to clean up (older than {days_old} days)")
                    return 0

                total_settings_deleted = 0

                for session in old_sessions:
                    # Р”Р»СЏ РіРѕСЃС‚РµРІС‹С… СЃРµСЃСЃРёР№ СѓРґР°Р»СЏРµРј СЃРІСЏР·Р°РЅРЅС‹Рµ РЅР°СЃС‚СЂРѕР№РєРё
                    if session.user_id == -1:
                        for table in legacy_session_tables:
                            if hasattr(table, 'session_id'):
                                total_settings_deleted += db.query(table).filter(
                                    table.session_id == session.session_id
                                ).delete()

                    db.delete(session)

                logger.info(f"[BROOM] Cleaned up {count} old inactive sessions (older than {days_old} days)")
                if total_settings_deleted > 0:
                    logger.info(f"[BROOM] Also deleted {total_settings_deleted} associated legacy session-scoped records")

                return count
        except Exception as e:
            logger.error(f"Error cleaning up old sessions: {e}")
            return 0

    def get_session_stats(self) -> dict:
        """Р’РѕР·РІСЂР°С‰Р°РµС‚ СЃС‚Р°С‚РёСЃС‚РёРєСѓ РїРѕ СЃРµСЃСЃРёСЏРј."""
        try:
            with db_session() as db:
                total_sessions = db.query(UserSession).count()
                active_sessions = db.query(UserSession).filter(UserSession.is_active).count()

                cutoff_date = utcnow_naive() - timedelta(days=7)
                old_inactive = db.query(UserSession).filter(
                    UserSession.is_active.is_(False),
                    UserSession.last_activity < cutoff_date
                ).count()

                return {
                    "total_sessions": total_sessions,
                    "active_sessions": active_sessions,
                    "inactive_sessions": total_sessions - active_sessions,
                    "old_inactive_sessions": old_inactive
                }
        except Exception as e:
            logger.error(f"Error getting session stats: {e}")
            return {}

session_manager = SessionManager()


