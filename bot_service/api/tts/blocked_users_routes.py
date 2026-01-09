# features/tts/api/blocked_users_router.py
"""
TTS Blocked Users Router
Handles: block/unblock users from TTS
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from auth.auth import get_current_user
from services.user_identity_service import UserIdentityService
from services.tts.tts_service import TTSService
from services.tts.tts_core import BlockUserRequest, UnblockUserRequest

logger = logging.getLogger('bot_service')

blocked_users_router = APIRouter(tags=["tts-blocked-users"])


@blocked_users_router.get("/blocked-users")
async def get_blocked_users(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список заблокированных пользователей"""
    try:
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")

        tts_service = TTSService(db)
        user_identifier = UserIdentityService.get_user_identifier(current_user)
        blocked_users = await tts_service.get_blocked_users(user_identifier)
        return {"success": True, "blocked_users": blocked_users}
    except Exception as e:
        logger.error(f"Error getting blocked users: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения черного списка")


@blocked_users_router.post("/block")
async def block_user(
    request: BlockUserRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Заблокировать пользователя"""
    try:
        tts_service = TTSService(db)
        success = await tts_service.block_user(
            current_user['id'],
            request.channel_name,
            request.platform,
            request.username
        )

        if success:
            return {"success": True, "message": f"Пользователь {request.username} заблокирован"}
        else:
            raise HTTPException(status_code=400, detail="Ошибка блокировки пользователя")

    except Exception as e:
        logger.error(f"Error blocking user: {e}")
        raise HTTPException(status_code=500, detail="Ошибка блокировки пользователя")


@blocked_users_router.post("/unblock")
async def unblock_user(
    request: UnblockUserRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Разблокировать пользователя"""
    try:
        tts_service = TTSService(db)
        success = await tts_service.unblock_user(
            current_user['id'],
            request.channel_name,
            request.platform,
            request.username
        )

        if success:
            return {"success": True, "message": f"Пользователь {request.username} разблокирован"}
        else:
            raise HTTPException(status_code=400, detail="Ошибка разблокировки пользователя")

    except Exception as e:
        logger.error(f"Error unblocking user: {e}")
        raise HTTPException(status_code=500, detail="Ошибка разблокировки пользователя")


# Alias endpoints for /blocked-users path
@blocked_users_router.get("/blocked")
async def get_blocked_users_list(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список всех заблокированных пользователей от TTS (alias)"""
    return await get_blocked_users(current_user, db)


@blocked_users_router.post("/blocked")
async def add_blocked_user(
    request: BlockUserRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Добавить пользователя в черный список TTS (alias)"""
    return await block_user(request, current_user, db)


@blocked_users_router.delete("/blocked/{blocked_user_id}")
async def remove_blocked_user(
    blocked_user_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить пользователя из черного списка TTS"""
    try:
        tts_service = TTSService(db)
        success = await tts_service.remove_blocked_user_by_id(current_user['id'], blocked_user_id)

        if success:
            return {"success": True, "message": "Пользователь удален из черного списка"}
        else:
            raise HTTPException(status_code=404, detail="Запись не найдена")

    except Exception as e:
        logger.error(f"Error removing blocked user: {e}")
        raise HTTPException(status_code=500, detail="Ошибка удаления из черного списка")
