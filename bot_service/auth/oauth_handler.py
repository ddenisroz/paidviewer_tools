"""Shared OAuth handler for unified cross-platform authorization flows."""
import logging
from typing import Optional, Dict
from datetime import datetime
from core.datetime_utils import utcnow_naive
from fastapi import Request, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from core.database import User, UserSession, UserToken
from core.session_manager import session_manager
from core.token_encryption import encrypt_token
from constants import (
    Platform, ErrorMessages, FRONTEND_REDIRECTS
)
from starlette import status
from core.cookie_config import get_session_cookie_settings
from core.log_sanitizer import mask_session_id
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class OAuthUserData:
    """User data returned by an OAuth provider."""
    platform_user_id: str
    avatar_url: Optional[str]
    access_token: str
    refresh_token: Optional[str]
    expires_at: Optional[datetime]
    scopes: Optional[list]
    username: Optional[str] = None
    channel_name: Optional[str] = None

@dataclass
class OAuthResult:
    """OAuth authorization result."""
    user: User
    session_id: Optional[str]
    is_new_session: bool
    redirect_url: str

class OAuthHandler:
    """Reusable OAuth handler for all supported platforms."""

    def __init__(self):
        self.connection_manager = None

    def _resolve_vk_channel_name(self, user_data: OAuthUserData) -> Optional[str]:
        """Resolve VK channel slug; avoid display names with spaces."""
        if user_data.channel_name:
            candidate = user_data.channel_name.strip()
            if candidate.startswith("http://") or candidate.startswith("https://"):
                candidate = candidate.rstrip("/").split("/")[-1]
            if candidate and " " not in candidate and "/" not in candidate:
                return candidate

        candidate = user_data.username
        if candidate:
            candidate = candidate.strip()
            if candidate.startswith("http://") or candidate.startswith("https://"):
                candidate = candidate.rstrip("/").split("/")[-1]
        if candidate and " " not in candidate and "/" not in candidate:
            return candidate

        return None

    def _get_connection_manager(self):
        """Lazily import and cache the connection manager."""
        if self.connection_manager is None:
            from core.connection_manager import get_connection_manager
            connection_manager = get_connection_manager()
            self.connection_manager = connection_manager
        return self.connection_manager

    def _deactivate_other_platform_tokens(self, user_id: int, current_platform: str, db: Session):
        """
        Deactivate all user tokens except the token for the current platform.

        Security rule: a fresh login through platform X invalidates tokens for the
        other platforms until they are explicitly reconnected.

        Note: this method does not commit. The caller owns the transaction boundary.
        """
        logger.info(f"[DEACTIVATE] Deactivating other tokens for user {user_id}, keeping {current_platform}")

        other_tokens = db.query(UserToken).filter(
            UserToken.user_id == user_id,
            UserToken.platform != current_platform,
            UserToken.is_active.is_(True)
        ).all()

        if not other_tokens:
            logger.info(f"[DEACTIVATE] No other active tokens found for user {user_id}")
            return

        deactivated_platforms = []
        for token in other_tokens:
            token.is_active = False
            deactivated_platforms.append(token.platform)

        logger.info(f"[DEACTIVATE] Marked for deactivation for user {user_id}: {deactivated_platforms}")

    async def handle_oauth_callback(
        self,
        request: Request,
        db: Session,
        platform: str,
        user_data: OAuthUserData,
        current_user: Optional[Dict] = None,
        auto_connect_bot: bool = True
    ) -> OAuthResult:
        """
        Handle an OAuth callback for any supported platform.

        Args:
            request: FastAPI request object.
            db: Database session.
            platform: Platform name, for example twitch or vk.
            user_data: User data returned by the OAuth provider.
            current_user: Current authenticated user during account linking.
            auto_connect_bot: Whether to auto-connect the bot after authorization.

        Returns:
            OAuthResult with the resolved user and redirect metadata.
        """
        try:
            unified_user = None
            is_linking = current_user is not None

            session_id = request.cookies.get('session_id')
            logger.info("[OAUTH START] session_id from cookie: %s", mask_session_id(session_id))

            platform_fingerprint = f"{platform}:{user_data.platform_user_id}"
            logger.info(f"Checking platform fingerprint: {platform_fingerprint}")

            existing_token = None


            if platform == "vk":
                vk_channel = self._resolve_vk_channel_name(user_data) or user_data.platform_user_id
                channel_name = vk_channel.lower() if vk_channel else user_data.platform_user_id.lower()
            else:
                channel_name = user_data.username.lower() if user_data.username else user_data.platform_user_id.lower()
            from sqlalchemy import text
            json_query = "device_info->>'monitored_channel' = :channel"

            active_session = db.query(UserSession).filter(
                UserSession.is_active,
                text(json_query)
            ).params(channel=channel_name).first()

            if active_session:
                logger.info(
                    "Found active session %s for channel %s",
                    mask_session_id(active_session.session_id),
                    channel_name,
                )
                existing_user = db.query(User).filter(User.id == active_session.user_id).first()

                if is_linking and current_user and existing_user.id != current_user['id']:
                    logger.warning(f"Channel {channel_name} already served by user {existing_user.id}, replacing session")

                    active_session.is_active = False
                    active_session.ended_at = utcnow_naive()

                    device_info = {
                        "user_agent": request.headers.get("user-agent"),
                        "ip": getattr(request.client, 'host', 'unknown'),
                        "monitored_channel": channel_name,
                        "platform": platform,
                        "replaced_session": active_session.session_id
                    }

                    session_id = session_manager.create_session(
                        user_id=current_user['id'],
                        device_info=device_info
                    )
                    logger.info("[OK] Created replacement session: %s", mask_session_id(session_id))

                    if existing_user.id != current_user['id']:
                        session_manager._merge_user_accounts(existing_user.id, current_user['id'], db)
                        db.delete(existing_user)

                    unified_user = db.query(User).filter(User.id == current_user['id']).first()
                    logger.info(f"Replaced session for channel {channel_name}")

                else:
                    logger.info(f"Updating tokens for existing user {existing_user.id}")
                    unified_user = existing_user

                    if not is_linking:
                        logger.info("[SECURITY] New login detected - deactivating other platform tokens")
                        self._deactivate_other_platform_tokens(existing_user.id, platform, db)
                    else:
                        logger.info("[LINK] Linking integration - keeping other tokens active")

                    existing_token = db.query(UserToken).filter(
                        UserToken.user_id == existing_user.id,
                        UserToken.platform == platform
                    ).first()

                    if existing_token:
                        existing_token.access_token = encrypt_token(user_data.access_token)
                        existing_token.refresh_token = encrypt_token(user_data.refresh_token) if user_data.refresh_token else existing_token.refresh_token
                        existing_token.expires_at = user_data.expires_at
                        existing_token.scopes = user_data.scopes
                        existing_token.avatar_url = user_data.avatar_url
                        existing_token.is_active = True
                        logger.info(f"[OK] Token updated for platform {platform}")
                    else:
                        session_manager.save_user_tokens(
                            user_id=existing_user.id,
                            platform=platform,
                            platform_user_id=user_data.platform_user_id,
                            avatar_url=user_data.avatar_url,
                            access_token=user_data.access_token,
                            refresh_token=user_data.refresh_token,
                            expires_at=user_data.expires_at,
                            scopes=user_data.scopes
                        )
                        logger.info(f"[OK] New token created for platform {platform}")

                    from core.token_validation_cache import token_validation_cache
                    token_validation_cache.invalidate(existing_user.id, platform)
                    logger.info(f"[CACHE] Token validation cache invalidated for user {existing_user.id}, platform {platform}")

                    if platform == "twitch" and hasattr(user_data, 'username'):
                        unified_user.twitch_username = user_data.username
                    elif platform == "vk":
                        vk_channel = self._resolve_vk_channel_name(user_data)
                        vk_display = user_data.username or vk_channel
                        if vk_channel:
                            unified_user.vk_channel_name = vk_channel
                            logger.info(f"Updated VK channel_name: {vk_channel}")
                        else:
                            unified_user.vk_channel_name = None
                            logger.info("Cleared stale VK channel_name (no channel slug in OAuth data)")
                        if vk_display:
                            unified_user.vk_username = vk_display

                    db.commit()
                    logger.info(f"Updated {platform} tokens for user {unified_user.id}")


            else:
                if is_linking and current_user:
                    logger.info(f"Linking {platform} to existing user {current_user['id']}")
                    unified_user = db.query(User).filter(User.id == current_user['id']).first()

                    if not unified_user:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=ErrorMessages.USER_NOT_FOUND
                        )

                    session_manager.save_user_tokens(
                        user_id=unified_user.id,
                        platform=platform,
                        platform_user_id=user_data.platform_user_id,
                        avatar_url=user_data.avatar_url,
                        access_token=user_data.access_token,
                        refresh_token=user_data.refresh_token,
                        expires_at=user_data.expires_at,
                        scopes=user_data.scopes
                    )
                    from core.token_validation_cache import token_validation_cache
                    token_validation_cache.invalidate(unified_user.id, platform)
                    logger.info("[CACHE] Token validation cache invalidated after session creation")

                    if platform == "twitch" and hasattr(user_data, 'username'):
                        unified_user.twitch_username = user_data.username
                    elif platform == "vk":
                        vk_channel = self._resolve_vk_channel_name(user_data)
                        vk_display = user_data.username or vk_channel
                        if vk_channel:
                            unified_user.vk_channel_name = vk_channel
                            logger.info(f"Updated VK channel_name: {vk_channel}")
                        else:
                            unified_user.vk_channel_name = None
                            logger.info("Cleared stale VK channel_name (no channel slug in OAuth data)")
                        if vk_display:
                            unified_user.vk_username = vk_display

                    db.commit()
                    logger.info(f"Added {platform} integration to user {unified_user.id}")

                else:
                    logger.info(f"Creating new user for {platform} ID {user_data.platform_user_id}")
                    from core.user_creation_service import user_creation_service

                    unified_user = await user_creation_service.find_or_create_user(
                        db=db,
                        platform=platform,
                        platform_user_id=user_data.platform_user_id,
                        username=user_data.username,
                        avatar_url=user_data.avatar_url,
                        access_token=user_data.access_token,
                        refresh_token=user_data.refresh_token,
                        expires_at=user_data.expires_at,
                        scopes=user_data.scopes,
                        current_user_id=current_user.get('id') if current_user else None,
                        is_admin=False
                    )

                    if unified_user and not is_linking:
                         logger.info(f"[SECURITY] Login via {platform} (User ID {unified_user.id}) - deactivating other platform tokens")
                         self._deactivate_other_platform_tokens(unified_user.id, platform, db)
                         db.commit()

            if not unified_user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=ErrorMessages.USER_CREATION_FAILED
                )

            # NOTE: Token save and username update are already handled in each branch above
            # (active session update, linking, or new user creation).
            # We only need to invalidate cache and commit here.

            from core.token_validation_cache import token_validation_cache
            token_validation_cache.invalidate(unified_user.id, platform)
            logger.info(f"[CACHE] Token validation cache invalidated for user {unified_user.id}, platform {platform}")

            db.commit()
            logger.info(f"User {unified_user.id} updated with {platform} username: {getattr(unified_user, f'{platform}_username', 'None')}")

            is_new_session = False

            if not is_linking:
                is_new_session = True

                if existing_token:
                    logger.info(f"[SECURITY] New login detected for user {unified_user.id}. Terminating ALL old sessions...")
                    session_manager.terminate_user_sessions(unified_user.id, "new_device_login", db)
                    logger.info("[OK] All old sessions terminated. Creating new session...")

                    if platform == "vk":
                        vk_channel = self._resolve_vk_channel_name(user_data) or user_data.platform_user_id
                        monitored_channel = vk_channel.lower()
                    else:
                        monitored_channel = user_data.username.lower() if user_data.username else user_data.platform_user_id.lower()
                    device_info = {
                        "user_agent": request.headers.get("user-agent"),
                        "ip": getattr(request.client, 'host', 'unknown'),
                        "monitored_channel": monitored_channel,
                        "platform": platform
                    }
                    session_id = session_manager.create_session(
                        user_id=unified_user.id,
                        device_info=device_info
                    )
                    logger.info("[OK] New session created: %s", mask_session_id(session_id))
                else:
                    logger.info(f"[SECURITY] New user login. Terminating all sessions for user {unified_user.id}...")
                    session_manager.terminate_user_sessions(unified_user.id, "new_login", db)

                    if platform == "vk":
                        vk_channel = self._resolve_vk_channel_name(user_data) or user_data.platform_user_id
                        monitored_channel = vk_channel.lower()
                    else:
                        monitored_channel = user_data.username.lower() if user_data.username else user_data.platform_user_id.lower()
                    device_info = {
                        "user_agent": request.headers.get("user-agent"),
                        "ip": getattr(request.client, 'host', 'unknown'),
                        "monitored_channel": monitored_channel,
                        "platform": platform
                    }
                    logger.info(f"Creating session with device_info: {device_info}")
                    session_id = session_manager.create_session(
                        user_id=unified_user.id,
                        device_info=device_info
                    )
                    logger.info("[OK] New session created: %s", mask_session_id(session_id))

                try:
                    from core.connection_manager import get_connection_manager
                    connection_manager = get_connection_manager()
                    if platform == "vk":
                        channel_identifier = self._resolve_vk_channel_name(user_data) or user_data.platform_user_id
                    else:
                        channel_identifier = user_data.username if user_data.username else user_data.platform_user_id
                    connection_manager.add_active_session(channel_identifier, session_id)
                except Exception as e:
                    logger.error(f"Error notifying connection_manager about new session: {e}")

                await self._setup_user_channel_settings(db, unified_user.id, platform, user_data)

            if is_linking:
                await self._setup_user_channel_settings(db, unified_user.id, platform, user_data)

            if auto_connect_bot:
                logger.info(f"[AUTO-CONNECT] Starting auto-connect bot for platform={platform}")
                if platform == "vk":
                    channel_identifier = self._resolve_vk_channel_name(user_data) or user_data.platform_user_id
                else:
                    channel_identifier = user_data.username if user_data.username else user_data.platform_user_id
                logger.info(f"[AUTO-CONNECT] Channel identifier: {channel_identifier}")
                await self._auto_connect_bot(platform, channel_identifier)
                logger.info(f"[AUTO-CONNECT] Auto-connect completed for {platform}:{channel_identifier}")
            else:
                logger.info(f"[INFO] Auto-connect disabled for {platform}")

            redirect_url = self._get_redirect_url(platform, is_linking, is_new_session)

            return OAuthResult(
                user=unified_user,
                session_id=session_id,
                is_new_session=is_new_session,
                redirect_url=redirect_url
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"{platform.title()} auth error: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Internal server error during {platform} authentication"
            )

    def create_oauth_response(self, oauth_result: OAuthResult) -> RedirectResponse:
        """
        Build the redirect response and attach the session cookies.

        Args:
            oauth_result: OAuth authorization result.

        Returns:
            RedirectResponse with cookies applied.
        """
        response = RedirectResponse(url=oauth_result.redirect_url)

        if oauth_result.session_id:
            cookie_settings = get_session_cookie_settings(oauth_result.session_id)
            response.set_cookie(**cookie_settings)

        return response


    def _get_redirect_url(self, platform: str, is_linking: bool, is_new_session: bool) -> str:
        """Resolve the frontend redirect URL for the current auth flow."""
        if is_linking:
            return f"{FRONTEND_REDIRECTS['dashboard']}?auth_link={platform}&success=1"
        else:
            return f"{FRONTEND_REDIRECTS['dashboard']}?auth={platform}&success=1"

    async def _auto_connect_bot(self, platform: str, channel_name: str) -> None:
        """
        Automatically connect the bot to the channel after authorization.

        Args:
            platform: Platform name.
            channel_name: Channel identifier.
        """
        try:
            from core.connection_manager import get_connection_manager
            connection_manager = get_connection_manager()

            logger.info(f"[BOT] Attempting auto-connect for {platform} bot to channel {channel_name}")

            has_sessions = connection_manager.is_channel_active(channel_name)
            logger.info(f"[BOT] Active sessions for {channel_name}: {has_sessions}")

            # if not has_sessions:
            #     logger.info(f"[ERROR] No active sessions for channel {channel_name}, skipping bot connection")
            #     return

            if platform == Platform.TWITCH:
                logger.info(f"[BOT] Connecting Twitch bot to {channel_name}")
                await self._connect_twitch_bot(channel_name)
            elif platform == Platform.VK:
                logger.info(f"[BOT] Connecting VK Live bot to {channel_name}")
                await self._connect_vk_bot(channel_name)
            else:
                logger.warning(f"[WARN] Auto-connect not implemented for platform: {platform}")

        except Exception as e:
            logger.error(f"[ERROR] Error auto-connecting {platform} bot to {channel_name}: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")

    async def _connect_twitch_bot(self, channel_name: str) -> None:
        """Connect the Twitch bot after OAuth authorization."""
        try:
            from startup.bot_registry import get_bot_registry
            bot_instance = get_bot_registry().twitch_bot

            if bot_instance:
                logger.info(f"[BOT] Bot instance exists, attempting to join channel: {channel_name}")
                success = await bot_instance.join_channel(channel_name)
                if success:
                    logger.info(f"[OK] Twitch bot successfully connected to {channel_name} via OAuth")

                    import asyncio
                    await asyncio.sleep(2)
                    await bot_instance.send_welcome_message(channel_name)
                else:
                    logger.warning(f"[ERROR] Failed to connect Twitch bot to {channel_name} via OAuth")
            else:
                logger.error("[ERROR] Twitch bot instance not found. Bot was not created at startup.")

        except Exception as e:
            logger.error(f"[ERROR] Error connecting Twitch bot during OAuth: {e}")

    async def _connect_vk_bot(self, channel_name: str) -> None:
        """Connect the VK Live bot to the user channel after OAuth."""
        try:
            from core.connection_manager import get_connection_manager
            from core.database import get_db
            from startup.bot_initializer import initialize_vk_bot
            from startup.bot_registry import get_bot_registry

            registry = get_bot_registry()
            bot_instance = registry.vk_bot

            if not bot_instance:
                db = next(get_db())
                try:
                    connection_manager = get_connection_manager()
                    vk_channels = await connection_manager.get_vk_channels_for_bot(db)
                finally:
                    db.close()

                started = await initialize_vk_bot(vk_channels)
                if not started:
                    logger.error("[ERROR] VK Live bot is not started (bot OAuth token is likely missing)")
                    return

                bot_instance = get_bot_registry().vk_bot
                if not bot_instance:
                    logger.error("[ERROR] VK Live bot instance still missing after initialization")
                    return

            logger.info(f"[BOT] VK bot instance exists, attempting to connect to channel: {channel_name}")
            success = await bot_instance.connect_to_channel(channel_name)

            if success:
                logger.info(f"[OK] VK Live bot successfully connected to {channel_name} via OAuth")
            else:
                logger.warning(f"[ERROR] Failed to connect VK Live bot to {channel_name} via OAuth")

        except Exception as e:
            logger.error(f"Error connecting VK Live bot: {e}")

    async def _setup_user_channel_settings(self, db: Session, user_id: int, platform: str, user_data: OAuthUserData) -> None:
        """Store channel settings in UserSettings for automatic bot connection."""
        try:
            from core.database import UserSettings

            settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
            if not settings:
                settings = UserSettings(
                    user_id=user_id,
                    chat_enabled=True
                )
                db.add(settings)
                db.flush()

            if platform == "twitch":
                channel_name = user_data.username.lower()
                settings.channel_name = channel_name
                logger.info(f"[OK] Set Twitch channel_name: {channel_name}")
            elif platform == "vk":
                channel_name = self._resolve_vk_channel_name(user_data)
                if channel_name:
                    settings.vk_channel_name = channel_name.lower()
                    logger.info(f"[OK] Set VK channel_name: {channel_name}")
                else:
                    settings.vk_channel_name = None
                    logger.info("[OK] Cleared VK channel_name in UserSettings (no channel slug)")

            db.commit()
            logger.info(f"[OK] UserSettings updated for user {user_id}, platform {platform}")

        except Exception as e:
            logger.error(f"Error setting up user channel settings: {e}")
            db.rollback()

oauth_handler = OAuthHandler()
