# bot_service/core/cookie_config.py
"""
Production-ready cookie configuration
Автоматически настраивает security флаги на основе ENVIRONMENT
"""
import logging
from typing import Optional
from core.config import settings

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
    is_production = settings.environment.lower() == "production"

    cookie_settings = {
        "key": key,
        "value": value,
        "httponly": httponly,
        "secure": is_production,  # True только в production
        "samesite": samesite,
        "path": path
    }

    if max_age is not None:
        cookie_settings["max_age"] = max_age

    # Логируем для отладки (только в dev)
    if not is_production:
        logger.debug(
            f"🍪 Cookie '{key}' settings: "
            f"secure={cookie_settings['secure']}, "
            f"httponly={httponly}, "
            f"samesite={samesite}"
        )

    return cookie_settings


def is_production() -> bool:
    """Проверка что приложение запущено в production"""
    return settings.environment.lower() == "production"


def is_development() -> bool:
    """Проверка что приложение запущено в development"""
    return not is_production()


# Константы для session cookies
# Бесконечная сессия (10 лет) - сессия живет до явного логаута или логина с другого устройства
TEN_YEARS_IN_SECONDS = 10 * 365 * 24 * 60 * 60  # 315360000 секунд
SESSION_MAX_AGE_SECONDS = TEN_YEARS_IN_SECONDS

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
if settings.is_production:
    logger.info("[SECURITY] Running in PRODUCTION mode: cookies.secure=True")
else:
    logger.info(f"[DEV] Running in {settings.environment.upper()} mode: cookies.secure=False")

