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

class CommandOverrideCreate(BaseModel):
    """Создание user override для базовой команды"""
    command_name: str  # Название глобальной команды для переопределения
    alias: Optional[str] = None  # Пользовательский алиас (например !song вместо !sr)
    platforms: Optional[str] = None  # Переопределить платформы
    allowed_roles: Optional[str] = None  # Переопределить права доступа
    cooldown_seconds: Optional[int] = None  # Переопределить кулдаун
    is_enabled: Optional[bool] = True  # Включена ли команда

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
        # 1. Получаем ГЛОБАЛЬНЫЕ команды (доступны всем)
        global_commands = db.query(BotCommand).filter(
            BotCommand.command_type == 'global',
            BotCommand.user_id == None
        ).all()
        
        # 2. Получаем USER OVERRIDES (персональные настройки базовых команд)
        override_commands = db.query(BotCommand).filter(
            BotCommand.command_type == 'override',
            BotCommand.user_id == current_user["id"]
        ).all()
        
        # 3. Получаем КАСТОМНЫЕ команды пользователя
        custom_commands = db.query(BotCommand).filter(
            BotCommand.command_type == 'custom',
            BotCommand.user_id == current_user["id"]
        ).all()
        
        # Преобразуем команды в нужный формат
        def command_to_dict(cmd, command_type_label):
            """Вспомогательная функция для преобразования команды"""
            # Теги теперь хранятся как одна категория (не разделены запятыми)
            # Например: "TTS ИИ озвучка", "Медиа и интерактивность"
            tags = []
            if cmd.tags:
                # Если в теге есть запятая - это старый формат, разбиваем
                # Если нет - это новый формат (одна категория)
                if ',' in cmd.tags:
                    tags = [tag.strip() for tag in cmd.tags.split(',') if tag.strip()]
                else:
                    tags = [cmd.tags.strip()]
            
            return {
                "id": cmd.id,
                "command_name": cmd.command_name,
                "response_text": cmd.response_text or "",
                "platforms": cmd.platforms or "twitch,vk",
                "allowed_roles": cmd.allowed_roles or "all",
                "cooldown_seconds": cmd.cooldown_seconds or 0,
                "is_enabled": cmd.is_enabled,
                "description": cmd.description,
                "command_type": cmd.command_type,
                "parent_command_id": cmd.parent_command_id,
                "alias": cmd.alias,
                "created_at": cmd.created_at.isoformat() if cmd.created_at else None,
                "updated_at": cmd.updated_at.isoformat() if cmd.updated_at else None,
                "tags": tags
            }
        
        # Формируем глобальные команды
        global_commands_data = [command_to_dict(cmd, "global") for cmd in global_commands]
        
        # Формируем user overrides
        override_commands_data = [command_to_dict(cmd, "override") for cmd in override_commands]
        
        # Для basic_commands объединяем global + overrides
        # Overrides имеют приоритет над global командами с тем же именем
        basic_commands_dict = {}
        
        # Сначала добавляем глобальные команды
        for cmd_data in global_commands_data:
            basic_commands_dict[cmd_data["command_name"]] = cmd_data
        
        # Затем перезаписываем overrides (они имеют приоритет)
        for cmd_data in override_commands_data:
            # Для override используем parent_command_id чтобы найти имя глобальной команды
            parent_cmd = next((g for g in global_commands_data if g["id"] == cmd_data["parent_command_id"]), None)
            if parent_cmd:
                # Override перезаписывает глобальную команду
                basic_commands_dict[parent_cmd["command_name"]] = cmd_data
        
        basic_commands_data = list(basic_commands_dict.values())
        
        # Формируем кастомные команды
        custom_commands_data = [command_to_dict(cmd, "custom") for cmd in custom_commands]
        
        result = {
            "success": True,
            "global_commands": global_commands_data,  # Глобальные команды
            "override_commands": override_commands_data,  # User overrides
            "basic_commands": basic_commands_data,  # Merged (global + overrides)
            "custom_commands": custom_commands_data
        }
        commands_logger.info(f"✓ Returned {len(global_commands_data)} global + {len(override_commands_data)} overrides + {len(basic_commands_data)} merged basic + {len(custom_commands_data)} custom commands")
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
        # Проверяем лимит кастомных команд (максимум 5 на пользователя)
        custom_commands_count = db.query(BotCommand).filter(
            BotCommand.command_type == 'custom',
            BotCommand.user_id == current_user["id"]
        ).count()
        
        if custom_commands_count >= 5:
            raise HTTPException(
                status_code=400, 
                detail=f"Достигнут лимит кастомных команд (максимум 5). Удалите ненужные команды перед созданием новых."
            )
        
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

@router.post("/override")
async def create_command_override(
    override_data: CommandOverrideCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать user override для глобальной команды"""
    try:
        # 1. Проверяем существует ли глобальная команда с таким именем
        global_command = db.query(BotCommand).filter(
            BotCommand.command_type == 'global',
            BotCommand.user_id == None,
            BotCommand.command_name == override_data.command_name
        ).first()
        
        if not global_command:
            raise HTTPException(
                status_code=404, 
                detail=f"Глобальная команда '{override_data.command_name}' не найдена"
            )
        
        # 2. Проверяем нет ли уже override для этой команды
        existing_override = db.query(BotCommand).filter(
            BotCommand.command_type == 'override',
            BotCommand.user_id == current_user["id"],
            BotCommand.command_name == override_data.command_name
        ).first()
        
        if existing_override:
            raise HTTPException(
                status_code=400,
                detail=f"Override для команды '{override_data.command_name}' уже существует. Используйте PUT для обновления."
            )
        
        # 3. Проверяем что alias не занят
        if override_data.alias:
            alias_conflict = db.query(BotCommand).filter(
                BotCommand.user_id == current_user["id"],
                BotCommand.alias == override_data.alias
            ).first()
            
            if alias_conflict:
                raise HTTPException(
                    status_code=400,
                    detail=f"Алиас '{override_data.alias}' уже используется"
                )
        
        # 4. Создаем override
        new_override = BotCommand(
            user_id=current_user["id"],
            channel_name=None,  # Override не привязан к конкретному каналу
            command_name=override_data.command_name,
            command_type='override',
            parent_command_id=global_command.id,
            alias=override_data.alias,
            response_text="",  # Override не меняет response_text
            is_enabled=override_data.is_enabled if override_data.is_enabled is not None else True,
            platforms=override_data.platforms if override_data.platforms else global_command.platforms,
            allowed_roles=override_data.allowed_roles if override_data.allowed_roles else global_command.allowed_roles,
            cooldown_seconds=override_data.cooldown_seconds if override_data.cooldown_seconds is not None else global_command.cooldown_seconds,
            tags=global_command.tags,
            description=global_command.description
        )
        
        db.add(new_override)
        db.commit()
        db.refresh(new_override)
        
        commands_logger.info(f"✓ Created override for command '{override_data.command_name}' by user {current_user['id']}")
        
        return {
            "success": True,
            "message": f"Override для команды '{override_data.command_name}' создан успешно",
            "data": {
                "id": new_override.id,
                "command_name": new_override.command_name,
                "alias": new_override.alias,
                "parent_command_id": new_override.parent_command_id
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating override: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка создания override")

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
