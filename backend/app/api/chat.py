from fastapi import APIRouter, Depends, HTTPException
from typing import List
import logging
from app.core.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

@router.get("/messages")
async def get_chat_messages(user: dict = Depends(get_current_user)):
    """Получить сообщения из чата"""
    if not user or "username" not in user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Пока возвращаем моковые данные
    # В будущем здесь будет реальная логика получения сообщений из чата
    mock_messages = [
        {
            "id": 1,
            "username": "viewer1",
            "message": "Привет! Как дела?",
            "timestamp": "2024-01-01T12:00:00Z"
        },
        {
            "id": 2,
            "username": "viewer2", 
            "message": "Отличный стрим!",
            "timestamp": "2024-01-01T12:01:00Z"
        },
        {
            "id": 3,
            "username": "viewer3",
            "message": "Когда следующая игра?",
            "timestamp": "2024-01-01T12:02:00Z"
        },
        {
            "id": 4,
            "username": "viewer1",
            "message": "Спасибо за ответ!",
            "timestamp": "2024-01-01T12:03:00Z"
        },
        {
            "id": 5,
            "username": "viewer4",
            "message": "Можешь включить музыку?",
            "timestamp": "2024-01-01T12:04:00Z"
        }
    ]
    
    return mock_messages
