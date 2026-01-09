"""
Тесты для UserIdentityService
"""
import pytest
from services.user_identity_service import UserIdentityService, UserType

class TestUserIdentityService:
    """Тесты для сервиса идентификации пользователей"""
    
    def test_get_user_type_guest(self):
        """Тест определения типа гостя"""
        guest_user = {
            "id": -1,
            "is_guest": True,
            "session_id": "abc-123-def"
        }
        
        user_type = UserIdentityService.get_user_type(guest_user)
        assert user_type == UserType.GUEST
    
    def test_get_user_type_authenticated(self):
        """Тест определения типа авторизованного пользователя"""
        auth_user = {
            "id": 1,
            "is_guest": False,
            "username": "testuser"
        }
        
        user_type = UserIdentityService.get_user_type(auth_user)
        assert user_type == UserType.AUTHENTICATED
    
    def test_get_user_identifier_guest(self):
        """Тест получения идентификатора гостя"""
        guest_user = {
            "id": -1,
            "is_guest": True,
            "session_id": "abc-123-def"
        }
        
        identifier = UserIdentityService.get_user_identifier(guest_user)
        assert identifier == "abc-123-def"
    
    def test_get_user_identifier_authenticated(self):
        """Тест получения идентификатора авторизованного пользователя"""
        auth_user = {
            "id": 1,
            "is_guest": False,
            "username": "testuser"
        }
        
        identifier = UserIdentityService.get_user_identifier(auth_user)
        assert identifier == "1"
    
    def test_get_database_filters_guest(self):
        """Тест получения фильтров БД для гостя"""
        guest_user = {
            "id": -1,
            "is_guest": True,
            "session_id": "abc-123-def"
        }
        
        filters = UserIdentityService.get_database_filters(guest_user)
        expected = {"session_id": "abc-123-def"}
        assert filters == expected
    
    def test_get_database_filters_authenticated(self):
        """Тест получения фильтров БД для авторизованного пользователя"""
        auth_user = {
            "id": 1,
            "is_guest": False,
            "username": "testuser"
        }
        
        filters = UserIdentityService.get_database_filters(auth_user)
        expected = {"user_id": 1}
        assert filters == expected
    
    def test_create_settings_record_data_guest(self):
        """Тест создания данных записи настроек для гостя"""
        guest_user = {
            "id": -1,
            "is_guest": True,
            "session_id": "abc-123-def"
        }
        
        data = UserIdentityService.create_settings_record_data(guest_user)
        expected = {"session_id": "abc-123-def", "user_id": None}
        assert data == expected
    
    def test_create_settings_record_data_authenticated(self):
        """Тест создания данных записи настроек для авторизованного пользователя"""
        auth_user = {
            "id": 1,
            "is_guest": False,
            "username": "testuser"
        }
        
        data = UserIdentityService.create_settings_record_data(auth_user)
        expected = {"user_id": 1, "session_id": None}
        assert data == expected
    
    def test_get_tts_channel_name_guest(self):
        """Тест получения имени канала TTS для гостя"""
        guest_user = {
            "id": -1,
            "is_guest": True,
            "session_id": "abc-123-def"
        }
        
        channel_name = UserIdentityService.get_tts_channel_name(guest_user)
        assert channel_name == "guest_abc-123-def"
    
    def test_get_tts_channel_name_authenticated(self):
        """Тест получения имени канала TTS для авторизованного пользователя"""
        auth_user = {
            "id": 1,
            "is_guest": False,
            "username": "testuser"
        }
        
        channel_name = UserIdentityService.get_tts_channel_name(auth_user)
        assert channel_name == "user_1"
    
    def test_validate_user_data_guest_valid(self):
        """Тест валидации данных гостя (валидные данные)"""
        guest_user = {
            "id": -1,
            "is_guest": True,
            "session_id": "abc-123-def"
        }
        
        is_valid = UserIdentityService.validate_user_data(guest_user)
        assert is_valid == True
    
    def test_validate_user_data_authenticated_valid(self):
        """Тест валидации данных авторизованного пользователя (валидные данные)"""
        auth_user = {
            "id": 1,
            "is_guest": False,
            "username": "testuser"
        }
        
        is_valid = UserIdentityService.validate_user_data(auth_user)
        assert is_valid == True
    
    def test_validate_user_data_guest_invalid(self):
        """Тест валидации данных гостя (невалидные данные - нет session_id)"""
        guest_user = {
            "id": -1,
            "is_guest": True
            # Отсутствует session_id
        }
        
        is_valid = UserIdentityService.validate_user_data(guest_user)
        assert is_valid == False
    
    def test_validate_user_data_authenticated_invalid(self):
        """Тест валидации данных авторизованного пользователя (невалидные данные - нет id)"""
        auth_user = {
            "is_guest": False,
            "username": "testuser"
            # Отсутствует id
        }
        
        is_valid = UserIdentityService.validate_user_data(auth_user)
        assert is_valid == False
    
    def test_get_user_identifier_guest_missing_session_id(self):
        """Тест получения идентификатора гостя без session_id (должна быть ошибка)"""
        guest_user = {
            "id": -1,
            "is_guest": True
            # Отсутствует session_id
        }
        
        with pytest.raises(ValueError, match="Guest user must have session_id"):
            UserIdentityService.get_user_identifier(guest_user)
    
    def test_get_user_identifier_authenticated_missing_id(self):
        """Тест получения идентификатора авторизованного пользователя без id (должна быть ошибка)"""
        auth_user = {
            "is_guest": False,
            "username": "testuser"
            # Отсутствует id
        }
        
        with pytest.raises(ValueError, match="Authenticated user must have id"):
            UserIdentityService.get_user_identifier(auth_user)
