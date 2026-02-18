#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS F5 Simple - Установочный скрипт
Автоматическая установка и настройка упрощенного TTS сервиса
"""

import os
import sys
import subprocess
import platform
import shutil
from pathlib import Path
import json
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('installer')

class TTSInstaller:
    """Установщик TTS F5 Simple"""
    
    def __init__(self):
        self.install_dir = Path.cwd()
        self.python_exe = sys.executable
        self.is_windows = platform.system() == "Windows"
        
    def run(self):
        """Запуск установки"""
        print("[START] TTS F5 Simple - Установщик")
        print("=" * 50)
        
        try:
            self.check_system_requirements()
            self.install_dependencies()
            self.create_directories()
            self.create_config()
            self.create_launcher()
            self.create_readme()
            
            print("\n[OK] Установка завершена успешно!")
            print(f"[FILE] Установочная папка: {self.install_dir}")
            print("[START] Для запуска выполните: python main.py")
            print("[DOCS] Документация: http://localhost:8001/docs")
            
        except Exception as e:
            logger.exception("Ошибка установки")
            print(f"\n[ERROR] Ошибка установки: {e}")
            return False
        
        return True
    
    def check_system_requirements(self):
        """Проверка системных требований"""
        print("[DEBUG] Проверка системных требований...")
        
        # Проверяем Python версию
        if sys.version_info < (3, 8):
            raise Exception("Требуется Python 3.8 или выше")
        
        print(f"[OK] Python {sys.version.split()[0]}")
        
        # Проверяем платформу
        if self.is_windows:
            print("[OK] Windows")
        else:
            print("[WARN] Не Windows - некоторые функции могут не работать")
        
        # Проверяем доступность pip
        try:
            subprocess.run([self.python_exe, "-m", "pip", "--version"], 
                         check=True, capture_output=True)
            print("[OK] pip доступен")
        except subprocess.CalledProcessError:
            raise Exception("pip не найден. Установите pip и повторите попытку")
        
        # Проверяем GPU (опционально)
        try:
            import GPUtil
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]
                vram_gb = gpu.memoryTotal / 1024**3
                print(f"[OK] GPU: {gpu.name} ({vram_gb:.1f}GB VRAM)")
                
                if vram_gb < 6:
                    print("[WARN] Рекомендуется GPU с минимум 6GB VRAM")
            else:
                print("[WARN] NVIDIA GPU не найдена - TTS может работать медленно")
        except ImportError:
            print("[WARN] Не удалось проверить GPU - установите драйверы NVIDIA")
        
        print("[OK] Системные требования проверены")
    
    def install_dependencies(self):
        """Установка зависимостей"""
        print("\n[PACKAGE] Установка зависимостей...")
        
        # Сначала устанавливаем PyTorch с CUDA
        print("\n[HOT] Установка PyTorch с CUDA 12.4...")
        print("[WARN]  Это может занять несколько минут...")
        
        try:
            # Устанавливаем PyTorch с CUDA 12.4
            pytorch_install = [
                self.python_exe, "-m", "pip", "install",
                "torch==2.4.0+cu124",
                "torchaudio==2.4.0+cu124", 
                "torchvision==0.19.0+cu124",
                "--extra-index-url", "https://download.pytorch.org/whl/cu124"
            ]
            
            result = subprocess.run(pytorch_install, capture_output=True, text=True)
            
            if result.returncode != 0:
                print("[WARN]  Не удалось установить CUDA версию, пробуем CPU версию...")
                # Fallback на CPU версию
                cpu_install = [
                    self.python_exe, "-m", "pip", "install",
                    "torch==2.4.0",
                    "torchaudio==2.4.0",
                    "torchvision==0.19.0"
                ]
                subprocess.run(cpu_install, check=True, capture_output=True, text=True)
                print("[OK] PyTorch (CPU версия) установлен")
            else:
                print("[OK] PyTorch с CUDA 12.4 установлен")
                
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Ошибка установки PyTorch: {e.stderr}")
            raise Exception("Не удалось установить PyTorch")
        
        # Теперь устанавливаем остальные зависимости
        print("\n[PACKAGE] Установка остальных зависимостей...")
        requirements_file = self.install_dir / "requirements.txt"
        if not requirements_file.exists():
            raise Exception("Файл requirements.txt не найден")
        
        try:
            subprocess.run([
                self.python_exe, "-m", "pip", "install", "-r", str(requirements_file)
            ], check=True, capture_output=True, text=True)
            print("[OK] Все зависимости установлены")
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Ошибка установки зависимостей: {e.stderr}")
            raise Exception("Не удалось установить зависимости")
    
    def create_directories(self):
        """Создание необходимых директорий"""
        print("\n[FILE] Создание директорий...")
        
        directories = [
            "models",
            "logs", 
            "generated_audio",
            "config"
        ]
        
        for dir_name in directories:
            dir_path = self.install_dir / dir_name
            dir_path.mkdir(exist_ok=True)
            print(f"[OK] {dir_name}/")
    
    def create_config(self):
        """Создание конфигурационного файла"""
        print("\n[CONFIG] Создание конфигурации...")
        
        config = {
            "version": "1.0.0",
            "auto_update": True,
            "log_level": "INFO",
            "max_log_files": 10,
            "backup_enabled": True
        }
        
        config_file = self.install_dir / "installer_config.json"
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        print("[OK] Конфигурация создана")
    
    def create_launcher(self):
        """Создание файла запуска"""
        print("\n[START] Создание файла запуска...")
        
        if self.is_windows:
            # Создаем .bat файл для Windows
            launcher_content = f"""@echo off
echo [START] Запуск TTS F5 Simple...
cd /d "{self.install_dir}"
"{self.python_exe}" main.py
pause
"""
            launcher_file = self.install_dir / "start_tts.bat"
            with open(launcher_file, 'w', encoding='utf-8') as f:
                f.write(launcher_content)
            print("[OK] start_tts.bat создан")
        
        # Создаем универсальный Python скрипт
        launcher_content = f"""#!/usr/bin/env python3
import sys
import os
from pathlib import Path

# Добавляем текущую директорию в путь
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Импортируем и запускаем main
from main import main

if __name__ == "__main__":
    main()
"""
        launcher_file = self.install_dir / "start_tts.py"
        with open(launcher_file, 'w', encoding='utf-8') as f:
            f.write(launcher_content)
        print("[OK] start_tts.py создан")
    
    def create_readme(self):
        """Создание README файла"""
        print("\n[DOCS] Создание документации...")
        
        readme_content = """# TTS F5 Simple

Упрощенный микросервис для локального TTS F5.

## Быстрый запуск

### Windows
1. Дважды кликните на `start_tts.bat`
2. Или запустите: `python start_tts.py`

### Linux/Mac
1. Запустите: `python3 start_tts.py`

## Веб-интерфейс

После запуска откройте в браузере:
- **Документация**: http://localhost:8001/docs
- **Статус**: http://localhost:8001/health
- **Настройки**: http://localhost:8001/api/settings

## Подключение к приложению

1. Откройте ваше приложение
2. Перейдите в **TTS ИИ озвучка** → **Локальный TTS**
3. Нажмите **"Автопоиск локального TTS"**
4. Или вручную укажите: `http://localhost:8001`

## Логи

Логи сохраняются в папке `logs/`:
- `tts_simple.log` - основные логи
- `error.log` - ошибки

## Поддержка

При возникновении проблем:
1. Проверьте логи в папке `logs/`
2. Убедитесь, что порт 8001 свободен
3. Проверьте, что установлены драйверы NVIDIA
4. Обратитесь в поддержку через тикет-систему

## Версия

TTS F5 Simple v1.0.0
"""
        
        readme_file = self.install_dir / "README.txt"
        with open(readme_file, 'w', encoding='utf-8') as f:
            f.write(readme_content)
        print("[OK] README.txt создан")

def main():
    """Главная функция установщика"""
    installer = TTSInstaller()
    success = installer.run()
    
    if success:
        print("\n[SUCCESS] Установка завершена!")
        print("Для запуска выполните: python main.py")
    else:
        print("\n[ERROR] Установка не удалась")
        sys.exit(1)

if __name__ == "__main__":
    main()

