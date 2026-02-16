#!/usr/bin/env python3
"""
РЎРєСЂРёРїС‚ РґР»СЏ РѕС‡РёСЃС‚РєРё Р±Р°Р·С‹ РґР°РЅРЅС‹С… СЃ СЃРѕР·РґР°РЅРёРµРј СЂРµР·РµСЂРІРЅРѕР№ РєРѕРїРёРё
"""
import os
import sys
import shutil
from datetime import datetime

# Р”РѕР±Р°РІР»СЏРµРј РєРѕСЂРЅРµРІСѓСЋ РґРёСЂРµРєС‚РѕСЂРёСЋ РІ sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.project_paths import DATA_DIR, BACKUPS_DIR

def clear_database():
    """РћС‡РёСЃС‚РёС‚СЊ Р±Р°Р·Сѓ РґР°РЅРЅС‹С… СЃ СЃРѕР·РґР°РЅРёРµРј СЂРµР·РµСЂРІРЅРѕР№ РєРѕРїРёРё"""

    db_path = DATA_DIR / "app_data.db"

    if not db_path.exists():
        print(f"[OK] Р‘Р°Р·Р° РґР°РЅРЅС‹С… РЅРµ РЅР°Р№РґРµРЅР°: {db_path}")
        print("РЎРѕР·РґР°СЃС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїСЂРё СЃР»РµРґСѓСЋС‰РµРј Р·Р°РїСѓСЃРєРµ РїСЂРёР»РѕР¶РµРЅРёСЏ")
        return

    # РЎРѕР·РґР°РµРј РґРёСЂРµРєС‚РѕСЂРёСЋ РґР»СЏ Р±СЌРєР°РїРѕРІ Р±Р°Р·С‹ РґР°РЅРЅС‹С…
    db_backup_dir = BACKUPS_DIR / "database"
    db_backup_dir.mkdir(parents=True, exist_ok=True)

    # РЎРѕР·РґР°РµРј РёРјСЏ С„Р°Р№Р»Р° Р±СЌРєР°РїР° СЃ РґР°С‚РѕР№ Рё РІСЂРµРјРµРЅРµРј
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = db_backup_dir / f"app_data_backup_{timestamp}.db"

    try:
        # РЎРѕР·РґР°РµРј СЂРµР·РµСЂРІРЅСѓСЋ РєРѕРїРёСЋ
        print("[PACKAGE] РЎРѕР·РґР°РЅРёРµ СЂРµР·РµСЂРІРЅРѕР№ РєРѕРїРёРё...")
        print(f"   РСЃС‚РѕС‡РЅРёРє: {db_path}")
        print(f"   РќР°Р·РЅР°С‡РµРЅРёРµ: {backup_path}")

        shutil.copy2(db_path, backup_path)
        print("[OK] Р РµР·РµСЂРІРЅР°СЏ РєРѕРїРёСЏ СЃРѕР·РґР°РЅР°")

        # РЈРґР°Р»СЏРµРј Р±Р°Р·Сѓ РґР°РЅРЅС‹С…
        print("\n[DELETE]  РЈРґР°Р»РµРЅРёРµ Р±Р°Р·С‹ РґР°РЅРЅС‹С…...")
        os.remove(db_path)
        print("[OK] Р‘Р°Р·Р° РґР°РЅРЅС‹С… СѓРґР°Р»РµРЅР°")

        # РўР°РєР¶Рµ СѓРґР°Р»СЏРµРј -wal Рё -shm С„Р°Р№Р»С‹ РµСЃР»Рё РµСЃС‚СЊ (SQLite WAL mode)
        wal_path = db_path.with_suffix(".db-wal")
        shm_path = db_path.with_suffix(".db-shm")

        if wal_path.exists():
            os.remove(wal_path)
            print(f"[OK] РЈРґР°Р»РµРЅ С„Р°Р№Р»: {wal_path.name}")

        if shm_path.exists():
            os.remove(shm_path)
            print(f"[OK] РЈРґР°Р»РµРЅ С„Р°Р№Р»: {shm_path.name}")

        print("\n Р‘Р°Р·Р° РґР°РЅРЅС‹С… СѓСЃРїРµС€РЅРѕ РѕС‡РёС‰РµРЅР°!")
        print(f"[LOG] Р РµР·РµСЂРІРЅР°СЏ РєРѕРїРёСЏ СЃРѕС…СЂР°РЅРµРЅР°: {backup_path}")
        print("\n[INFO] РџСЂРё СЃР»РµРґСѓСЋС‰РµРј Р·Р°РїСѓСЃРєРµ РїСЂРёР»РѕР¶РµРЅРёСЏ Р±СѓРґРµС‚ СЃРѕР·РґР°РЅР° РЅРѕРІР°СЏ С‡РёСЃС‚Р°СЏ Р±Р°Р·Р° РґР°РЅРЅС‹С…")

        # РџРѕРєР°Р·С‹РІР°РµРј СЂР°Р·РјРµСЂ Р±СЌРєР°РїР°
        backup_size_mb = backup_path.stat().st_size / (1024 * 1024)
        print(f"[STATS] Р Р°Р·РјРµСЂ СЂРµР·РµСЂРІРЅРѕР№ РєРѕРїРёРё: {backup_size_mb:.2f} MB")

        # РџРѕРєР°Р·С‹РІР°РµРј РІСЃРµ Р±СЌРєР°РїС‹
        all_backups = sorted(db_backup_dir.glob("*.db"), key=lambda x: x.stat().st_mtime, reverse=True)
        if len(all_backups) > 1:
            print(f"\n Р’СЃРµРіРѕ СЂРµР·РµСЂРІРЅС‹С… РєРѕРїРёР№: {len(all_backups)}")
            print("   РџРѕСЃР»РµРґРЅРёРµ 5:")
            for i, backup in enumerate(all_backups[:5], 1):
                backup_time = datetime.fromtimestamp(backup.stat().st_mtime)
                backup_size = backup.stat().st_size / (1024 * 1024)
                print(f"   {i}. {backup.name} ({backup_size:.2f} MB) - {backup_time.strftime('%Y-%m-%d %H:%M:%S')}")

    except Exception as e:
        print(f"[ERROR] РћС€РёР±РєР° РїСЂРё РѕС‡РёСЃС‚РєРµ Р±Р°Р·С‹ РґР°РЅРЅС‹С…: {e}")
        sys.exit(1)

def restore_database(backup_name: str = None):
    """Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ Р±Р°Р·Сѓ РґР°РЅРЅС‹С… РёР· СЂРµР·РµСЂРІРЅРѕР№ РєРѕРїРёРё"""

    db_backup_dir = BACKUPS_DIR / "database"

    if not db_backup_dir.exists():
        print(f"[ERROR] Р”РёСЂРµРєС‚РѕСЂРёСЏ СЃ СЂРµР·РµСЂРІРЅС‹РјРё РєРѕРїРёСЏРјРё РЅРµ РЅР°Р№РґРµРЅР°: {db_backup_dir}")
        return

    # РќР°С…РѕРґРёРј РІСЃРµ Р±СЌРєР°РїС‹
    all_backups = sorted(db_backup_dir.glob("*.db"), key=lambda x: x.stat().st_mtime, reverse=True)

    if not all_backups:
        print(f"[ERROR] Р РµР·РµСЂРІРЅС‹Рµ РєРѕРїРёРё РЅРµ РЅР°Р№РґРµРЅС‹ РІ {db_backup_dir}")
        return

    # Р’С‹Р±РёСЂР°РµРј Р±СЌРєР°Рї
    if backup_name:
        backup_path = db_backup_dir / backup_name
        if not backup_path.exists():
            print(f"[ERROR] Р РµР·РµСЂРІРЅР°СЏ РєРѕРїРёСЏ РЅРµ РЅР°Р№РґРµРЅР°: {backup_path}")
            return
    else:
        # РСЃРїРѕР»СЊР·СѓРµРј РїРѕСЃР»РµРґРЅСЋСЋ СЂРµР·РµСЂРІРЅСѓСЋ РєРѕРїРёСЋ
        backup_path = all_backups[0]
        print(f"[PACKAGE] РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РїРѕСЃР»РµРґРЅСЏСЏ СЂРµР·РµСЂРІРЅР°СЏ РєРѕРїРёСЏ: {backup_path.name}")

    db_path = DATA_DIR / "app_data.db"

    try:
        # Р•СЃР»Рё С‚РµРєСѓС‰Р°СЏ Р±Р°Р·Р° СЃСѓС‰РµСЃС‚РІСѓРµС‚, СЃРѕР·РґР°РµРј РµРµ Р±СЌРєР°Рї
        if db_path.exists():
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            temp_backup = db_backup_dir / f"app_data_before_restore_{timestamp}.db"
            shutil.copy2(db_path, temp_backup)
            print(f"[PACKAGE] РЎРѕР·РґР°РЅР° СЂРµР·РµСЂРІРЅР°СЏ РєРѕРїРёСЏ С‚РµРєСѓС‰РµР№ Р‘Р”: {temp_backup.name}")

        # Р’РѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµРј РёР· Р±СЌРєР°РїР°
        print("\n[REFRESH] Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ Р±Р°Р·С‹ РґР°РЅРЅС‹С…...")
        shutil.copy2(backup_path, db_path)
        print(f"[OK] Р‘Р°Р·Р° РґР°РЅРЅС‹С… РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅР° РёР· {backup_path.name}")

    except Exception as e:
        print(f"[ERROR] РћС€РёР±РєР° РїСЂРё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРё Р±Р°Р·С‹ РґР°РЅРЅС‹С…: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="РЈРїСЂР°РІР»РµРЅРёРµ Р±Р°Р·РѕР№ РґР°РЅРЅС‹С…")
    parser.add_argument("action", choices=["clear", "restore", "list"], help="Р”РµР№СЃС‚РІРёРµ: clear (РѕС‡РёСЃС‚РёС‚СЊ), restore (РІРѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ), list (СЃРїРёСЃРѕРє Р±СЌРєР°РїРѕРІ)")
    parser.add_argument("--backup", help="РРјСЏ СЂРµР·РµСЂРІРЅРѕР№ РєРѕРїРёРё РґР»СЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ (РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ - РїРѕСЃР»РµРґРЅСЏСЏ)")

    args = parser.parse_args()

    if args.action == "clear":
        # Р—Р°РїСЂРѕСЃ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ
        print("[WARN]  Р’РќРРњРђРќРР•: Р‘СѓРґРµС‚ СЃРѕР·РґР°РЅР° СЂРµР·РµСЂРІРЅР°СЏ РєРѕРїРёСЏ, Р·Р°С‚РµРј Р±Р°Р·Р° РґР°РЅРЅС‹С… Р±СѓРґРµС‚ СѓРґР°Р»РµРЅР°!")
        print("   Р’СЃРµ РґР°РЅРЅС‹Рµ (РїРѕР»СЊР·РѕРІР°С‚РµР»Рё, С‚РѕРєРµРЅС‹, РЅР°СЃС‚СЂРѕР№РєРё) Р±СѓРґСѓС‚ СЃР±СЂРѕС€РµРЅС‹")
        response = input("\nРџСЂРѕРґРѕР»Р¶РёС‚СЊ? (yes/no): ").strip().lower()

        if response in ["yes", "y", "РґР°", "Рґ"]:
            clear_database()
        else:
            print("[ERROR] РћРїРµСЂР°С†РёСЏ РѕС‚РјРµРЅРµРЅР°")

    elif args.action == "restore":
        restore_database(args.backup)

    elif args.action == "list":
        db_backup_dir = BACKUPS_DIR / "database"
        all_backups = sorted(db_backup_dir.glob("*.db"), key=lambda x: x.stat().st_mtime, reverse=True)

        if not all_backups:
            print(f"[ERROR] Р РµР·РµСЂРІРЅС‹Рµ РєРѕРїРёРё РЅРµ РЅР°Р№РґРµРЅС‹ РІ {db_backup_dir}")
        else:
            print(f" РќР°Р№РґРµРЅРѕ СЂРµР·РµСЂРІРЅС‹С… РєРѕРїРёР№: {len(all_backups)}\n")
            for i, backup in enumerate(all_backups, 1):
                backup_time = datetime.fromtimestamp(backup.stat().st_mtime)
                backup_size = backup.stat().st_size / (1024 * 1024)
                print(f"{i}. {backup.name}")
                print(f"   Р Р°Р·РјРµСЂ: {backup_size:.2f} MB")
                print(f"   Р”Р°С‚Р°: {backup_time.strftime('%Y-%m-%d %H:%M:%S')}")
                print()
