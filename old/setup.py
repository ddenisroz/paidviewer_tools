#!/usr/bin/env python3
"""
Скрипт для первоначальной настройки проекта TTS_TTV
"""
import os
import sys
import subprocess
import platform
from pathlib import Path

def run_command(command, cwd=None):
    """Выполнить команду и вернуть результат"""
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            cwd=cwd, 
            capture_output=True, 
            text=True, 
            check=True
        )
        return True, result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        return False, e.stdout, e.stderr

def check_python_version():
    """Проверить версию Python"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Требуется Python 3.8 или выше")
        print(f"   Текущая версия: {version.major}.{version.minor}.{version.micro}")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro}")
    return True

def create_virtual_environment():
    """Создать виртуальное окружение"""
    venv_path = Path(".venv")
    if venv_path.exists():
        print("✅ Виртуальное окружение уже существует")
        # Проверяем, что pip работает
        print("🔍 Проверка pip...")
        success, stdout, stderr = run_command("python -m pip --version")
        if not success:
            print("⚠️  pip не работает, исправляем...")
            success, stdout, stderr = run_command("python -m ensurepip --upgrade")
            if success:
                print("✅ pip исправлен")
            else:
                print(f"❌ Не удалось исправить pip: {stderr}")
                return False
        return True
    
    print("📦 Создание виртуального окружения...")
    success, stdout, stderr = run_command("python -m venv .venv")
    if success:
        print("✅ Виртуальное окружение создано")
        # Убеждаемся, что pip работает
        print("🔍 Проверка pip...")
        success, stdout, stderr = run_command("python -m pip --version")
        if not success:
            print("⚠️  pip не работает, исправляем...")
            success, stdout, stderr = run_command("python -m ensurepip --upgrade")
            if success:
                print("✅ pip исправлен")
            else:
                print(f"❌ Не удалось исправить pip: {stderr}")
                return False
        return True
    else:
        print(f"❌ Ошибка создания виртуального окружения: {stderr}")
        return False

def get_activation_command():
    """Получить команду активации виртуального окружения"""
    if platform.system() == "Windows":
        return ".venv\\Scripts\\activate"
    else:
        return "source .venv/bin/activate"

def install_dependencies():
    """Установить зависимости"""
    print("📦 Установка зависимостей...")
    
    # Определяем команду pip
    if platform.system() == "Windows":
        pip_cmd = ".venv\\Scripts\\pip"
    else:
        pip_cmd = ".venv/bin/pip"
    
    # Обновляем pip
    print("  🔄 Обновление pip...")
    run_command(f"{pip_cmd} install --upgrade pip")
    
    # Устанавливаем зависимости bot_service
    print("  📦 Установка зависимостей bot_service...")
    success, stdout, stderr = run_command(f"{pip_cmd} install -r bot_service/requirements.txt")
    if not success:
        print(f"❌ Ошибка установки зависимостей bot_service: {stderr}")
        return False
    
    # Устанавливаем зависимости tts_service
    print("  📦 Установка зависимостей tts_service...")
    success, stdout, stderr = run_command(f"{pip_cmd} install -r tts_service/requirements.txt")
    if not success:
        print(f"❌ Ошибка установки зависимостей tts_service: {stderr}")
        return False
    
    print("✅ Все зависимости установлены")
    return True

def install_frontend_dependencies():
    """Установить зависимости фронтенда"""
    frontend_dir = Path("frontend")
    if not frontend_dir.exists():
        print("⚠️  Папка frontend не найдена, пропускаем установку зависимостей фронтенда")
        return True
    
    print("📦 Установка зависимостей фронтенда...")
    success, stdout, stderr = run_command("npm install", cwd=frontend_dir)
    if success:
        print("✅ Зависимости фронтенда установлены")
        return True
    else:
        print(f"❌ Ошибка установки зависимостей фронтенда: {stderr}")
        return False

def create_env_files():
    """Создать файлы .env из примеров"""
    print("📝 Создание файлов конфигурации...")
    
    # bot_service/.env
    bot_env_example = Path("bot_service/env.example")
    bot_env = Path("bot_service/.env")
    if bot_env_example.exists() and not bot_env.exists():
        bot_env.write_text(bot_env_example.read_text())
        print("  ✅ Создан bot_service/.env")
    
    # tts_service/.env
    tts_env_example = Path("tts_service/env.example")
    tts_env = Path("tts_service/.env")
    if tts_env_example.exists() and not tts_env.exists():
        tts_env.write_text(tts_env_example.read_text())
        print("  ✅ Создан tts_service/.env")
    
    # frontend/.env
    frontend_env_example = Path("frontend/env.example")
    frontend_env = Path("frontend/.env")
    if frontend_env_example.exists() and not frontend_env.exists():
        frontend_env.write_text(frontend_env_example.read_text())
        print("  ✅ Создан frontend/.env")
    
    print("✅ Файлы конфигурации созданы")
    return True

def create_directories():
    """Создать необходимые директории"""
    print("📁 Создание необходимых директорий...")
    
    directories = [
        "temp",
        "temp/tts_audio",
        "bot_service/data",
        "bot_service/logs",
        "bot_service/backups",
        "tts_service/data",
        "tts_service/logs",
        "tts_service/backups",
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
    
    print("✅ Директории созданы")
    return True

def run_database_migrations():
    """Запустить миграции базы данных"""
    print("🗄️  Запуск миграций базы данных...")
    
    # bot_service миграции
    print("  📦 Миграции bot_service...")
    success, stdout, stderr = run_command("python -m alembic upgrade head", cwd="bot_service")
    if not success:
        print(f"❌ Ошибка миграций bot_service: {stderr}")
        # Попробуем альтернативный способ
        print("  🔄 Попытка альтернативного способа...")
        success, stdout, stderr = run_command("alembic upgrade head", cwd="bot_service")
        if not success:
            print(f"❌ Ошибка миграций bot_service (альтернативный способ): {stderr}")
            return False
    
    # tts_service миграции
    print("  📦 Миграции tts_service...")
    success, stdout, stderr = run_command("python -m alembic upgrade head", cwd="tts_service")
    if not success:
        print(f"❌ Ошибка миграций tts_service: {stderr}")
        # Попробуем альтернативный способ
        print("  🔄 Попытка альтернативного способа...")
        success, stdout, stderr = run_command("alembic upgrade head", cwd="tts_service")
        if not success:
            print(f"❌ Ошибка миграций tts_service (альтернативный способ): {stderr}")
            return False
    
    print("✅ Миграции выполнены")
    return True

def main():
    """Основная функция настройки"""
    print("🚀 Настройка проекта TTS_TTV")
    print("=" * 50)
    
    # Проверяем Python
    if not check_python_version():
        return False
    
    # Создаем виртуальное окружение
    if not create_virtual_environment():
        return False
    
    # Устанавливаем зависимости
    if not install_dependencies():
        return False
    
    # Устанавливаем зависимости фронтенда
    if not install_frontend_dependencies():
        return False
    
    # Создаем файлы конфигурации
    if not create_env_files():
        return False
    
    # Создаем директории
    if not create_directories():
        return False
    
    # Запускаем миграции
    if not run_database_migrations():
        return False
    
    print("\n" + "=" * 50)
    print("✅ Настройка завершена успешно!")
    print("\n📋 Следующие шаги:")
    print(f"1. Активируйте виртуальное окружение: {get_activation_command()}")
    print("2. Настройте файлы .env в соответствии с вашими потребностями")
    print("3. Запустите сервисы:")
    print("   - bot_service: python bot_service/main.py")
    print("   - tts_service: python tts_service/main.py")
    print("   - frontend: cd frontend && npm run dev")
    print("\n🎉 Проект готов к работе!")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
