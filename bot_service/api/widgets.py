from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Dict, Any, Optional
import uuid
from datetime import datetime
from sqlalchemy.orm import Session

from core.database import get_db, User
from auth.auth import get_current_user, get_current_user_optional
from core.security_modern import limiter

router = APIRouter(prefix="/api/widgets", tags=["widgets"])

class WidgetConfig(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    widget_type: str
    config: Dict[str, Any]

# Временное хранилище конфигураций по пользователям
# Структура: {user_id: {config_id: config_data}}
user_widget_configs = {}

@router.post("/chat/config")
@limiter.limit("60/minute")  # [OK] RATE LIMITING: 60 запросов в минуту
async def save_chat_config(
    request: Request,
    config: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Сохранить конфигурацию виджета чата для текущего пользователя"""
    config_id = str(uuid.uuid4())
    user_id = str(current_user.id)

    # Инициализируем конфигурации пользователя если их нет
    if user_id not in user_widget_configs:
        user_widget_configs[user_id] = {}

    config_data = {
        "id": config_id,
        "user_id": user_id,
        "name": config.get("name", "Untitled Chat Widget"),
        "widget_type": "chat",
        "config": config,
        "created_at": datetime.now().isoformat()
    }

    user_widget_configs[user_id][config_id] = config_data

    return {
        "id": config_id,
        "url": f"/widgets/chat?config={config_id}&user={user_id}",
        "message": "Chat widget configuration saved successfully"
    }

@router.get("/chat/config/{config_id}")
@limiter.limit("60/minute")  # [OK] RATE LIMITING: 60 запросов в минуту
async def get_chat_config(
    request: Request,
    config_id: str,
    user_id: Optional[str] = None,
    current_user: User = Depends(get_current_user_optional)
):
    """Получить конфигурацию виджета чата"""
    # Если user_id не передан, используем текущего пользователя
    if not user_id and current_user:
        user_id = str(current_user.id)

    # Если user_id передан, проверяем что это текущий пользователь или админ
    if user_id and current_user and str(current_user.id) != user_id:
        # Проверяем права администратора
        if not getattr(current_user, 'is_admin', False):
            raise HTTPException(status_code=403, detail="Access denied")

    if user_id and user_id in user_widget_configs and config_id in user_widget_configs[user_id]:
        return user_widget_configs[user_id][config_id]

    # Возвращаем конфигурацию по умолчанию
    return {
        "id": config_id,
        "name": "Default Chat Widget",
        "widget_type": "chat",
        "config": {
            "width": 400,
            "height": 300,
            "backgroundColor": "rgba(0, 0, 0, 0.8)",
            "backgroundImage": "none",
            "borderRadius": 8,
            "borderColor": "#333",
            "borderWidth": 2,
            "messageBg": "rgba(255, 255, 255, 0.1)",
            "messageBorderRadius": 4,
            "messageMargin": 4,
            "messagePadding": 8,
            "fontFamily": "Arial, sans-serif",
            "fontSize": 14,
            "fontWeight": "normal",
            "textColor": "#ffffff",
            "animationDuration": 0.3,
            "animationType": "slide-in",
            "maxMessages": 50,
            "showTimestamps": False,
            "showUserRoles": True,
            "colors": {
                "moderator": "#00ff00",
                "vip": "#ff6b6b",
                "subscriber": "#4ecdc4",
                "normal": "#ffffff"
            }
        }
    }


@router.get("/configs")
@limiter.limit("60/minute")  # [OK] RATE LIMITING: 60 запросов в минуту
async def list_widget_configs(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список конфигураций виджетов текущего пользователя"""
    user_id = str(current_user.id)
    configs = []

    if user_id in user_widget_configs:
        for config_id, config_data in user_widget_configs[user_id].items():
            configs.append({
                "id": config_id,
                "name": config_data.get("name", "Untitled"),
                "widget_type": config_data.get("widget_type", "unknown"),
                "created_at": config_data.get("created_at", ""),
                "url": f"/widgets/{config_data.get('widget_type', 'unknown')}?config={config_id}&user={user_id}"
            })

    return {
        "configs": configs,
        "total": len(configs)
    }

@router.delete("/config/{config_id}")
@limiter.limit("60/minute")  # [OK] RATE LIMITING: 60 запросов в минуту
async def delete_widget_config(
    request: Request,
    config_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить конфигурацию виджета текущего пользователя"""
    user_id = str(current_user.id)

    if user_id not in user_widget_configs or config_id not in user_widget_configs[user_id]:
        raise HTTPException(status_code=404, detail="Configuration not found")

    del user_widget_configs[user_id][config_id]
    return {"message": "Configuration deleted successfully"}

@router.get("/health")
async def widgets_health():
    """Проверка здоровья API виджетов"""
    total_configs = sum(len(configs) for configs in user_widget_configs.values())
    return {
        "status": "healthy",
        "users_count": len(user_widget_configs),
        "configs_count": total_configs,
        "timestamp": datetime.now().isoformat()
    }

