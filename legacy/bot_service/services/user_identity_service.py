"""
Сервис для работы с идентификацией пользователей
Обеспечивает четкое разделение гостей и авторизованных пользователей
"""
import logging
from typing import Dict, Any, Optional, Tuple
from enum import Enum

logger = logging.getLogger(__name__)

class UserType(Enum):
    GUEST = "guest"
    AUTHENTICATED = "authenticated"

class UserIdentityService:
    """
    Сервис для работы с идентификацией пользователей.
    Обеспечивает четкое разделение гостей и авторизованных пользователей.
    """
    
    @staticmethod
    def get_user_type(user: Dict[str, Any]) -> UserType:
        """Определяет тип пользователя"""
        if user.get('is_guest', False):
            return UserType.GUEST
        return UserType.AUTHENTICATED
    
    @staticmethod
    def get_user_identifier(user: Dict[str, Any]) -> str:
        """
        Возвращает уникальный идентификатор пользователя для БД операций.
        Для гостей: session_id (UUID)
        Для авторизованных: user_id (число как строка)
        """
        user_type = UserIdentityService.get_user_type(user)
        
        if user_type == UserType.GUEST:
            session_id = user.get('session_id')
            if not session_id:
                raise ValueError("Guest user must have session_id")
            return session_id
        else:
            user_id = user.get('id')
            if not user_id:
                raise ValueError("Authenticated user must have id")
            return str(user_id)
    
    @staticmethod
    def get_database_filters(user: Dict[str, Any]) -> Dict[str, Any]:
        """
        Возвращает фильтры для БД запросов в зависимости от типа пользователя.
        Для гостей: {"session_id": session_id}
        Для авторизованных: {"user_id": user_id}
        """
        user_type = UserIdentityService.get_user_type(user)
        
        if user_type == UserType.GUEST:
            session_id = user.get('session_id')
            if not session_id:
                raise ValueError("Guest user must have session_id")
            return {"session_id": session_id}
        else:
            user_id = user.get('id')
            if not user_id:
                raise ValueError("Authenticated user must have id")
            return {"user_id": user_id}
    
    @staticmethod
    def create_settings_record_data(user: Dict[str, Any]) -> Dict[str, Any]:
        """
        Возвращает данные для создания записи настроек.
        Для гостей: {"session_id": session_id, "user_id": None}
        Для авторизованных: {"user_id": user_id, "session_id": None}
        """
        user_type = UserIdentityService.get_user_type(user)
        
        if user_type == UserType.GUEST:
            session_id = user.get('session_id')
            if not session_id:
                raise ValueError("Guest user must have session_id")
            return {"session_id": session_id, "user_id": None}
        else:
            user_id = user.get('id')
            if not user_id:
                raise ValueError("Authenticated user must have id")
            return {"user_id": user_id, "session_id": None}
    
    @staticmethod
    def get_websocket_user_id(user: Dict[str, Any]) -> str:
        """
        Возвращает ID для WebSocket соединения.
        Для гостей: session_id
        Для авторизованных: user_id как строка
        """
        user_type = UserIdentityService.get_user_type(user)
        
        if user_type == UserType.GUEST:
            session_id = user.get('session_id')
            if not session_id:
                raise ValueError("Guest user must have session_id")
            return session_id
        else:
            user_id = user.get('id')
            if not user_id:
                raise ValueError("Authenticated user must have id")
            return str(user_id)
    
    @staticmethod
    def get_rate_limit_id(user: Dict[str, Any]) -> str:
        """
        Возвращает ID для rate limiting.
        Для гостей: session_id
        Для авторизованных: user_id как строка
        """
        return UserIdentityService.get_websocket_user_id(user)
    
    @staticmethod
    def get_tts_channel_name(user: Dict[str, Any]) -> str:
        """
        Возвращает имя канала для TTS.
        Для гостей: "guest_{session_id}"
        Для авторизованных: "user_{user_id}"
        """
        user_type = UserIdentityService.get_user_type(user)
        
        if user_type == UserType.GUEST:
            session_id = user.get('session_id')
            if not session_id:
                raise ValueError("Guest user must have session_id")
            return f"guest_{session_id}"
        else:
            user_id = user.get('id')
            if not user_id:
                raise ValueError("Authenticated user must have id")
            return f"user_{user_id}"
    
    @staticmethod
    def log_user_operation(operation: str, user: Dict[str, Any], **kwargs):
        """Логирует операцию с указанием типа пользователя"""
        user_type = UserIdentityService.get_user_type(user)
        identifier = UserIdentityService.get_user_identifier(user)
        
        log_data = {
            "operation": operation,
            "user_type": user_type.value,
            "identifier": identifier,
            **kwargs
        }
        
        logger.info(f"User operation: {log_data}")
    
    @staticmethod
    def validate_user_data(user: Dict[str, Any]) -> bool:
        """Валидирует данные пользователя"""
        try:
            user_type = UserIdentityService.get_user_type(user)
            
            if user_type == UserType.GUEST:
                if not user.get('session_id'):
                    logger.error("Guest user missing session_id")
                    return False
            else:
                if not user.get('id'):
                    logger.error("Authenticated user missing id")
                    return False
            
            return True
        except Exception as e:
            logger.error(f"User data validation failed: {e}")
            return False
