"""
Валидаторы входных данных для API
"""
import re
import html
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

def sanitize_input(text: str, max_length: int = 1000, allow_special: bool = False) -> str:
    """
    Санитизирует пользовательский ввод против XSS и SQL Injection
    
    Args:
        text: Текст для санитизации
        max_length: Максимальная длина (по умолчанию 1000)
        allow_special: Разрешить специальные символы (опасно)
    
    Returns:
        Очищенный текст
    """
    if not text:
        return ""
    
    # HTML-кодируем для защиты от XSS
    text = html.escape(text)
    
    # Если не разрешены специальные символы, удаляем их
    if not allow_special:
        # Удаляем потенциально опасные символы
        text = re.sub(r'[<>"\';\\`]', '', text)
    
    # Удаляем управляющие символы и невидимые символы
    text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
    
    # Ограничиваем длину
    if len(text) > max_length:
        text = text[:max_length]
    
    return text.strip()


def sanitize_stream_title(title: str) -> str:
    """
    Санитизирует название стрима
    
    Args:
        title: Название стрима
    
    Returns:
        Очищенное название
    """
    if not title:
        return ""
    
    # Удаляем HTML теги
    title = re.sub(r'<[^>]*>', '', title)
    
    # Удаляем script-подобный контент
    title = re.sub(r'javascript:', '', title, flags=re.IGNORECASE)
    title = re.sub(r'on\w+\s*=', '', title, flags=re.IGNORECASE)
    
    # Удаляем управляющие символы
    title = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', title)
    
    # Ограничиваем длину
    if len(title) > 140:
        title = title[:140]
    
    return title.strip()


def sanitize_tts_message(message: str) -> str:
    """
    Санитизирует TTS сообщение
    
    Args:
        message: TTS сообщение
    
    Returns:
        Очищенное сообщение
    """
    if not message:
        return ""
    
    # Удаляем HTML теги
    message = re.sub(r'<[^>]*>', '', message)
    
    # Удаляем управляющие символы
    message = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', message)
    
    # Ограничиваем длину
    if len(message) > 500:
        message = message[:500]
    
    return message.strip()


def sanitize_voice_name(name: str) -> str:
    """
    Санитизирует название голоса
    
    Args:
        name: Название голоса
    
    Returns:
        Очищенное название
    """
    if not name:
        return ""
    
    # Разрешаем только буквы, цифры, пробелы, дефисы и подчеркивания
    name = re.sub(r'[^a-zA-Zа-яА-ЯёЁ0-9\s_-]', '', name)
    
    # Ограничиваем длину
    if len(name) > 50:
        name = name[:50]
    
    return name.strip()


def sanitize_file_name(filename: str) -> str:
    """
    Санитизирует имя файла
    
    Args:
        filename: Имя файла
    
    Returns:
        Очищенное имя файла
    """
    if not filename:
        return ""
    
    # Удаляем попытки обхода пути
    filename = filename.replace('..', '')
    filename = re.sub(r'[/\\]', '', filename)
    
    # Удаляем опасные символы
    filename = re.sub(r'[<>:"|?*\x00-\x1f]', '', filename)
    
    # Ограничиваем длину
    if len(filename) > 255:
        filename = filename[:255]
    
    return filename.strip()


def sanitize_sql_string(text: str) -> str:
    """
    Санитизирует строку для использования в raw SQL (дополнение к ORM)
    
    Args:
        text: Текст для санитизации
    
    Returns:
        Очищенный текст, безопасный для SQL
    """
    if not text:
        return ""
    
    # Экранируем одиночные кавычки
    text = text.replace("'", "''")
    
    # Удаляем потенциально опасные символы и комментарии
    text = re.sub(r'(-{2}|/\*|\*/)|(;)', '', text)
    
    # Ограничиваем длину
    if len(text) > 1000:
        text = text[:1000]
    
    return text.strip()


def validate_username(username: str) -> str:
    """Валидирует имя пользователя"""
    if not username or len(username) < 1 or len(username) > 100:
        raise ValueError("Username must be between 1 and 100 characters")
    
    # Только буквы, цифры, подчеркивание и дефис
    if not re.match(r'^[a-zA-Z0-9а-яА-Я_\-]+$', username):
        raise ValueError("Username contains invalid characters")
    
    return username.strip()


def validate_email(email: str) -> str:
    """Валидирует email адрес"""
    # Простая валидация email
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        raise ValueError("Invalid email format")
    
    return email.lower().strip()


def validate_url(url: str) -> str:
    """Валидирует URL"""
    if not url:
        raise ValueError("URL cannot be empty")
    
    # Проверяем что URL начинается с http:// или https://
    if not url.startswith(('http://', 'https://')):
        raise ValueError("URL must start with http:// or https://")
    
    # Ограничиваем длину URL
    if len(url) > 2048:
        raise ValueError("URL is too long")
    
    return url.strip()


def validate_command_name(name: str) -> str:
    """Валидирует имя команды"""
    if not name or len(name) < 1 or len(name) > 50:
        raise ValueError("Command name must be between 1 and 50 characters")
    
    # Только буквы, цифры, подчеркивание
    if not re.match(r'^[a-zA-Z0-9_]+$', name):
        raise ValueError("Command name contains invalid characters")
    
    return name.lower().strip()


def validate_json_key(key: str) -> str:
    """Валидирует ключ JSON объекта"""
    if not key or len(key) < 1 or len(key) > 100:
        raise ValueError("JSON key must be between 1 and 100 characters")
    
    # Только буквы, цифры, подчеркивание и дефис
    if not re.match(r'^[a-zA-Z0-9_\-]+$', key):
        raise ValueError("JSON key contains invalid characters")
    
    return key.strip()


def validate_pagination(page: int = 1, limit: int = 20) -> tuple[int, int]:
    """Валидирует параметры пагинации"""
    if page < 1:
        page = 1
    if limit < 1 or limit > 100:
        limit = 20
    
    return page, limit
