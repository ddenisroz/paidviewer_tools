"""
Admin Blocked Channels API.
Clean Architecture: uses BlockedChannelRepository for data access.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from auth.auth import get_current_user
from repositories.blocked_channel_repository import BlockedChannelRepository
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _channel_to_dict(channel) -> dict:
    """Convert blocked channel model to dict for response."""
    return {
        "id": channel.id,
        "channel_name": channel.channel_name,
        "reason": channel.reason,
        "blocked_by": channel.blocked_by,
        "is_active": channel.is_active,
        "created_at": channel.created_at.isoformat() if channel.created_at else None
    }


@router.get("/blocked-channels")
async def get_blocked_channels(
    page: int = 1,
    limit: int = 50,
    search: str = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список заблокированных каналов"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        repo = BlockedChannelRepository(db)
        blocked_channels, total = repo.get_active_paginated(search=search, page=page, limit=limit)
        
        return {
            "success": True,
            "blocked_channels": [_channel_to_dict(bc) for bc in blocked_channels],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit if limit > 0 else 0
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting blocked channels: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения заблокированных каналов")


@router.post("/blocked-channels")
async def block_channel(
    channel_name: str,
    reason: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Заблокировать канал"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Валидация
        if not channel_name or len(channel_name.strip()) < 2:
            raise HTTPException(status_code=400, detail="Channel name должна быть минимум 2 символа")
        
        repo = BlockedChannelRepository(db)
        
        # Проверяем, не заблокирован ли уже
        if repo.is_blocked(channel_name):
            raise HTTPException(status_code=400, detail=f"Channel {channel_name} is already blocked")
        
        blocked_channel = repo.block(
            channel_name=channel_name,
            reason=reason,
            blocked_by=user.get('username')
        )
        
        logger.info(f"[BLOCKED] Blocked channel: {channel_name} by {user.get('username')} (reason: {reason})")
        
        return {
            "success": True,
            "channel_id": blocked_channel.id,
            "message": f"Channel {channel_name} has been blocked"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error blocking channel: {e}")
        raise HTTPException(status_code=500, detail="Ошибка блокировки канала")


@router.patch("/blocked-channels/{channel_id}")
async def update_blocked_channel(
    channel_id: int,
    reason: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить информацию о заблокированном канале"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        repo = BlockedChannelRepository(db)
        
        if reason:
            channel = repo.update_reason(channel_id, reason)
            if not channel:
                raise HTTPException(status_code=404, detail="Blocked channel not found")
            
            logger.info(f"[ADMIN] Updated blocked channel: {channel.channel_name}")
        
        return {
            "success": True,
            "message": "Blocked channel updated"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating blocked channel: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обновления заблокированного канала")


@router.delete("/blocked-channels/{channel_id}")
async def unblock_channel(
    channel_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Разблокировать канал (мягкое удаление)"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        repo = BlockedChannelRepository(db)
        channel = repo.unblock(channel_id)
        
        if not channel:
            raise HTTPException(status_code=404, detail="Blocked channel not found")
        
        logger.info(f"[OK] Unblocked channel: {channel.channel_name} by {user.get('username')}")
        
        return {
            "success": True,
            "message": f"Channel {channel.channel_name} has been unblocked"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unblocking channel: {e}")
        raise HTTPException(status_code=500, detail="Ошибка разблокировки канала")

