from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from datetime import datetime

from core.database import get_db, User
from auth.auth import get_current_user
from websocket_handlers import send_lootbox_opened

router = APIRouter(prefix="/api/drops/triggers", tags=["drops-triggers"])

class DropTrigger(BaseModel):
    id: Optional[str] = None
    name: str
    trigger_type: str  # 'donation', 'streak', 'message_record', 'custom'
    condition: Dict[str, Any]  # Условие срабатывания
    reward: Dict[str, Any]  # Награда
    rarity: str  # 'common', 'rare', 'epic', 'legendary'
    enabled: bool = True
    created_at: Optional[str] = None

# Временное хранилище триггеров по пользователям
user_drop_triggers = {}

@router.post("/")
async def create_trigger(
    trigger: DropTrigger,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новый триггер дропа"""
    user_id = str(current_user.id)
    trigger_id = f"trigger_{datetime.now().timestamp()}"
    
    if user_id not in user_drop_triggers:
        user_drop_triggers[user_id] = {}
    
    trigger_data = {
        "id": trigger_id,
        "user_id": user_id,
        "name": trigger.name,
        "trigger_type": trigger.trigger_type,
        "condition": trigger.condition,
        "reward": trigger.reward,
        "rarity": trigger.rarity,
        "enabled": trigger.enabled,
        "created_at": datetime.now().isoformat()
    }
    
    user_drop_triggers[user_id][trigger_id] = trigger_data
    
    return {
        "id": trigger_id,
        "message": "Trigger created successfully"
    }

@router.get("/")
async def list_triggers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список триггеров пользователя"""
    user_id = str(current_user.id)
    
    if user_id not in user_drop_triggers:
        return {"triggers": []}
    
    triggers = list(user_drop_triggers[user_id].values())
    return {"triggers": triggers}

@router.put("/{trigger_id}")
async def update_trigger(
    trigger_id: str,
    trigger: DropTrigger,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить триггер"""
    user_id = str(current_user.id)
    
    if user_id not in user_drop_triggers or trigger_id not in user_drop_triggers[user_id]:
        raise HTTPException(status_code=404, detail="Trigger not found")
    
    trigger_data = {
        "id": trigger_id,
        "user_id": user_id,
        "name": trigger.name,
        "trigger_type": trigger.trigger_type,
        "condition": trigger.condition,
        "reward": trigger.reward,
        "rarity": trigger.rarity,
        "enabled": trigger.enabled,
        "created_at": user_drop_triggers[user_id][trigger_id]["created_at"]
    }
    
    user_drop_triggers[user_id][trigger_id] = trigger_data
    
    return {"message": "Trigger updated successfully"}

@router.delete("/{trigger_id}")
async def delete_trigger(
    trigger_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить триггер"""
    user_id = str(current_user.id)
    
    if user_id not in user_drop_triggers or trigger_id not in user_drop_triggers[user_id]:
        raise HTTPException(status_code=404, detail="Trigger not found")
    
    del user_drop_triggers[user_id][trigger_id]
    return {"message": "Trigger deleted successfully"}

@router.post("/test/{trigger_id}")
async def test_trigger(
    trigger_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Протестировать триггер"""
    user_id = str(current_user.id)
    
    if user_id not in user_drop_triggers or trigger_id not in user_drop_triggers[user_id]:
        raise HTTPException(status_code=404, detail="Trigger not found")
    
    trigger = user_drop_triggers[user_id][trigger_id]
    
    # Отправляем тестовое событие
    await send_lootbox_opened(
        username=current_user.username,
        rarity=trigger["rarity"],
        reward=trigger["reward"].get("name", "Тестовая награда"),
        user_id=user_id
    )
    
    return {"message": "Test trigger executed successfully"}

@router.post("/check")
async def check_triggers(
    event_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Проверить триггеры для события"""
    user_id = str(current_user.id)
    
    if user_id not in user_drop_triggers:
        return {"triggered": []}
    
    triggered_triggers = []
    
    for trigger_id, trigger in user_drop_triggers[user_id].items():
        if not trigger["enabled"]:
            continue
            
        if check_trigger_condition(trigger, event_data):
            # Триггер сработал
            await send_lootbox_opened(
                username=event_data.get("username", current_user.username),
                rarity=trigger["rarity"],
                reward=trigger["reward"].get("name", "Награда"),
                user_id=user_id
            )
            
            triggered_triggers.append(trigger_id)
    
    return {"triggered": triggered_triggers}

def check_trigger_condition(trigger: Dict[str, Any], event_data: Dict[str, Any]) -> bool:
    """Проверить условие триггера"""
    trigger_type = trigger["trigger_type"]
    condition = trigger["condition"]
    
    if trigger_type == "donation":
        # Триггер по донату
        amount = event_data.get("amount", 0)
        min_amount = condition.get("min_amount", 0)
        return amount >= min_amount
    
    elif trigger_type == "streak":
        # Триггер по стрику присутствия
        streak_days = event_data.get("streak_days", 0)
        min_streak = condition.get("min_streak", 0)
        return streak_days >= min_streak
    
    elif trigger_type == "message_record":
        # Триггер по рекорду сообщений
        message_count = event_data.get("message_count", 0)
        min_messages = condition.get("min_messages", 0)
        return message_count >= min_messages
    
    elif trigger_type == "custom":
        # Пользовательский триггер
        # Здесь можно добавить логику для пользовательских условий
        return True
    
    return False

# Предустановленные триггеры
@router.post("/presets")
async def create_preset_triggers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать предустановленные триггеры"""
    user_id = str(current_user.id)
    
    if user_id not in user_drop_triggers:
        user_drop_triggers[user_id] = {}
    
    presets = [
        {
            "name": "Донат 100₽",
            "trigger_type": "donation",
            "condition": {"min_amount": 100},
            "reward": {"name": "100 баллов", "type": "points"},
            "rarity": "common"
        },
        {
            "name": "Донат 500₽",
            "trigger_type": "donation", 
            "condition": {"min_amount": 500},
            "reward": {"name": "500 баллов", "type": "points"},
            "rarity": "rare"
        },
        {
            "name": "Донат 1000₽",
            "trigger_type": "donation",
            "condition": {"min_amount": 1000},
            "reward": {"name": "1000 баллов", "type": "points"},
            "rarity": "epic"
        },
        {
            "name": "Стрик 7 дней",
            "trigger_type": "streak",
            "condition": {"min_streak": 7},
            "reward": {"name": "Стрик 7 дней", "type": "achievement"},
            "rarity": "rare"
        },
        {
            "name": "Стрик 30 дней",
            "trigger_type": "streak",
            "condition": {"min_streak": 30},
            "reward": {"name": "Стрик 30 дней", "type": "achievement"},
            "rarity": "legendary"
        },
        {
            "name": "100 сообщений",
            "trigger_type": "message_record",
            "condition": {"min_messages": 100},
            "reward": {"name": "100 сообщений", "type": "achievement"},
            "rarity": "common"
        },
        {
            "name": "1000 сообщений",
            "trigger_type": "message_record",
            "condition": {"min_messages": 1000},
            "reward": {"name": "1000 сообщений", "type": "achievement"},
            "rarity": "epic"
        }
    ]
    
    created_triggers = []
    
    for preset in presets:
        trigger_id = f"preset_{preset['name'].replace(' ', '_').lower()}_{datetime.now().timestamp()}"
        
        trigger_data = {
            "id": trigger_id,
            "user_id": user_id,
            "name": preset["name"],
            "trigger_type": preset["trigger_type"],
            "condition": preset["condition"],
            "reward": preset["reward"],
            "rarity": preset["rarity"],
            "enabled": True,
            "created_at": datetime.now().isoformat()
        }
        
        user_drop_triggers[user_id][trigger_id] = trigger_data
        created_triggers.append(trigger_id)
    
    return {
        "message": f"Created {len(created_triggers)} preset triggers",
        "trigger_ids": created_triggers
    }
