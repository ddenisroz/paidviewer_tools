# bot_service/utils/validators.py
"""
[SECURITY] Валидаторы для входных данных
Обеспечивают безопасность и корректность данных во всей системе
"""

import re
import logging
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse

logger = logging.getLogger('bot_service')

class ValidationError(Exception):
    """Исключение для ошибок валидации"""
    pass

class InputValidator:
    """Валидатор пользовательских входных данных"""

    # Регулярные выражения
    USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{2,30}$')
    EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    CHANNEL_NAME_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{2,50}$')
    COMMAND_NAME_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{2,20}$')

    # Опасные символы для XSS
    XSS_DANGEROUS_CHARS = ['<', '>', '&', '"', "'", '\\', '/', ';', '|', '`', '\n', '\r', '\t']

    # Опасные SQL паттерны
    SQL_INJECTION_PATTERNS = [
        r"('\s*(or|and)\s*')",
        r"(;\s*drop\s+table)",
        r"(;\s*delete\s+from)",
        r"(union\s+select)",
        r"(exec\s*\()",
        r"(script>)",
    ]

    @staticmethod
    def sanitize_text(text: str, max_length: int = 500, allow_multiline: bool = False) -> str:
        """
        Санитизация текста от опасных символов
        
        Args:
            text: Текст для очистки
            max_length: Максимальная длина
            allow_multiline: Разрешить многострочный текст
            
        Returns:
            Очищенный текст
            
        Raises:
            ValidationError: Если текст не прошел валидацию
        """
        if not text:
            raise ValidationError("Text cannot be empty")

        text = text.strip()

        if len(text) > max_length:
            raise ValidationError(f"Text too long: {len(text)} > {max_length}")

        # Удаляем опасные символы
        for char in InputValidator.XSS_DANGEROUS_CHARS:
            if not allow_multiline and char in ['\n', '\r', '\t']:
                text = text.replace(char, ' ')
            elif char != '\n' and char != '\r' and char != '\t':
                text = text.replace(char, '')

        # Проверяем на SQL инъекции
        for pattern in InputValidator.SQL_INJECTION_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                raise ValidationError("Potentially dangerous SQL pattern detected")

        return text.strip()

    @staticmethod
    def validate_username(username: str) -> bool:
        """
        Валидация имени пользователя
        
        Args:
            username: Имя пользователя
            
        Returns:
            True если валидно
            
        Raises:
            ValidationError: Если имя не валидно
        """
        if not username:
            raise ValidationError("Username cannot be empty")

        if not InputValidator.USERNAME_PATTERN.match(username):
            raise ValidationError("Invalid username format. Use only letters, numbers, _ and -")

        return True

    @staticmethod
    def validate_email(email: str) -> bool:
        """
        Валидация email адреса
        
        Args:
            email: Email адрес
            
        Returns:
            True если валиден
            
        Raises:
            ValidationError: Если email не валиден
        """
        if not email:
            raise ValidationError("Email cannot be empty")

        if not InputValidator.EMAIL_PATTERN.match(email):
            raise ValidationError("Invalid email format")

        return True

    @staticmethod
    def validate_channel_name(channel_name: str) -> bool:
        """
        Валидация имени канала
        
        Args:
            channel_name: Имя канала
            
        Returns:
            True если валидно
            
        Raises:
            ValidationError: Если имя не валидно
        """
        if not channel_name:
            raise ValidationError("Channel name cannot be empty")

        if not InputValidator.CHANNEL_NAME_PATTERN.match(channel_name):
            raise ValidationError("Invalid channel name format")

        return True

    @staticmethod
    def validate_command_name(command_name: str) -> bool:
        """
        Валидация имени команды
        
        Args:
            command_name: Имя команды
            
        Returns:
            True если валидно
            
        Raises:
            ValidationError: Если имя не валидно
        """
        if not command_name:
            raise ValidationError("Command name cannot be empty")

        if not InputValidator.COMMAND_NAME_PATTERN.match(command_name):
            raise ValidationError("Invalid command name format. Use only letters, numbers, _ and -")

        # Проверка зарезервированных слов
        reserved_words = ['admin', 'mod', 'owner', 'system', 'bot', 'api']
        if command_name.lower() in reserved_words:
            raise ValidationError(f"'{command_name}' is a reserved word")

        return True

    @staticmethod
    def validate_url(url: str, allowed_domains: Optional[List[str]] = None) -> bool:
        """
        Валидация URL
        
        Args:
            url: URL для проверки
            allowed_domains: Список разрешенных доменов (опционально)
            
        Returns:
            True если URL валиден
            
        Raises:
            ValidationError: Если URL не валиден
        """
        if not url:
            raise ValidationError("URL cannot be empty")

        try:
            parsed = urlparse(url)

            # Проверяем схему
            if parsed.scheme not in ['http', 'https']:
                raise ValidationError("URL must use http or https scheme")

            # Проверяем наличие домена
            if not parsed.netloc:
                raise ValidationError("URL must have a valid domain")

            # Проверяем разрешенные домены
            if allowed_domains:
                domain = parsed.netloc.lower()
                # Удаляем www. если есть
                if domain.startswith('www.'):
                    domain = domain[4:]

                allowed = False
                for allowed_domain in allowed_domains:
                    if domain == allowed_domain or domain.endswith(f'.{allowed_domain}'):
                        allowed = True
                        break

                if not allowed:
                    raise ValidationError(f"Domain not allowed. Allowed: {', '.join(allowed_domains)}")

            return True

        except Exception as e:
            if isinstance(e, ValidationError):
                raise
            raise ValidationError(f"Invalid URL: {str(e)}")

    @staticmethod
    def validate_youtube_url(url: str) -> Dict[str, Any]:
        """
        Валидация и парсинг YouTube URL
        
        Args:
            url: YouTube URL
            
        Returns:
            Dict с video_id и другой информацией
            
        Raises:
            ValidationError: Если URL не валиден
        """
        youtube_domains = ['youtube.com', 'youtu.be', 'm.youtube.com']

        try:
            InputValidator.validate_url(url, youtube_domains)
            parsed = urlparse(url)

            video_id = None

            # Парсим video ID из разных форматов
            if 'youtu.be' in parsed.netloc:
                # https://youtu.be/VIDEO_ID
                video_id = parsed.path.lstrip('/')
            elif 'youtube.com' in parsed.netloc:
                # https://www.youtube.com/watch?v=VIDEO_ID
                from urllib.parse import parse_qs
                query_params = parse_qs(parsed.query)
                video_id = query_params.get('v', [None])[0]

            if not video_id:
                raise ValidationError("Could not extract video ID from YouTube URL")

            # Валидация video ID (обычно 11 символов)
            if not re.match(r'^[a-zA-Z0-9_-]{11}$', video_id):
                raise ValidationError("Invalid YouTube video ID format")

            return {
                'valid': True,
                'video_id': video_id,
                'url': url,
                'platform': 'youtube'
            }

        except Exception as e:
            if isinstance(e, ValidationError):
                raise
            raise ValidationError(f"Invalid YouTube URL: {str(e)}")

    @staticmethod
    def validate_number_range(value: Any, min_value: Optional[float] = None,
                             max_value: Optional[float] = None,
                             field_name: str = "Value") -> float:
        """
        Валидация числового значения в диапазоне
        
        Args:
            value: Значение для проверки
            min_value: Минимальное значение
            max_value: Максимальное значение
            field_name: Имя поля для сообщений об ошибках
            
        Returns:
            Провалидированное число
            
        Raises:
            ValidationError: Если значение не в диапазоне
        """
        try:
            num = float(value)
        except (TypeError, ValueError):
            raise ValidationError(f"{field_name} must be a number")

        if min_value is not None and num < min_value:
            raise ValidationError(f"{field_name} must be >= {min_value}")

        if max_value is not None and num > max_value:
            raise ValidationError(f"{field_name} must be <= {max_value}")

        return num

    @staticmethod
    def validate_integer(value: Any, field_name: str = "Value") -> int:
        """
        Валидация целого числа
        
        Args:
            value: Значение для проверки
            field_name: Имя поля
            
        Returns:
            Провалидированное целое число
            
        Raises:
            ValidationError: Если не целое число
        """
        try:
            return int(value)
        except (TypeError, ValueError):
            raise ValidationError(f"{field_name} must be an integer")


class FileValidator:
    """Валидатор для загружаемых файлов"""

    # Разрешенные MIME типы для аудио
    ALLOWED_AUDIO_MIME_TYPES = [
        'audio/wav',
        'audio/x-wav',
        'audio/wave',
        'audio/mp3',
        'audio/mpeg',
        'audio/ogg',
        'audio/flac'
    ]

    # Разрешенные расширения файлов
    ALLOWED_AUDIO_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.flac']

    # Максимальный размер файла (в байтах)
    MAX_AUDIO_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

    @staticmethod
    def validate_audio_file(filename: str, content_type: str, file_size: int) -> bool:
        """
        Валидация аудио файла
        
        Args:
            filename: Имя файла
            content_type: MIME тип
            file_size: Размер файла в байтах
            
        Returns:
            True если файл валиден
            
        Raises:
            ValidationError: Если файл не валиден
        """
        # Проверка размера
        if file_size > FileValidator.MAX_AUDIO_FILE_SIZE:
            raise ValidationError(
                f"File too large: {file_size} bytes. Max: {FileValidator.MAX_AUDIO_FILE_SIZE} bytes"
            )

        # Проверка расширения
        file_ext = None
        for ext in FileValidator.ALLOWED_AUDIO_EXTENSIONS:
            if filename.lower().endswith(ext):
                file_ext = ext
                break

        if not file_ext:
            raise ValidationError(
                f"Invalid file extension. Allowed: {', '.join(FileValidator.ALLOWED_AUDIO_EXTENSIONS)}"
            )

        # Проверка MIME типа
        if content_type not in FileValidator.ALLOWED_AUDIO_MIME_TYPES:
            raise ValidationError(
                f"Invalid MIME type: {content_type}. Allowed: {', '.join(FileValidator.ALLOWED_AUDIO_MIME_TYPES)}"
            )

        return True


