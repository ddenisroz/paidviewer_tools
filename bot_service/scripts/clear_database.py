#!/usr/bin/env python3
"""
Скрипт для очистки базы данных с созданием резервной копии
"""
import os
import sys
import shutil
from datetime import datetime

# Добавляем корневую директорию в sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.project_paths import DATA_DIR, BACKUPS_DIR

def clear_database():
    """Очистить базу данных с созданием резервной копии"""

    db_path = DATA_DIR / "app_data.db"

    if not db_path.exists():
        print(f"[OK] База данных не найдена: {db_path}")
        print("Создастся автоматически при следующем запуске приложения")
        return

    # Создаем директорию для бэкапов базы данных
    db_backup_dir = BACKUPS_DIR / "database"
    db_backup_dir.mkdir(parents=True, exist_ok=True)

    # Создаем имя файла бэкапа с датой и временем
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = db_backup_dir / f"app_data_backup_{timestamp}.db"

    try:
        # Создаем резервную копию
        print("[PACKAGE] Создание резервной копии...")
        print(f"   Источник: {db_path}")
        print(f"   Назначение: {backup_path}")

        shutil.copy2(db_path, backup_path)
        print("[OK] Резервная копия создана")

        # Удаляем базу данных
        print("\n[DELETE]  Удаление базы данных...")
        os.remove(db_path)
        print("[OK] База данных удалена")

        # Также удаляем -wal и -shm файлы если есть (SQLite WAL mode)
        wal_path = db_path.with_suffix(".db-wal")
        shm_path = db_path.with_suffix(".db-shm")

        if wal_path.exists():
            os.remove(wal_path)
            print(f"[OK] Удален файл: {wal_path.name}")

        if shm_path.exists():
            os.remove(shm_path)
            print(f"[OK] Удален файл: {shm_path.name}")

        print("\n✨ База данных успешно очищена!")
        print(f"[LOG] Резервная копия сохранена: {backup_path}")
        print("\n[INFO] При следующем запуске приложения будет создана новая чистая база данных")

        # Показываем размер бэкапа
        backup_size_mb = backup_path.stat().st_size / (1024 * 1024)
        print(f"[STATS] Размер резервной копии: {backup_size_mb:.2f} MB")

        # Показываем все бэкапы
        all_backups = sorted(db_backup_dir.glob("*.db"), key=lambda x: x.stat().st_mtime, reverse=True)
        if len(all_backups) > 1:
            print(f"\n📚 Всего резервных копий: {len(all_backups)}")
            print("   Последние 5:")
            for i, backup in enumerate(all_backups[:5], 1):
                backup_time = datetime.fromtimestamp(backup.stat().st_mtime)
                backup_size = backup.stat().st_size / (1024 * 1024)
                print(f"   {i}. {backup.name} ({backup_size:.2f} MB) - {backup_time.strftime('%Y-%m-%d %H:%M:%S')}")

    except Exception as e:
        print(f"[ERROR] Ошибка при очистке базы данных: {e}")
        sys.exit(1)

def restore_database(backup_name: str = None):
    """Восстановить базу данных из резервной копии"""

    db_backup_dir = BACKUPS_DIR / "database"

    if not db_backup_dir.exists():
        print(f"[ERROR] Директория с резервными копиями не найдена: {db_backup_dir}")
        return

    # Находим все бэкапы
    all_backups = sorted(db_backup_dir.glob("*.db"), key=lambda x: x.stat().st_mtime, reverse=True)

    if not all_backups:
        print(f"[ERROR] Резервные копии не найдены в {db_backup_dir}")
        return

    # Выбираем бэкап
    if backup_name:
        backup_path = db_backup_dir / backup_name
        if not backup_path.exists():
            print(f"[ERROR] Резервная копия не найдена: {backup_path}")
            return
    else:
        # Используем последнюю резервную копию
        backup_path = all_backups[0]
        print(f"[PACKAGE] Используется последняя резервная копия: {backup_path.name}")

    db_path = DATA_DIR / "app_data.db"

    try:
        # Если текущая база существует, создаем ее бэкап
        if db_path.exists():
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            temp_backup = db_backup_dir / f"app_data_before_restore_{timestamp}.db"
            shutil.copy2(db_path, temp_backup)
            print(f"[PACKAGE] Создана резервная копия текущей БД: {temp_backup.name}")

        # Восстанавливаем из бэкапа
        print("\n[REFRESH] Восстановление базы данных...")
        shutil.copy2(backup_path, db_path)
        print(f"[OK] База данных восстановлена из {backup_path.name}")

    except Exception as e:
        print(f"[ERROR] Ошибка при восстановлении базы данных: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Управление базой данных")
    parser.add_argument("action", choices=["clear", "restore", "list"], help="Действие: clear (очистить), restore (восстановить), list (список бэкапов)")
    parser.add_argument("--backup", help="Имя резервной копии для восстановления (по умолчанию - последняя)")

    args = parser.parse_args()

    if args.action == "clear":
        # Запрос подтверждения
        print("[WARN]  ВНИМАНИЕ: Будет создана резервная копия, затем база данных будет удалена!")
        print("   Все данные (пользователи, токены, настройки) будут сброшены")
        response = input("\nПродолжить? (yes/no): ").strip().lower()

        if response in ["yes", "y", "да", "д"]:
            clear_database()
        else:
            print("[ERROR] Операция отменена")

    elif args.action == "restore":
        restore_database(args.backup)

    elif args.action == "list":
        db_backup_dir = BACKUPS_DIR / "database"
        all_backups = sorted(db_backup_dir.glob("*.db"), key=lambda x: x.stat().st_mtime, reverse=True)

        if not all_backups:
            print(f"[ERROR] Резервные копии не найдены в {db_backup_dir}")
        else:
            print(f"📚 Найдено резервных копий: {len(all_backups)}\n")
            for i, backup in enumerate(all_backups, 1):
                backup_time = datetime.fromtimestamp(backup.stat().st_mtime)
                backup_size = backup.stat().st_size / (1024 * 1024)
                print(f"{i}. {backup.name}")
                print(f"   Размер: {backup_size:.2f} MB")
                print(f"   Дата: {backup_time.strftime('%Y-%m-%d %H:%M:%S')}")
                print()
