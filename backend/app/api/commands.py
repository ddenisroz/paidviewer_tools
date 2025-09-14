from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
from app.dependencies import get_current_user, get_state_service
from app.services.state_service import StateService

router = APIRouter(prefix="/api/commands", tags=["commands"])

class CommandUpdate(BaseModel):
    command: str
    new_command: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    permissions: Optional[str] = None  # "all", "mods", "broadcaster"

class CommandCreate(BaseModel):
    command: str
    description: str
    permissions: str = "all"
    enabled: bool = True

class CommandsResponse(BaseModel):
    commands: Dict[str, Dict]

@router.get("/{channel_name}")
async def get_commands(
    channel_name: str,
    user: dict = Depends(get_current_user),
    state_service: StateService = Depends(get_state_service)
):
    """Get all available commands for a channel"""
    if user.get("username") != channel_name:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get channel settings to check which commands are enabled
    try:
        channel_settings = state_service.get_channel_settings(channel_name)
    except ValueError:
        # Channel doesn't exist, create it and use default settings
        await state_service.register_channel(channel_name)
        channel_settings = {}
    
    # Default commands configuration
    commands = {
        "help": {
            "command": "!help",
            "description": "Показать список всех доступных команд",
            "enabled": True,
            "category": "Основные",
            "permissions": "all"
        },
        "tts": {
            "command": "!tts",
            "description": "Включить/выключить озвучку чата",
            "enabled": True,
            "category": "Основные",
            "permissions": "mods"
        },
        "volume": {
            "command": "!volume",
            "description": "Изменить громкость озвучки (0-100)",
            "enabled": True,
            "category": "Основные",
            "permissions": "mods"
        },
        "play": {
            "command": "!play",
            "description": "Возобновить воспроизведение очереди",
            "enabled": True,
            "category": "Управление",
            "permissions": "mods"
        },
        "pause": {
            "command": "!pause",
            "description": "Приостановить воспроизведение",
            "enabled": True,
            "category": "Управление",
            "permissions": "mods"
        },
        "skip": {
            "command": "!skip",
            "description": "Пропустить текущее сообщение",
            "enabled": True,
            "category": "Управление",
            "permissions": "mods"
        },
        "clear": {
            "command": "!clear",
            "description": "Очистить очередь сообщений",
            "enabled": True,
            "category": "Управление",
            "permissions": "mods"
        },
        "mute": {
            "command": "!mute",
            "description": "Заглушить пользователя (только для модераторов)",
            "enabled": True,
            "category": "Модерация",
            "permissions": "mods"
        },
        "unmute": {
            "command": "!unmute",
            "description": "Разглушить пользователя (только для модераторов)",
            "enabled": True,
            "category": "Модерация",
            "permissions": "mods"
        },
        "speed": {
            "command": "!speed",
            "description": "Изменить скорость речи (0.5-2.0)",
            "enabled": True,
            "category": "Настройки",
            "permissions": "mods"
        },
        "voice": {
            "command": "!voice",
            "description": "Изменить голос озвучки",
            "enabled": True,
            "category": "Настройки",
            "permissions": "all"
        },
        "emotes": {
            "command": "!emotes",
            "description": "Включить/выключить озвучку смайлов",
            "enabled": True,
            "category": "Настройки",
            "permissions": "mods"
        },
        "sr": {
            "command": "!sr",
            "description": "Заказать видео (YouTube URL)",
            "enabled": True,
            "category": "YouTube",
            "permissions": "all"
        },
        "yt_skip": {
            "command": "!skip",
            "description": "Пропустить текущее видео",
            "enabled": True,
            "category": "YouTube",
            "permissions": "mods"
        },
        "yt_pause": {
            "command": "!pause",
            "description": "Поставить видео на паузу/возобновить",
            "enabled": True,
            "category": "YouTube",
            "permissions": "mods"
        },
        "yt_volume": {
            "command": "!volume",
            "description": "Изменить громкость видео (0-100)",
            "enabled": True,
            "category": "YouTube",
            "permissions": "mods"
        }
    }
    
    # Get custom commands from channel settings
    custom_commands = channel_settings.get("custom_commands", {})
    
    # Merge custom commands with defaults
    for cmd_key, cmd_data in custom_commands.items():
        if cmd_key in commands:
            commands[cmd_key].update(cmd_data)
        else:
            commands[cmd_key] = cmd_data
    
    return CommandsResponse(commands=commands)

@router.post("/{channel_name}/update")
async def update_command(
    channel_name: str,
    command_update: CommandUpdate,
    user: dict = Depends(get_current_user),
    state_service: StateService = Depends(get_state_service)
):
    """Update a command configuration"""
    if user.get("username") != channel_name:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get current channel settings
    try:
        channel_settings = state_service.get_channel_settings(channel_name)
    except ValueError:
        # Channel doesn't exist, create it
        await state_service.register_channel(channel_name)
        channel_settings = {}
    custom_commands = channel_settings.get("custom_commands", {})
    
    # Update the command
    if command_update.command not in custom_commands:
        custom_commands[command_update.command] = {}
    
    if command_update.new_command:
        custom_commands[command_update.command]["command"] = command_update.new_command
    
    if command_update.description:
        custom_commands[command_update.command]["description"] = command_update.description
    
    if command_update.enabled is not None:
        custom_commands[command_update.command]["enabled"] = command_update.enabled
    
    # Update channel settings
    await state_service.update_channel_settings(channel_name, {"custom_commands": custom_commands})
    
    return {"message": f"Command {command_update.command} updated successfully"}

@router.delete("/{channel_name}/{command_key}")
async def delete_command(
    channel_name: str,
    command_key: str,
    user: dict = Depends(get_current_user),
    state_service: StateService = Depends(get_state_service)
):
    """Delete a custom command"""
    if user.get("username") != channel_name:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get current channel settings
    try:
        channel_settings = state_service.get_channel_settings(channel_name)
    except ValueError:
        # Channel doesn't exist, create it first
        await state_service.register_channel(channel_name)
        channel_settings = {}
    custom_commands = channel_settings.get("custom_commands", {})
    
    if command_key in custom_commands:
        del custom_commands[command_key]
        await state_service.update_channel_settings(channel_name, {"custom_commands": custom_commands})
        return {"message": f"Command {command_key} deleted successfully"}
    else:
        raise HTTPException(status_code=404, detail="Command not found")

@router.post("/{channel_name}/create")
async def create_command(
    channel_name: str,
    command_create: CommandCreate,
    user: dict = Depends(get_current_user),
    state_service: StateService = Depends(get_state_service)
):
    """Create a new custom command"""
    if user.get("username") != channel_name:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get current channel settings
    try:
        channel_settings = state_service.get_channel_settings(channel_name)
    except ValueError:
        # Channel doesn't exist, create it
        await state_service.register_channel(channel_name)
        channel_settings = {}
    custom_commands = channel_settings.get("custom_commands", {})
    
    # Add new command
    custom_commands[command_create.command] = {
        "command": command_create.command,
        "description": command_create.description,
        "enabled": command_create.enabled,
        "permissions": command_create.permissions,
        "category": "Пользовательские"
    }
    
    # Update channel settings
    await state_service.update_channel_settings(channel_name, {"custom_commands": custom_commands})
    
    return {"message": f"Command {command_create.command} created successfully"}

@router.post("/{channel_name}/reset")
async def reset_commands(
    channel_name: str,
    user: dict = Depends(get_current_user),
    state_service: StateService = Depends(get_state_service)
):
    """Reset all commands to default"""
    if user.get("username") != channel_name:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Clear custom commands (create channel if it doesn't exist)
    await state_service.update_channel_settings(channel_name, {"custom_commands": {}})
    
    return {"message": "Commands reset to default successfully"}
