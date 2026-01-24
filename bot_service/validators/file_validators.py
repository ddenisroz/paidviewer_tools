"""Валидаторы для загрузки файлов"""
import os
from typing import Tuple
from fastapi import UploadFile, HTTPException
import logging

logger = logging.getLogger(__name__)

# Импорт magic для проверки реального типа файла
try:
    import magic
    MAGIC_AVAILABLE = True
except ImportError:
    logger.warning("python-magic not installed. Magic number validation disabled.")
    MAGIC_AVAILABLE = False

# Константы для лимитов файлов
MAX_VOICE_FILE_SIZE_MB = 5  # 5 MB для голосов
MAX_REWARD_SOUND_FILE_SIZE_MB = 2  # 2 MB для звуков наград
MAX_UPLOAD_FILE_SIZE_MB = 50  # Общий лимит

# Разрешенные типы контента
ALLOWED_AUDIO_TYPES = {
    'audio/wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/x-wav',
    'audio/x-mpeg',
    'audio/ogg',
    'audio/webm',
    'audio/aac',
    'audio/flac',
}

ALLOWED_IMAGE_TYPES = {
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
}


def validate_file_magic_number(
    file_path: str,
    allowed_types: set
) -> Tuple[bool, str]:
    """
    Проверяет реальный тип файла по magic numbers (сигнатуре файла).
    
    Это критичная проверка безопасности, которая предотвращает загрузку
    вредоносных файлов (.exe, .sh) переименованных в .wav/.mp3.
    
    Args:
        file_path: Путь к файлу для проверки
        allowed_types: Множество разрешенных MIME types
        
    Returns:
        (is_valid, error_message)
    """
    if not MAGIC_AVAILABLE:
        logger.warning("[WARN] Magic number validation skipped (python-magic not installed)")
        return True, ""  # Fallback если библиотека не установлена

    try:
        # Проверяем что файл существует
        if not os.path.exists(file_path):
            return False, "File not found"

        # Получаем реальный MIME type по содержимому файла
        mime = magic.from_file(file_path, mime=True)

        # Проверяем что тип разрешен
        if mime not in allowed_types:
            logger.warning(
                f"[BLOCKED] [SECURITY] Invalid file magic number detected: {mime}, "
                f"file: {os.path.basename(file_path)}"
            )
            return False, f"Invalid file content type: {mime}. File may be malicious."

        logger.info(f"[OK] Valid file magic number: {mime}")
        return True, ""

    except Exception as e:
        logger.error(f"[ERROR] Error checking magic number: {e}")
        # В случае ошибки проверки - отклоняем файл (fail-safe)
        return False, f"Error validating file: {str(e)}"


class FileValidator:
    """Класс для валидации загружаемых файлов"""

    @staticmethod
    def validate_audio_metadata(
        filename: str,
        content_type: str
    ) -> Tuple[bool, str]:
        """
        Валидирует метаданные аудио файла (имя, тип).
        Decoupled from FastAPI UploadFile.
        """
        try:
            # Проверка типа контента
            if content_type not in ALLOWED_AUDIO_TYPES:
                logger.warning(f"Invalid audio file type: {content_type}")
                allowed_types = ', '.join(ALLOWED_AUDIO_TYPES)
                return False, f"Неподдерживаемый формат. Разрешены: {allowed_types}"

            # Проверка расширения файла
            if filename:
                _, ext = os.path.splitext(filename)
                ext = ext.lower()
                allowed_extensions = {'.wav', '.mp3', '.ogg', '.webm', '.aac', '.flac', '.mpeg'}
                if ext not in allowed_extensions:
                    return False, f"Неподдерживаемое расширение файла: {ext}"

            return True, ""

        except Exception as e:
            logger.error(f"Error validating audio metadata: {e}")
            return False, f"Ошибка при валидации: {str(e)}"

    @staticmethod
    def validate_audio_file(
        file: UploadFile,
        max_size_mb: int = MAX_VOICE_FILE_SIZE_MB
    ) -> Tuple[bool, str]:
        """
        Валидирует аудио файл (Wrapper for UploadFile)
        """
        return FileValidator.validate_audio_metadata(file.filename, file.content_type)

    @staticmethod
    def validate_size_limit(
        size: int,
        max_size_mb: int
    ) -> Tuple[bool, str]:
        """
        Валидирует размер файла (bytes).
        """
        try:
            max_size_bytes = max_size_mb * 1024 * 1024

            if size > max_size_bytes:
                size_mb = size / (1024 * 1024)
                return False, f"Размер файла ({size_mb:.2f} MB) превышает максимум ({max_size_mb} MB)"

            return True, ""

        except Exception as e:
            logger.error(f"Error validating size: {e}")
            return False, f"Ошибка при проверке размера: {str(e)}"

    @staticmethod
    def validate_file_size(
        file: UploadFile,
        max_size_mb: int = MAX_VOICE_FILE_SIZE_MB
    ) -> Tuple[bool, str]:
        """
        Валидирует размер файла (Wrapper for UploadFile)
        """
        if file.size is None:
             return True, "" # Cannot validate if None
        return FileValidator.validate_size_limit(file.size, max_size_mb)

    @staticmethod
    def validate_image_file(file: UploadFile) -> Tuple[bool, str]:
        """
        Валидирует файл изображения
        Returns: (is_valid, error_message)
        """
        try:
            if file.content_type not in ALLOWED_IMAGE_TYPES:
                allowed_types = ', '.join(ALLOWED_IMAGE_TYPES)
                return False, f"Неподдерживаемый формат. Разрешены: {allowed_types}"

            if file.filename:
                _, ext = os.path.splitext(file.filename)
                ext = ext.lower()
                allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
                if ext not in allowed_extensions:
                    return False, f"Неподдерживаемое расширение: {ext}"

            return True, ""

        except Exception as e:
            logger.error(f"Error validating image file: {e}")
            return False, f"Ошибка при валидации файла: {str(e)}"

    @staticmethod
    def validate_filename(filename: str, max_length: int = 255) -> Tuple[bool, str]:
        """
        Валидирует имя файла на безопасность
        Returns: (is_valid, error_message)
        """
        try:
            if not filename or len(filename) == 0:
                return False, "Имя файла не может быть пустым"

            if len(filename) > max_length:
                return False, f"Имя файла слишком длинное (макс {max_length} символов)"

            # Проверяем на опасные символы
            dangerous_chars = {'/', '\\', '..', '\x00', '\n', '\r'}
            for char in dangerous_chars:
                if char in filename:
                    return False, f"Имя файла содержит недопустимый символ: {repr(char)}"

            return True, ""

        except Exception as e:
            logger.error(f"Error validating filename: {e}")
            return False, f"Ошибка при валидации имени: {str(e)}"


def validate_voice_file(file: UploadFile) -> str:
    """
    Полная валидация файла голоса
    Raises HTTPException если файл невалиден
    """
    # Валидация имени
    is_valid, error = FileValidator.validate_filename(file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Валидация типа
    is_valid, error = FileValidator.validate_audio_file(file)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Валидация размера
    is_valid, error = FileValidator.validate_file_size(file, MAX_VOICE_FILE_SIZE_MB)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    return "OK"


def validate_sound_file(file: UploadFile) -> str:
    """
    Полная валидация файла звука награды
    Raises HTTPException если файл невалиден
    """
    # Валидация имени
    is_valid, error = FileValidator.validate_filename(file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Валидация типа
    is_valid, error = FileValidator.validate_audio_file(file)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Валидация размера
    is_valid, error = FileValidator.validate_file_size(file, MAX_REWARD_SOUND_FILE_SIZE_MB)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    return "OK"


def validate_image_upload(file: UploadFile, max_size_mb: int = 10) -> str:
    """
    Полная валидация файла изображения
    Raises HTTPException если файл невалиден
    """
    # Валидация имени
    is_valid, error = FileValidator.validate_filename(file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Валидация типа
    is_valid, error = FileValidator.validate_image_file(file)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Валидация размера
    is_valid, error = FileValidator.validate_file_size(file, max_size_mb)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    return "OK"
