# bot_service/api/commands_api.py
"""API для управления командами бота"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from core.database import get_db, BotCommand
from auth.auth import get_current_user
from utils.enhanced_logger import log_api_call, log_request, log_response, commands_logger

logger = logging.getLogger('bot_service')

router = APIRouter(prefix="/api/commands", tags=["commands"])

# ===== Pydantic Models =====

class CommandCreate(BaseModel):
    """Создание новой команды"""
    command_name: str
    response_text: str
    platforms: str = "twitch,vk"  # comma-separated
    allowed_roles: str = "all"    # comma-separated
    cooldown_seconds: int = 0
    is_enabled: bool = True

class CommandUpdate(BaseModel):
    """Обновление команды"""
    is_enabled: Optional[bool] = None
    platforms: Optional[str] = None
    allowed_roles: Optional[str] = None
    cooldown_seconds: Optional[int] = None
    response_text: Optional[str] = None

class CommandResponse(BaseModel):
    """Ответ с информацией о команде"""
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

# ===== API Endpoints =====

@router.get("/")
async def get_commands(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все команды"""
    return await _get_commands_impl(current_user, db)

@router.get("")
async def get_commands_no_slash(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все команды (без слеша)"""
    return await _get_commands_impl(current_user, db)

async def _get_commands_impl(current_user: dict, db: Session):
    user_id = current_user.get('id')
    log_request("/api/commands", "GET", None, user_id)
    commands_logger.info(f"Getting commands for user {user_id}")
    
    try:
        # Получаем базовые команды пользователя
        basic_commands = db.query(BotCommand).filter(
            BotCommand.command_type == 'basic',
            BotCommand.user_id == current_user["id"]
        ).all()
        
        # Получаем кастомные команды пользователя
        custom_commands = db.query(BotCommand).filter(
            BotCommand.command_type == 'custom',
            BotCommand.user_id == current_user["id"]
        ).all()
        
        # Преобразуем в нужный формат
        basic_commands_data = []
        for cmd in basic_commands:
            # Парсим теги из строки в список
            tags = []
            if cmd.tags:
                tags = [tag.strip() for tag in cmd.tags.split(',') if tag.strip()]
            
            basic_commands_data.append({
                "id": cmd.id,
                "command_name": cmd.command_name,
                "response_text": cmd.response_text,
                "platforms": cmd.platforms or "twitch,vk",
                "allowed_roles": cmd.allowed_roles or "all",
                "cooldown_seconds": cmd.cooldown_seconds or 0,
                "is_enabled": cmd.is_enabled,
                "description": cmd.description,
                "created_at": cmd.created_at.isoformat() if cmd.created_at else None,
                "updated_at": cmd.updated_at.isoformat() if cmd.updated_at else None,
                "tags": tags  # Используем реальные теги из базы
            })
        
        custom_commands_data = []
        for cmd in custom_commands:
            # Парсим теги из строки в список
            tags = ["custom"]  # Кастомные команды всегда имеют тег "custom"
            if cmd.tags:
                tags.extend([tag.strip() for tag in cmd.tags.split(',') if tag.strip()])
            
            custom_commands_data.append({
                "id": cmd.id,
                "command_name": cmd.command_name,
                "response_text": cmd.response_text,
                "platforms": cmd.platforms or "twitch,vk",
                "allowed_roles": cmd.allowed_roles or "all",
                "cooldown_seconds": cmd.cooldown_seconds or 0,
                "is_enabled": cmd.is_enabled,
                "description": cmd.description,
                "created_at": cmd.created_at.isoformat() if cmd.created_at else None,
                "updated_at": cmd.updated_at.isoformat() if cmd.updated_at else None,
                "tags": tags  # Используем реальные теги из базы + "custom"
            })
        
        result = {
            "success": True,
            "basic_commands": basic_commands_data,
            "custom_commands": custom_commands_data
        }
        commands_logger.info(f"✓ Returned {len(basic_commands_data)} basic + {len(custom_commands_data)} custom commands")
        log_response("/api/commands", 200, result)
        return result
        
    except Exception as e:
        commands_logger.error(f"✗ Error getting commands: {e}", exc_info=True)
        log_response("/api/commands", 500, {"error": str(e)})
        raise HTTPException(status_code=500, detail="Ошибка получения команд")

@router.post("/")
async def create_command(
    command_data: CommandCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новую кастомную команду"""
    return await _create_command_impl(command_data, current_user, db)

@router.post("")
async def create_command_no_slash(
    command_data: CommandCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новую кастомную команду (без слэша)"""
    return await _create_command_impl(command_data, current_user, db)

async def _create_command_impl(command_data: CommandCreate, current_user: dict, db: Session):
    try:
        # Проверяем, не существует ли уже такая команда
        existing_command = db.query(BotCommand).filter(
            BotCommand.command_name == command_data.command_name,
            BotCommand.user_id == current_user["id"]
        ).first()
        
        if existing_command:
            raise HTTPException(status_code=400, detail="Команда с таким именем уже существует")
        
        # Создаем новую команду
        new_command = BotCommand(
            user_id=current_user["id"],
            channel_name="default",  # Пока используем default
            command_name=command_data.command_name,
            command_type="custom",
            response_text=command_data.response_text,
            platforms=command_data.platforms,
            allowed_roles=command_data.allowed_roles,
            cooldown_seconds=command_data.cooldown_seconds,
            is_enabled=command_data.is_enabled
        )
        
        db.add(new_command)
        db.commit()
        db.refresh(new_command)
        
        return {
            "success": True,
            "message": "Команда создана успешно",
            "data": {
                "id": new_command.id,
                "command_name": new_command.command_name
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating command: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка создания команды")

@router.put("/{command_name}")
async def update_command(
    command_name: str,
    command_data: CommandUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить команду"""
    try:
        # Ищем команду
        command = db.query(BotCommand).filter(
            BotCommand.command_name == command_name
        ).first()
        
        if not command:
            raise HTTPException(status_code=404, detail="Команда не найдена")
        
        # Проверяем права доступа
        if command.command_type == "custom" and command.user_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Нет прав для изменения этой команды")
        
        # Обновляем поля
        if command_data.is_enabled is not None:
            command.is_enabled = command_data.is_enabled
        if command_data.platforms is not None:
            command.platforms = command_data.platforms
        if command_data.allowed_roles is not None:
            command.allowed_roles = command_data.allowed_roles
        if command_data.cooldown_seconds is not None:
            command.cooldown_seconds = command_data.cooldown_seconds
        if command_data.response_text is not None:
            command.response_text = command_data.response_text
        
        db.commit()
        
        return {
            "success": True,
            "message": "Команда обновлена успешно"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating command: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка обновления команды")

@router.delete("/{command_id}")
async def delete_command(
    command_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить кастомную команду"""
    try:
        # Ищем команду
        command = db.query(BotCommand).filter(
            BotCommand.id == command_id
        ).first()
        
        if not command:
            raise HTTPException(status_code=404, detail="Команда не найдена")
        
        # Проверяем права доступа
        if command.command_type == "basic":
            raise HTTPException(status_code=403, detail="Нельзя удалить базовую команду")
        if command.user_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Нет прав для удаления этой команды")
        
        db.delete(command)
        db.commit()
        
        return {
            "success": True,
            "message": "Команда удалена успешно"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting command: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка удаления команды")
