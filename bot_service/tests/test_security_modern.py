# bot_service/tests/test_security_modern.py
"""
Тесты для современной системы безопасности
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
import jwt

from core.security_modern import modern_security_manager, rate_limit, login_rate_limit


class TestModernSecurityManager:
    """Тесты для ModernSecurityManager"""
    
    def test_create_access_token(self):
        """Тест создания JWT токена"""
        data = {"user_id": 123, "is_admin": True}
        token = modern_security_manager.create_access_token(data)
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_verify_token_valid(self):
        """Тест верификации валидного токена"""
        data = {"user_id": 123, "is_admin": True}
        token = modern_security_manager.create_access_token(data)
        
        payload = modern_security_manager.verify_token(token)
        
        assert payload is not None
        assert payload["user_id"] == 123
        assert payload["is_admin"] == True
    
    def test_verify_token_invalid(self):
        """Тест верификации невалидного токена"""
        with pytest.raises(Exception):
            modern_security_manager.verify_token("invalid_token")
    
    def test_verify_token_expired(self):
        """Тест верификации истекшего токена"""
        # Создаем токен с очень коротким временем жизни
        data = {"user_id": 123, "is_admin": True}
        token = modern_security_manager.create_access_token(
            data, 
            expires_delta=timedelta(seconds=-1)  # Уже истек
        )
        
        with pytest.raises(Exception):
            modern_security_manager.verify_token(token)
    
    def test_encrypt_oauth_token(self):
        """Тест шифрования OAuth токена"""
        token = "test_oauth_token_12345"
        encrypted = modern_security_manager.encrypt_oauth_token(token)
        
        assert encrypted is not None
        assert isinstance(encrypted, str)
        assert encrypted != token
        assert len(encrypted) > 0
    
    def test_decrypt_oauth_token(self):
        """Тест расшифровки OAuth токена"""
        original_token = "test_oauth_token_12345"
        encrypted = modern_security_manager.encrypt_oauth_token(original_token)
        decrypted = modern_security_manager.decrypt_oauth_token(encrypted)
        
        assert decrypted == original_token
    
    def test_encrypt_decrypt_roundtrip(self):
        """Тест полного цикла шифрование-расшифровка"""
        test_tokens = [
            "simple_token",
            "token_with_special_chars!@#$%^&*()",
            "very_long_token_" + "x" * 100,
            "token_with_unicode_[START][SUCCESS]",
            ""
        ]
        
        for token in test_tokens:
            encrypted = modern_security_manager.encrypt_oauth_token(token)
            decrypted = modern_security_manager.decrypt_oauth_token(encrypted)
            assert decrypted == token, f"Failed for token: {token}"
    
    def test_decrypt_invalid_token(self):
        """Тест расшифровки невалидного токена"""
        # decrypt_oauth_token теперь возвращает токен как есть для legacy формата
        result = modern_security_manager.decrypt_oauth_token("invalid_encrypted_token")
        # Должен вернуть токен без изменений (legacy format)
        assert result == "invalid_encrypted_token"
    
    def test_generate_session_id(self):
        """Тест генерации ID сессии"""
        session_id = modern_security_manager.generate_session_id()
        
        assert session_id is not None
        assert isinstance(session_id, str)
        assert len(session_id) > 0
        
        # Генерируем еще один - должен быть разным
        session_id2 = modern_security_manager.generate_session_id()
        assert session_id != session_id2
    
    def test_generate_csrf_token(self):
        """Тест генерации CSRF токена"""
        csrf_token = modern_security_manager.generate_csrf_token()
        
        assert csrf_token is not None
        assert isinstance(csrf_token, str)
        assert len(csrf_token) > 0
        
        # Генерируем еще один - должен быть разным
        csrf_token2 = modern_security_manager.generate_csrf_token()
        assert csrf_token != csrf_token2
    
    def test_verify_csrf_token(self):
        """Тест проверки CSRF токена"""
        token = "test_csrf_token"
        session_token = "test_csrf_token"
        
        # Правильный токен
        assert modern_security_manager.verify_csrf_token(token, session_token) == True
        
        # Неправильный токен
        wrong_token = "wrong_csrf_token"
        assert modern_security_manager.verify_csrf_token(wrong_token, session_token) == False


class TestRateLimiting:
    """Тесты для rate limiting"""
    
    def test_rate_limit_decorator(self):
        """Тест декоратора rate_limit"""
        # Создаем простую функцию для тестирования с параметром request
        @rate_limit("10/minute")
        def test_function(request):
            return "success"
        
        # Функция должна быть доступна
        assert callable(test_function)
    
    def test_login_rate_limit_decorator(self):
        """Тест декоратора login_rate_limit"""
        # login_rate_limit возвращает декоратор
        decorator = login_rate_limit()
        
        # Декоратор должен быть callable
        assert callable(decorator)
        
        # Применяем декоратор к функции с параметром request
        def test_login_function(request):
            return "success"
        
        decorated_function = decorator(test_login_function)
        
        # Функция должна быть доступна
        assert callable(decorated_function)


class TestSecurityIntegration:
    """Интеграционные тесты безопасности"""
    
    def test_full_oauth_flow(self):
        """Тест полного цикла OAuth токена"""
        # 1. Создаем OAuth токен
        oauth_token = "twitch_oauth_token_12345"
        
        # 2. Шифруем для хранения в БД
        encrypted_token = modern_security_manager.encrypt_oauth_token(oauth_token)
        
        # 3. Расшифровываем при использовании
        decrypted_token = modern_security_manager.decrypt_oauth_token(encrypted_token)
        
        # 4. Проверяем, что токен не изменился
        assert decrypted_token == oauth_token
    
    def test_jwt_with_oauth_integration(self):
        """Тест интеграции JWT с OAuth"""
        # 1. Создаем JWT токен с данными пользователя
        user_data = {
            "user_id": 123,
            "username": "testuser",
            "is_admin": False,
            "oauth_provider": "twitch"
        }
        
        jwt_token = modern_security_manager.create_access_token(user_data)
        
        # 2. Верифицируем JWT токен
        payload = modern_security_manager.verify_token(jwt_token)
        
        # 3. Проверяем данные
        assert payload["user_id"] == 123
        assert payload["username"] == "testuser"
        assert payload["is_admin"] == False
        assert payload["oauth_provider"] == "twitch"
    
    def test_session_security(self):
        """Тест безопасности сессий"""
        # 1. Генерируем ID сессии
        session_id = modern_security_manager.generate_session_id()
        
        # 2. Генерируем CSRF токен
        csrf_token = modern_security_manager.generate_csrf_token()
        
        # 3. Проверяем CSRF токен
        assert modern_security_manager.verify_csrf_token(csrf_token, csrf_token) == True
        
        # 4. Проверяем, что токены уникальны
        assert session_id != csrf_token


class TestSecurityErrorHandling:
    """Тесты обработки ошибок безопасности"""
    
    def test_encrypt_token_error_handling(self):
        """Тест обработки ошибок при шифровании"""
        # Мокаем Fernet чтобы вызвать ошибку
        with patch('core.security_modern._fernet') as mock_fernet:
            mock_fernet.encrypt.side_effect = Exception("Encryption failed")
            
            with pytest.raises(Exception):
                modern_security_manager.encrypt_oauth_token("test_token")
    
    def test_decrypt_token_error_handling(self):
        """Тест обработки ошибок при расшифровке"""
        # decrypt_oauth_token теперь возвращает токен как есть для legacy формата
        # вместо выброса исключения
        result = modern_security_manager.decrypt_oauth_token("invalid_token")
        # Должен вернуть токен без изменений (legacy format)
        assert result == "invalid_token"
    
    def test_jwt_verification_error_handling(self):
        """Тест обработки ошибок при верификации JWT"""
        # Тестируем с невалидным токеном
        with pytest.raises(Exception):
            modern_security_manager.verify_token("invalid.jwt.token")
        
        # Тестируем с пустым токеном
        with pytest.raises(Exception):
            modern_security_manager.verify_token("")
        
        # Тестируем с None
        with pytest.raises(Exception):
            modern_security_manager.verify_token(None)