# bot_service/core/cookie_config.py
"""
Production-ready cookie configuration
Автоматически настраивает security флаги на основе ENVIRONMENT
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def get_cookie_settings(
    key: str,
    value: str,
    httponly: bool = True,
    samesite: str = "lax",
    path: str = "/",
    max_age: Optional[int] = None
) -> dict:
    """
    Получить настройки cookie с автоматической настройкой secure флага
    
    Args:
        key: Ключ cookie
        value: Значение cookie
        httponly: HttpOnly флаг (защита от XSS)
        samesite: SameSite политика (защита от CSRF)
        path: Путь cookie
        max_age: Время жизни в секундах
    
    Returns:
        dict: Настройки для response.set_cookie()
    """
    environment = os.getenv("ENVIRONMENT", "development").lower()
    is_production = environment == "production"
    
    settings = {
        "key": key,
        "value": value,
        "httponly": httponly,
        "secure": is_production,  # ✅ True только в production
        "samesite": samesite,
        "path": path
    }
    
    if max_age is not None:
        settings["max_age"] = max_age
    
    # Логируем для отладки (только в dev)
    if not is_production:
        logger.debug(
            f"🍪 Cookie '{key}' settings: "
            f"secure={settings['secure']}, "
            f"httponly={httponly}, "
            f"samesite={samesite}"
        )
    
    return settings


def is_production() -> bool:
    """Проверка что приложение запущено в production"""
    return os.getenv("ENVIRONMENT", "development").lower() == "production"


def is_development() -> bool:
    """Проверка что приложение запущено в development"""
    return not is_production()


# Константы для session cookies
SESSION_MAX_AGE_SECONDS = int(os.getenv("SESSION_MAX_AGE_SECONDS", "86400"))  # 24 часа

def get_session_cookie_settings(session_id: str) -> dict:
    """
    Получить настройки для session cookie с правильным secure флагом
    
    Args:
        session_id: ID сессии
        
    Returns:
        dict: Настройки для response.set_cookie()
    """
    return get_cookie_settings(
        key="session_id",
        value=session_id,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=SESSION_MAX_AGE_SECONDS
    )


# При импорте модуля показываем текущий режим
_environment = os.getenv("ENVIRONMENT", "development")
if _environment.lower() == "production":
    logger.info("🔒 Running in PRODUCTION mode: cookies.secure=True")
else:
    logger.info(f"🔓 Running in {_environment.upper()} mode: cookies.secure=False")

