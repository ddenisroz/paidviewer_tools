# bot_service/api/commands.py
"""
API РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ РєРѕРјР°РЅРґР°РјРё Р±РѕС‚Р°.
Following Clean Architecture - only routing, no business logic.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from starlette.requests import Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional, Dict, Any

from core.database import get_db
from auth.auth import get_current_user, get_current_user_optional
from utils.enhanced_logger import log_request, log_response, commands_logger
from validators.input_validators import sanitize_input
from core.security_modern import limiter
from services.command_service import CommandService

logger = logging.getLogger('bot_service')

router = APIRouter(prefix="/api/commands", tags=["commands"])


# ===== Pydantic Models =====

class CommandCreate(BaseModel):
    """РЎРѕР·РґР°РЅРёРµ РЅРѕРІРѕР№ РєРѕРјР°РЅРґС‹"""
    command_name: str
    response_text: str
    platforms: str = "twitch,vk"
    allowed_roles: str = "all"
    cooldown_seconds: int = 0
    is_enabled: bool = True

    @field_validator('command_name')
    @classmethod
    def sanitize_command_name(cls, v):
        """РЎР°РЅРёС‚РёР·Р°С†РёСЏ РёРјРµРЅРё РєРѕРјР°РЅРґС‹"""
        if not v or not v.strip():
            raise ValueError('Command name cannot be empty')
        return sanitize_input(v, max_length=20)

    @field_validator('response_text')
    @classmethod
    def sanitize_response_text(cls, v):
        """РЎР°РЅРёС‚РёР·Р°С†РёСЏ С‚РµРєСЃС‚Р° РѕС‚РІРµС‚Р°"""
        return sanitize_input(v, max_length=500)


class CommandUpdate(BaseModel):
    """РћР±РЅРѕРІР»РµРЅРёРµ РєРѕРјР°РЅРґС‹"""
    is_enabled: Optional[bool] = None
    platforms: Optional[str] = None
    allowed_roles: Optional[str] = None
    cooldown_seconds: Optional[int] = None
    response_text: Optional[str] = None
    extra_settings: Optional[Dict[str, Any]] = None

    @field_validator('response_text')
    @classmethod
    def sanitize_response_text(cls, v):
        """РЎР°РЅРёС‚РёР·Р°С†РёСЏ С‚РµРєСЃС‚Р° РѕС‚РІРµС‚Р° РїСЂРё РѕР±РЅРѕРІР»РµРЅРёРё"""
        if v is not None:
            return sanitize_input(v, max_length=500)
        return v


class CommandOverrideCreate(BaseModel):
    """РЎРѕР·РґР°РЅРёРµ user override РґР»СЏ Р±Р°Р·РѕРІРѕР№ РєРѕРјР°РЅРґС‹"""
    command_name: str
    alias: Optional[str] = None
    platforms: Optional[str] = None
    allowed_roles: Optional[str] = None
    cooldown_seconds: Optional[int] = None
    is_enabled: Optional[bool] = True
    extra_settings: Optional[Dict[str, Any]] = None


class CommandResponse(BaseModel):
    """РћС‚РІРµС‚ СЃ РёРЅС„РѕСЂРјР°С†РёРµР№ Рѕ РєРѕРјР°РЅРґРµ"""
    id: int
    command_name: str
    response_text: str
    platforms: str
    allowed_roles: str
    cooldown_seconds: int
    is_enabled: bool
    description: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ===== Dependency =====

def get_command_service() -> CommandService:
    """Get CommandService instance."""
    return CommandService()

def _command_error_message(status_code: int) -> str:
    if status_code == 404:
        return "Command not found"
    if status_code == 403:
        return "Insufficient permissions"
    return "Invalid command data"


def _is_not_found_error(error_text: str) -> bool:
    normalized = error_text.lower()
    return any(
        marker in normalized
        for marker in (
            "not found",
            "\u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d",   # не найден
            "\u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430",  # не найдена
        )
    )


def _is_forbidden_error(error_text: str) -> bool:
    normalized = error_text.lower()
    return any(
        marker in normalized
        for marker in (
            "forbidden",
            "permission",
            "\u043d\u0435\u0442 \u043f\u0440\u0430\u0432",  # нет прав
            "\u043d\u0435\u043b\u044c\u0437\u044f",  # нельзя
        )
    )


# ===== API Endpoints =====

@router.get("/")
async def get_commands(
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РёС‚СЊ РІСЃРµ РєРѕРјР°РЅРґС‹"""
    user_id = current_user.get('id') if current_user else None
    log_request("/api/commands", "GET", None, user_id)
    commands_logger.info(f"Getting commands for {'guest' if not user_id or user_id == -1 else f'user {user_id}'}")
    
    try:
        service = get_command_service()
        result = service.get_all_commands_for_user(user_id, db)
        log_response("/api/commands", 200, result)
        return result
    except Exception as e:
        commands_logger.error(f"[X] Error getting commands: {e}", exc_info=True)
        log_response("/api/commands", 500, {"error": "Internal server error"})
        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РєРѕРјР°РЅРґ")


@router.get("")
async def get_commands_no_slash(
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РёС‚СЊ РІСЃРµ РєРѕРјР°РЅРґС‹ (Р±РµР· СЃР»РµС€Р°)"""
    return await get_commands(current_user, db)


@router.post("/")
@limiter.limit("20/minute")
async def create_command(
    request: Request,
    command_data: CommandCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РЎРѕР·РґР°С‚СЊ РЅРѕРІСѓСЋ РєР°СЃС‚РѕРјРЅСѓСЋ РєРѕРјР°РЅРґСѓ"""
    try:
        service = get_command_service()
        result = service.create_custom_command(
            user_id=current_user["id"],
            command_name=command_data.command_name,
            response_text=command_data.response_text,
            platforms=command_data.platforms,
            allowed_roles=command_data.allowed_roles,
            cooldown_seconds=command_data.cooldown_seconds,
            is_enabled=command_data.is_enabled,
            db=db
        )
        return result

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid command data")
    except Exception as e:
        logger.error(f"Error creating command: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ РєРѕРјР°РЅРґС‹")


@router.put("/{command_id}")
@limiter.limit("30/minute")
async def update_command(
    request: Request,
    command_id: int,
    command_data: CommandUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РћР±РЅРѕРІРёС‚СЊ РєРѕРјР°РЅРґСѓ РїРѕ ID"""
    try:
        service = get_command_service()
        result = service.update_command(
            command_id=command_id,
            user_id=current_user["id"],
            update_data=command_data.model_dump(exclude_unset=True),
            db=db
        )
        return result

    except ValueError as e:
        error_text = str(e)
        status_code = 404 if _is_not_found_error(error_text) else 403 if _is_forbidden_error(error_text) else 400
        raise HTTPException(status_code=status_code, detail=_command_error_message(status_code))
    except Exception as e:
        logger.error(f"Error updating command: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ РєРѕРјР°РЅРґС‹")


@router.post("/override")
@limiter.limit("20/minute")
async def create_command_override(
    request: Request,
    override_data: CommandOverrideCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РЎРѕР·РґР°С‚СЊ user override РґР»СЏ РіР»РѕР±Р°Р»СЊРЅРѕР№ РєРѕРјР°РЅРґС‹"""
    try:
        service = get_command_service()
        result = service.create_command_override(
            user_id=current_user["id"],
            command_name=override_data.command_name,
            alias=override_data.alias,
            platforms=override_data.platforms,
            allowed_roles=override_data.allowed_roles,
            cooldown_seconds=override_data.cooldown_seconds,
            is_enabled=override_data.is_enabled,
            extra_settings=override_data.extra_settings,
            db=db
        )
        return result

    except ValueError as e:
        status_code = 404 if _is_not_found_error(str(e)) else 400
        raise HTTPException(status_code=status_code, detail=_command_error_message(status_code))
    except Exception as e:
        logger.error(f"Error creating override: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ override")


@router.delete("/{command_id}")
@limiter.limit("30/minute")
async def delete_command(
    request: Request,
    command_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РЈРґР°Р»РёС‚СЊ РєР°СЃС‚РѕРјРЅСѓСЋ РєРѕРјР°РЅРґСѓ"""
    try:
        service = get_command_service()
        result = service.delete_command(
            command_id=command_id,
            user_id=current_user["id"],
            db=db
        )
        return result

    except ValueError as e:
        status_code = 404 if _is_not_found_error(str(e)) else 403
        raise HTTPException(status_code=status_code, detail=_command_error_message(status_code))
    except Exception as e:
        logger.error(f"Error deleting command: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ РєРѕРјР°РЅРґС‹")

