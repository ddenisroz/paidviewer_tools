#!/usr/bin/env python3
"""
Модуль для шифрования и дешифрования токенов
Использует Fernet (симметричное шифрование)
"""
import logging
from cryptography.fernet import Fernet
from typing import Optional
from core.config import settings

logger = logging.getLogger(__name__)

# Получаем ключ шифрования из настроек
ENCRYPTION_KEY = settings.token_encryption_key

if not ENCRYPTION_KEY or ENCRYPTION_KEY.startswith('your-'):
    # Генерируем новый ключ при первом запуске
    logger.warning("[WARN] TOKEN_ENCRYPTION_KEY not configured properly, generating new key")
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    logger.info(f"🔑 Generated encryption key. Add to .env: TOKEN_ENCRYPTION_KEY={ENCRYPTION_KEY}")

# Создаем объект для шифрования
try:
    cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
except Exception as e:
    logger.error(f"[ERROR] Failed to initialize encryption: {e}")
    # Генерируем новый ключ в случае ошибки
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    cipher_suite = Fernet(ENCRYPTION_KEY.encode())
    logger.info(f"🔑 Generated new encryption key. Add to .env: TOKEN_ENCRYPTION_KEY={ENCRYPTION_KEY}")


def encrypt_token(token: str) -> str:
    """
    Шифрует токен
    
    Args:
        token: Токен для шифрования
        
    Returns:
        Зашифрованный токен (base64)
    """
    if not token:
        return token

    try:
        # Если токен уже зашифрован, возвращаем как есть
        if is_token_encrypted(token):
            return token

        # Шифруем токен
        encrypted = cipher_suite.encrypt(token.encode())
        return encrypted.decode()
    except Exception as e:
        logger.error(f"[ERROR] Failed to encrypt token: {e}")
        # В случае ошибки возвращаем токен как есть (для совместимости)
        return token


def decrypt_token(encrypted_token: str) -> Optional[str]:
    """
    Дешифрует токен
    
    Args:
        encrypted_token: Зашифрованный токен
        
    Returns:
        Расшифрованный токен или None при ошибке
    """
    if not encrypted_token:
        return encrypted_token

    try:
        # Если токен не зашифрован, возвращаем как есть
        if not is_token_encrypted(encrypted_token):
            return encrypted_token

        # Дешифруем токен
        decrypted = cipher_suite.decrypt(encrypted_token.encode())
        return decrypted.decode()
    except Exception as e:
        logger.error(f"[ERROR] Failed to decrypt token: {e}")
        # В случае ошибки возвращаем токен как есть (для совместимости)
        return encrypted_token


def is_token_encrypted(token: str) -> bool:
    """
    Проверяет, зашифрован ли токен
    
    Args:
        token: Токен для проверки
        
    Returns:
        True если токен зашифрован, False иначе
    """
    if not token:
        return False

    try:
        # Пробуем дешифровать токен
        cipher_suite.decrypt(token.encode())
        return True
    except Exception:
        # Если не получилось дешифровать - токен не зашифрован
        return False

