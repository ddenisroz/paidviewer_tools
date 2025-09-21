#!/usr/bin/env python3
"""
Утилита для просмотра логов TTS_TTV системы
"""
import os
import sys
import time
import argparse
from pathlib import Path
from datetime import datetime
import subprocess
import platform

def clear_screen():
    """Очистка экрана в зависимости от ОС"""
    if platform.system() == "Windows":
        os.system('cls')
    else:
        os.system('clear')

def get_log_files():
    """Получение списка файлов логов"""
    logs_dir = Path("logs")
    if not logs_dir.exists():
        return []
    
    log_files = []
    for file in logs_dir.glob("*.log"):
        log_files.append({
            'name': file.name,
            'path': file,
            'size': file.stat().st_size,
            'modified': datetime.fromtimestamp(file.stat().st_mtime)
        })
    
    return sorted(log_files, key=lambda x: x['modified'], reverse=True)

def format_size(size_bytes):
    """Форматирование размера файла"""
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    
    return f"{size_bytes:.1f} {size_names[i]}"

def show_log_files():
    """Показать список файлов логов"""
    log_files = get_log_files()
    
    if not log_files:
        print("❌ Файлы логов не найдены в папке logs/")
        return None
    
    print("📁 Доступные файлы логов:")
    print("=" * 80)
    print(f"{'№':<3} {'Имя файла':<20} {'Размер':<10} {'Изменен':<20} {'Путь'}")
    print("-" * 80)
    
    for i, log_file in enumerate(log_files, 1):
        print(f"{i:<3} {log_file['name']:<20} {format_size(log_file['size']):<10} {log_file['modified'].strftime('%Y-%m-%d %H:%M:%S'):<20} {log_file['path']}")
    
    return log_files

def view_log_file(file_path, lines=50, follow=False, filter_text=None):
    """Просмотр файла лога"""
    if not file_path.exists():
        print(f"❌ Файл {file_path} не найден")
        return
    
    print(f"📄 Просмотр: {file_path.name}")
    print(f"📊 Размер: {format_size(file_path.stat().st_size)}")
    print(f"🕒 Изменен: {datetime.fromtimestamp(file_path.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    try:
        if follow:
            # Режим слежения за файлом (tail -f)
            print("🔄 Режим слежения (Ctrl+C для выхода)...")
            print("-" * 80)
            
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                # Показываем последние строки
                f.seek(0, 2)  # Переходим в конец файла
                file_size = f.tell()
                start_pos = max(0, file_size - lines * 100)  # Примерно 100 символов на строку
                f.seek(start_pos)
                
                # Показываем последние строки
                last_lines = f.readlines()[-lines:]
                for line in last_lines:
                    if filter_text is None or filter_text.lower() in line.lower():
                        print(line.rstrip())
                
                # Следим за новыми строками
                while True:
                    line = f.readline()
                    if line:
                        if filter_text is None or filter_text.lower() in line.lower():
                            print(line.rstrip())
                    else:
                        time.sleep(0.1)
        else:
            # Обычный режим просмотра
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                all_lines = f.readlines()
                
                # Показываем последние строки
                start_line = max(0, len(all_lines) - lines)
                for i, line in enumerate(all_lines[start_line:], start_line + 1):
                    if filter_text is None or filter_text.lower() in line.lower():
                        print(f"{i:>6}: {line.rstrip()}")
    
    except KeyboardInterrupt:
        print("\n🛑 Просмотр прерван пользователем")
    except Exception as e:
        print(f"❌ Ошибка при чтении файла: {e}")

def search_in_logs(search_text, service=None):
    """Поиск в логах"""
    log_files = get_log_files()
    
    if service:
        log_files = [f for f in log_files if service in f['name']]
    
    if not log_files:
        print("❌ Файлы логов не найдены")
        return
    
    print(f"🔍 Поиск '{search_text}' в логах...")
    print("=" * 80)
    
    found_any = False
    for log_file in log_files:
        try:
            with open(log_file['path'], 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                found_in_file = False
                
                for i, line in enumerate(lines, 1):
                    if search_text.lower() in line.lower():
                        if not found_in_file:
                            print(f"\n📄 {log_file['name']}:")
                            found_in_file = True
                            found_any = True
                        print(f"  {i:>6}: {line.rstrip()}")
        
        except Exception as e:
            print(f"❌ Ошибка при чтении {log_file['name']}: {e}")
    
    if not found_any:
        print("❌ Ничего не найдено")

def show_log_stats():
    """Показать статистику логов"""
    log_files = get_log_files()
    
    if not log_files:
        print("❌ Файлы логов не найдены")
        return
    
    print("📊 Статистика логов:")
    print("=" * 80)
    
    total_size = 0
    total_lines = 0
    
    for log_file in log_files:
        try:
            with open(log_file['path'], 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                line_count = len(lines)
                total_lines += line_count
                total_size += log_file['size']
                
                print(f"📄 {log_file['name']:<20} | Строк: {line_count:>6} | Размер: {format_size(log_file['size']):>8}")
        
        except Exception as e:
            print(f"❌ Ошибка при чтении {log_file['name']}: {e}")
    
    print("-" * 80)
    print(f"📊 Всего файлов: {len(log_files)}")
    print(f"📊 Общий размер: {format_size(total_size)}")
    print(f"📊 Общее количество строк: {total_lines:,}")

def main():
    """Главная функция"""
    parser = argparse.ArgumentParser(description="Утилита для просмотра логов TTS_TTV")
    parser.add_argument('-l', '--list', action='store_true', help='Показать список файлов логов')
    parser.add_argument('-f', '--file', type=str, help='Имя файла лога для просмотра')
    parser.add_argument('-n', '--lines', type=int, default=50, help='Количество строк для показа (по умолчанию: 50)')
    parser.add_argument('--follow', action='store_true', help='Следить за файлом в реальном времени')
    parser.add_argument('-s', '--search', type=str, help='Поиск текста в логах')
    parser.add_argument('--service', type=str, choices=['bot_service', 'tts_service'], help='Фильтр по сервису')
    parser.add_argument('--stats', action='store_true', help='Показать статистику логов')
    
    args = parser.parse_args()
    
    clear_screen()
    print("🔍 TTS_TTV Log Viewer")
    print("=" * 50)
    
    if args.stats:
        show_log_stats()
    elif args.search:
        search_in_logs(args.search, args.service)
    elif args.list or not any([args.file, args.search, args.stats]):
        log_files = show_log_files()
        if log_files and not args.list:
            print("\n💡 Используйте: python view_logs.py -f <номер_файла> для просмотра")
    elif args.file:
        log_files = get_log_files()
        try:
            file_index = int(args.file) - 1
            if 0 <= file_index < len(log_files):
                view_log_file(log_files[file_index]['path'], args.lines, args.follow)
            else:
                print(f"❌ Неверный номер файла. Доступно: 1-{len(log_files)}")
        except ValueError:
            # Попробуем найти файл по имени
            found = False
            for log_file in log_files:
                if args.file in log_file['name']:
                    view_log_file(log_file['path'], args.lines, args.follow)
                    found = True
                    break
            
            if not found:
                print(f"❌ Файл '{args.file}' не найден")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n👋 До свидания!")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        sys.exit(1)
