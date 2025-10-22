"""
Валидаторы входных данных для API
"""
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, validator, Field
from fastapi import HTTPException, status

class BaseValidator(BaseModel):
    """Базовый валидатор с общими правилами"""
    
    class Config:
        # Запрещаем дополнительные поля
        extra = "forbid"
        # Валидируем присваивание
        validate_assignment = True

class VoiceUploadValidator(BaseValidator):
    """Валидатор для загрузки голосов"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    file_size: int = Field(..., gt=0, le=10 * 1024 * 1024)  # Максимум 10MB
    
    @validator('name')
    def validate_name(cls, v):
        if not re.match(r'^[a-zA-Z0-9а-яА-Я\s\-_]+$', v):
            raise ValueError('Name contains invalid characters')
        return v.strip()
    
    @validator('description')
    def validate_description(cls, v):
        if v is not None:
            # Удаляем потенциально опасные символы
            v = re.sub(r'[<>"\']', '', v)
        return v

class TTSMessageValidator(BaseValidator):
    """Валидатор для TTS сообщений"""
    text: str = Field(..., min_length=1, max_length=500)
    voice_id: Optional[int] = Field(None, gt=0)
    speed: Optional[float] = Field(1.0, ge=0.5, le=2.0)
    
    @validator('text')
    def validate_text(cls, v):
        # Удаляем потенциально опасные символы
        v = re.sub(r'[<>"\']', '', v)
        # Ограничиваем длину
        if len(v) > 500:
            raise ValueError('Text too long')
        return v.strip()

class UserSettingsValidator(BaseValidator):
    """Валидатор для настроек пользователя"""
    website_volume: int = Field(50, ge=0, le=100)
    obs_volume: int = Field(50, ge=0, le=100)
    enable_7tv: bool = Field(True)
    enable_twitch: bool = Field(True)
    enable_lexicon_filter: bool = Field(True)
    enable_custom_lexicon: bool = Field(False)

class AdminUserValidator(BaseValidator):
    """Валидатор для создания админов"""
    platform: str = Field(..., pattern=r'^(twitch|vk)$')
    platform_user_id: str = Field(..., min_length=1, max_length=100)
    username: Optional[str] = Field(None, max_length=100)
    permissions: Optional[Dict[str, Any]] = Field(None)
    
    @validator('platform_user_id')
    def validate_platform_user_id(cls, v):
        if not re.match(r'^[a-zA-Z0-9_\-]+$', v):
            raise ValueError('Invalid platform user ID format')
        return v

class FilteredWordValidator(BaseValidator):
    """Валидатор для фильтрованных слов"""
    word: str = Field(..., min_length=1, max_length=50)
    is_regex: bool = Field(False)
    
    @validator('word')
    def validate_word(cls, v):
        if not v.strip():
            raise ValueError('Word cannot be empty')
        return v.strip().lower()

def validate_file_upload(file: Any, max_size: int = 10 * 1024 * 1024) -> None:
    """Валидирует загружаемый файл"""
    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided"
        )
    
    if file.size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size: {max_size // (1024*1024)}MB"
        )
    
    # Проверяем расширение файла
    allowed_extensions = ['.wav', '.mp3', '.ogg', '.m4a']
    file_extension = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
    
    if f'.{file_extension}' not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )

def sanitize_input(text: str, max_length: int = 1000) -> str:
    """Санитизирует пользовательский ввод"""
    if not text:
        return ""
    
    # Удаляем потенциально опасные символы
    text = re.sub(r'[<>"\']', '', text)
    
    # Ограничиваем длину
    if len(text) > max_length:
        text = text[:max_length]
    
    return text.strip()

def validate_pagination(page: int = 1, limit: int = 20) -> tuple[int, int]:
    """Валидирует параметры пагинации"""
    if page < 1:
        page = 1
    if limit < 1 or limit > 100:
        limit = 20
    
    return page, limit
