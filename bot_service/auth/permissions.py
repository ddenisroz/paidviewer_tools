"""
Система проверки прав доступа для различных типов пользователей
"""
from typing import Dict, Any
from fastapi import HTTPException, status
from services.user_identity_service import UserIdentityService, UserType
import logging

logger = logging.getLogger(__name__)

def require_platform_token(user: Dict[str, Any], platform: str = None) -> None:
    """
    Проверяет, что у пользователя есть токен платформы.
    Гости не могут использовать функции, требующие токены платформ.
    
    Args:
        user: Данные пользователя из get_current_user
        platform: Конкретная платформа (twitch, vk) или None для любой
    """
    # Валидируем данные пользователя
    if not UserIdentityService.validate_user_data(user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user data"
        )

    user_type = UserIdentityService.get_user_type(user)
    if user_type == UserType.GUEST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Эта функция недоступна для гостей. Требуется авторизация через платформу."
        )

    integrations = user.get("integrations", {})
    if not integrations:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуется авторизация через платформу для использования этой функции"
        )

    if platform and platform not in integrations:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Требуется авторизация через {platform} для использования этой функции"
        )

def require_admin(user: Dict[str, Any]) -> None:
    """Проверяет, что пользователь является администратором."""
    if not user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права администратора"
        )

def require_auth(user: Dict[str, Any]) -> None:
    """Проверяет, что пользователь авторизован (не анонимный)."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация"
        )

def is_guest(user: Dict[str, Any]) -> bool:
    """Проверяет, является ли пользователь гостем."""
    if not UserIdentityService.validate_user_data(user):
        return False
    return UserIdentityService.get_user_type(user) == UserType.GUEST

def has_platform_token(user: Dict[str, Any], platform: str) -> bool:
    """Проверяет, есть ли у пользователя токен конкретной платформы."""
    if is_guest(user):
        return False

    integrations = user.get("integrations", {})
    return platform in integrations

def can_manage_stream(user: Dict[str, Any]) -> bool:
    """Проверяет, может ли пользователь управлять стримом (изменять название, категорию)."""
    return not is_guest(user) and has_platform_token(user, "twitch")

def can_manage_channel_points(user: Dict[str, Any]) -> bool:
    """Проверяет, может ли пользователь управлять баллами канала."""
    return not is_guest(user) and has_platform_token(user, "twitch")

def can_manage_vk_live(user: Dict[str, Any]) -> bool:
    """Проверяет, может ли пользователь управлять VK Live."""
    return not is_guest(user) and has_platform_token(user, "vk")
