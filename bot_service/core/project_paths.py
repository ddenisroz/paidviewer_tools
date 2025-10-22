# core/project_paths.py
"""
Централизованное управление путями проекта для обеспечения переносимости
"""
import os
from pathlib import Path

def get_project_root() -> Path:
    """
    Получить корневую директорию проекта.
    Ищет файл .git или pyproject.toml для определения корня проекта.
    """
    current_file = Path(__file__).resolve()
    
    # Поднимаемся по директориям, пока не найдем корень проекта
    for parent in current_file.parents:
        # Проверяем наличие маркеров корня проекта
        if (parent / ".git").exists() or (parent / "pyproject.toml").exists() or (parent / "README.md").exists():
            return parent
    
    # Если не нашли маркеры, используем директорию на 2 уровня выше от bot_service
    return current_file.parent.parent.parent

def get_bot_service_root() -> Path:
    """Получить корневую директорию bot_service"""
    return Path(__file__).parent.parent

def get_frontend_root() -> Path:
    """Получить корневую директорию frontend"""
    return get_project_root() / "frontend"

def get_temp_dir() -> Path:
    """Получить директорию для временных файлов"""
    return get_project_root() / "temp"

def get_data_dir() -> Path:
    """Получить директорию для данных приложения"""
    return get_bot_service_root() / "data"

def get_logs_dir() -> Path:
    """Получить директорию для логов"""
    return get_bot_service_root() / "logs"

def get_backups_dir() -> Path:
    """Получить директорию для бэкапов"""
    return get_bot_service_root() / "backups"

def ensure_directories():
    """Создать необходимые директории, если они не существуют"""
    directories = [
        get_temp_dir(),
        get_data_dir(),
        get_logs_dir(),
        get_backups_dir(),
        get_temp_dir() / "tts_audio",
    ]
    
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)

# Глобальные переменные для быстрого доступа
PROJECT_ROOT = get_project_root()
BOT_SERVICE_ROOT = get_bot_service_root()
FRONTEND_ROOT = get_frontend_root()
TEMP_DIR = get_temp_dir()
DATA_DIR = get_data_dir()
LOGS_DIR = get_logs_dir()
BACKUPS_DIR = get_backups_dir()

# Создаем необходимые директории при импорте
ensure_directories()

