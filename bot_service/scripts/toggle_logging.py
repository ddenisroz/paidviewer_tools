#!/usr/bin/env python3
"""
Скрипт для переключения между режимами логирования
"""
import os
import sys
import shutil
from pathlib import Path

def switch_to_quiet_mode():
    """Переключает на тихий режим логирования"""
    print("🔇 Переключение на тихий режим логирования...")
    
    # Копируем тихую конфигурацию
    shutil.copy2(
        "logging_config_quiet.py", 
        "logging_config.py"
    )
    
    print("✅ Тихий режим активирован!")
    print("📝 Консоль будет показывать только WARNING и выше")
    print("📁 Подробные логи сохраняются в файлы")

def switch_to_debug_mode():
    """Переключает на DEBUG режим логирования"""
    print("🐛 Переключение на DEBUG режим логирования...")
    
    # Копируем оригинальную конфигурацию
    shutil.copy2(
        "logging_config_original.py", 
        "logging_config.py"
    )
    
    print("✅ DEBUG режим активирован!")
    print("📝 Консоль будет показывать все сообщения")
    print("🔍 Подробная отладочная информация включена")

def show_current_mode():
    """Показывает текущий режим логирования"""
    if os.path.exists("logging_config.py"):
        with open("logging_config.py", "r", encoding="utf-8") as f:
            content = f.read()
            
        if "QuietLoggingConfig" in content:
            print("🔇 Текущий режим: ТИХИЙ (только WARNING и выше)")
        elif "LoggingConfig" in content:
            print("🐛 Текущий режим: DEBUG (все сообщения)")
        else:
            print("❓ Неизвестный режим логирования")
    else:
        print("❌ Файл конфигурации логирования не найден")

def main():
    """Главная функция"""
    if len(sys.argv) < 2:
        print("Использование:")
        print("  python toggle_logging.py quiet    - тихий режим")
        print("  python toggle_logging.py debug    - debug режим")
        print("  python toggle_logging.py status   - показать текущий режим")
        return
    
    command = sys.argv[1].lower()
    
    if command == "quiet":
        switch_to_quiet_mode()
    elif command == "debug":
        switch_to_debug_mode()
    elif command == "status":
        show_current_mode()
    else:
        print(f"❌ Неизвестная команда: {command}")
        print("Доступные команды: quiet, debug, status")

if __name__ == "__main__":
    main()
