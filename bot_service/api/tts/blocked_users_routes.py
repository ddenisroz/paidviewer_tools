"""
TTS Blocked Users Router
Handles: block/unblock users from TTS
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from auth.auth import get_current_user
from core.database import get_db
from services.tts.tts_core import BlockUserRequest, UnblockUserRequest
from services.tts.tts_service import TTSService
from services.user_identity_service import UserIdentityService

logger = logging.getLogger('bot_service')

blocked_users_router = APIRouter(prefix='/api/tts', tags=['tts-blocked-users'])


def _resolve_channel_name(current_user: dict, platform: str, explicit_channel_name: Optional[str]) -> Optional[str]:
    if explicit_channel_name:
        return explicit_channel_name.strip()

    if platform == 'twitch':
        return (
            current_user.get('twitch_username')
            or current_user.get('username')
            or ''
        ).strip() or None

    if platform == 'vk':
        return (
            current_user.get('vk_username')
            or current_user.get('vk_channel_name')
            or current_user.get('username')
            or ''
        ).strip() or None

    return None


def _resolve_identity(current_user: dict, request: Request) -> tuple[Optional[int], Optional[str]]:
    if current_user.get('is_guest'):
        return None, request.cookies.get('session_id')

    user_id = current_user.get('id')
    return (int(user_id), None) if user_id not in (None, -1) else (None, None)


@blocked_users_router.get('/blocked-users')
async def get_blocked_users(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get blocked users list."""
    try:
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail='Invalid user data')

        tts_service = TTSService(db)
        user_id, session_id = _resolve_identity(current_user, request)
        blocked_users = await tts_service.get_blocked_users(user_id=user_id, session_id=session_id)
        return {'success': True, 'data': blocked_users}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting blocked users")
        raise HTTPException(status_code=500, detail='Failed to load blocked users')


@blocked_users_router.post('/block')
async def block_user(
    http_request: Request,
    request: BlockUserRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Block a user from TTS."""
    try:
        tts_service = TTSService(db)
        user_id, session_id = _resolve_identity(current_user, http_request)
        channel_name = _resolve_channel_name(current_user, request.platform, request.channel_name)

        if not channel_name:
            raise HTTPException(status_code=400, detail='Failed to resolve channel_name')

        # Idempotent: if already blocked, return success to avoid UI hard-fail.
        if tts_service.blocked_user_repo.is_blocked(
            channel_name=channel_name,
            platform=request.platform,
            username=request.username,
            user_id=user_id,
            session_id=session_id,
        ):
            return {
                'success': True,
                'message': f'User {request.username} is already blocked',
                'already_blocked': True,
            }

        success = await tts_service.block_user(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=request.platform,
            username=request.username,
        )

        if success:
            return {'success': True, 'message': f'User {request.username} blocked'}

        raise HTTPException(status_code=400, detail='Failed to block user')

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error blocking user")
        raise HTTPException(status_code=500, detail='Failed to block user')


@blocked_users_router.post('/unblock')
async def unblock_user(
    http_request: Request,
    request: UnblockUserRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unblock a user from TTS."""
    try:
        tts_service = TTSService(db)
        user_id, session_id = _resolve_identity(current_user, http_request)
        channel_name = _resolve_channel_name(current_user, request.platform, request.channel_name)

        if not channel_name:
            raise HTTPException(status_code=400, detail='Failed to resolve channel_name')

        success = await tts_service.unblock_user(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=request.platform,
            username=request.username,
        )

        if success:
            return {'success': True, 'message': f'User {request.username} unblocked'}

        raise HTTPException(status_code=400, detail='Failed to unblock user')

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error unblocking user")
        raise HTTPException(status_code=500, detail='Failed to unblock user')


# Alias endpoints for /blocked path
@blocked_users_router.get('/blocked')
async def get_blocked_users_list(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Alias for get blocked users."""
    return await get_blocked_users(request, current_user, db)


@blocked_users_router.post('/blocked')
async def add_blocked_user(
    http_request: Request,
    request: BlockUserRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Alias for block user."""
    return await block_user(http_request, request, current_user, db)


@blocked_users_router.delete('/blocked/{blocked_user_id}')
async def remove_blocked_user(
    blocked_user_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete blocked user by id."""
    try:
        tts_service = TTSService(db)
        # Keep legacy behavior if method exists.
        if not hasattr(tts_service, 'remove_blocked_user_by_id'):
            raise HTTPException(status_code=501, detail='remove_blocked_user_by_id is not implemented')

        success = await tts_service.remove_blocked_user_by_id(current_user['id'], blocked_user_id)
        if success:
            return {'success': True, 'message': 'Blocked user removed'}

        raise HTTPException(status_code=404, detail='Record not found')

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error removing blocked user")
        raise HTTPException(status_code=500, detail='Failed to remove blocked user')

