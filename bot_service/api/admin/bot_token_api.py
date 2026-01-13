"""
API для управления и мониторинга токенов ботов.

Только для администраторов.
"""

import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException

from core.permissions import require_role, AppRole
from services.bot_token_validator import bot_token_validator

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/admin/bot", tags=["admin", "bot-tokens"])


@router.get("/token-status")
async def get_bot_tokens_status(
    current_user: Dict[str, Any] = Depends(require_role(AppRole.ADMIN))
) -> Dict[str, Any]:
    """
    Получить статус токенов ботов.
    
    Требует права администратора.
    
    Returns:
        dict: Статус всех токенов ботов
    """
    try:
        status = bot_token_validator.get_status()
        return {
            "success": True,
            "data": status
        }
    except Exception as e:
        logger.error(f"Error getting bot tokens status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate")
async def validate_bot_tokens(
    current_user: Dict[str, Any] = Depends(require_role(AppRole.ADMIN))
) -> Dict[str, Any]:
    """
    Принудительно валидировать все токены ботов.
    
    Требует права администратора.
    
    Returns:
        dict: Результаты валидации
    """
    try:
        results = await bot_token_validator.validate_all_tokens()
        
        return {
            "success": True,
            "data": results,
            "message": "Token validation completed"
        }
    except Exception as e:
        logger.error(f"Error validating bot tokens: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate/twitch")
async def validate_twitch_token(
    current_user: Dict[str, Any] = Depends(require_role(AppRole.ADMIN))
) -> Dict[str, Any]:
    """
    Валидировать Twitch bot token.
    
    Требует права администратора.
    
    Returns:
        dict: Результат валидации
    """
    try:
        result = await bot_token_validator.validate_twitch_bot_token()
        
        return {
            "success": result['valid'],
            "data": result,
            "message": "Twitch token is valid" if result['valid'] else "Twitch token is invalid"
        }
    except Exception as e:
        logger.error(f"Error validating Twitch token: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate/vk")
async def validate_vk_token(
    current_user: Dict[str, Any] = Depends(require_role(AppRole.ADMIN))
) -> Dict[str, Any]:
    """
    Валидировать VK Live bot token.
    
    Требует права администратора.
    
    Returns:
        dict: Результат валидации
    """
    try:
        result = await bot_token_validator.validate_vk_bot_token()
        
        return {
            "success": result['valid'],
            "data": result,
            "message": "VK token is valid" if result['valid'] else "VK token is invalid"
        }
    except Exception as e:
        logger.error(f"Error validating VK token: {e}")
        raise HTTPException(status_code=500, detail=str(e))
