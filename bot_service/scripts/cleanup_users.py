#!/usr/bin/env python3
"""
РЎРєСЂРёРїС‚ РґР»СЏ РѕС‡РёСЃС‚РєРё Р±Р°Р·С‹ РґР°РЅРЅС‹С… РѕС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№

Р’РќРРњРђРќРР•: Р­С‚РѕС‚ СЃРєСЂРёРїС‚ СѓРґР°Р»СЏРµС‚ Р’РЎР• РґР°РЅРЅС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№!
РСЃРїРѕР»СЊР·СѓР№С‚Рµ СЃ РѕСЃС‚РѕСЂРѕР¶РЅРѕСЃС‚СЊСЋ!
"""

import sys
import os
from datetime import datetime
import shutil

# Р”РѕР±Р°РІР»СЏРµРј РїСѓС‚СЊ Рє bot_service
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.database import SessionLocal, User, UserToken, TTSUserSettings, AudioSettings, LocalTTSEndpoint, FilteredWord, TTSBlockedUser, UserSession

def create_backup():
    """РЎРѕР·РґР°РµС‚ СЂРµР·РµСЂРІРЅСѓСЋ РєРѕРїРёСЋ Р±Р°Р·С‹ РґР°РЅРЅС‹С…"""
    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'app_data.db')

    if not os.path.exists(db_path):
        print(f"[WARN] Р‘Р°Р·Р° РґР°РЅРЅС‹С… РЅРµ РЅР°Р№РґРµРЅР°: {db_path}")
        print(f"   РћР¶РёРґР°РµРјС‹Р№ РїСѓС‚СЊ: {os.path.abspath(db_path)}")
        return None

    backup_dir = os.path.join(os.path.dirname(__file__), '..', 'backups', 'database')
    os.makedirs(backup_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = os.path.join(backup_dir, f'app_data_backup_{timestamp}.db')

    try:
        shutil.copy2(db_path, backup_path)
        file_size = os.path.getsize(backup_path)
        print(f"[OK] Р РµР·РµСЂРІРЅР°СЏ РєРѕРїРёСЏ СЃРѕР·РґР°РЅР°: {backup_path}")
        print(f"   Р Р°Р·РјРµСЂ: {file_size / 1024:.2f} KB")
        return backup_path
    except Exception as e:
        print(f"[ERROR] РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ СЂРµР·РµСЂРІРЅРѕР№ РєРѕРїРёРё: {e}")
        return None

def show_database_stats(db):
    """РџРѕРєР°Р·С‹РІР°РµС‚ СЃС‚Р°С‚РёСЃС‚РёРєСѓ Р±Р°Р·С‹ РґР°РЅРЅС‹С…"""
    print("\n" + "="*60)
    print("[STATS] РўР•РљРЈР©РђРЇ РЎРўРђРўРРЎРўРРљРђ Р‘РђР—Р« Р”РђРќРќР«РҐ")
    print("="*60)

    stats = {
        "РџРѕР»СЊР·РѕРІР°С‚РµР»Рё (users)": db.query(User).count(),
        "РўРѕРєРµРЅС‹ (user_tokens)": db.query(UserToken).count(),
        "РќР°СЃС‚СЂРѕР№РєРё TTS (tts_user_settings)": db.query(TTSUserSettings).count(),
        "РќР°СЃС‚СЂРѕР№РєРё Р°СѓРґРёРѕ (audio_settings)": db.query(AudioSettings).count(),
        "Р›РѕРєР°Р»СЊРЅС‹Рµ TTS (local_tts_endpoints)": db.query(LocalTTSEndpoint).count(),
        "Р¤РёР»СЊС‚СЂС‹ СЃР»РѕРІ (filtered_words)": db.query(FilteredWord).count(),
        "Р—Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРЅС‹Рµ (tts_blocked_users)": db.query(TTSBlockedUser).count(),
        "РЎРµСЃСЃРёРё (user_sessions)": db.query(UserSession).count(),
    }

    total = sum(stats.values())

    for table_name, count in stats.items():
        print(f"  вЂў {table_name:<40} {count:>5} Р·Р°РїРёСЃРµР№")

    print("-"*60)
    print(f"  Р’РЎР•Р“Рћ Р—РђРџРРЎР•Р™: {total}")
    print("="*60)

    return stats

def cleanup_users(db, keep_admins=True):
    """РЈРґР°Р»СЏРµС‚ РІСЃРµС… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ Рё СЃРІСЏР·Р°РЅРЅС‹Рµ РґР°РЅРЅС‹Рµ"""

    print("\n[DELETE]  РќР°С‡РёРЅР°РµРј РѕС‡РёСЃС‚РєСѓ...\n")

    deleted_counts = {}

    # 1. РџРѕР»СѓС‡Р°РµРј СЃРїРёСЃРѕРє РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РґР»СЏ СѓРґР°Р»РµРЅРёСЏ
    if keep_admins:
        users_to_delete = db.query(User).filter(not User.is_admin).all()
        print("[LIST] РЈРґР°Р»РµРЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ (СЃРѕС…СЂР°РЅСЏРµРј Р°РґРјРёРЅРѕРІ)...")
    else:
        users_to_delete = db.query(User).all()
        print("[LIST] РЈРґР°Р»РµРЅРёРµ Р’РЎР•РҐ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ (РІРєР»СЋС‡Р°СЏ Р°РґРјРёРЅРѕРІ)...")

    user_ids = [user.id for user in users_to_delete]

    if not user_ids:
        print("[INFO]  РќРµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РґР»СЏ СѓРґР°Р»РµРЅРёСЏ")
        return deleted_counts

    print(f"   РќР°Р№РґРµРЅРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№: {len(user_ids)}")

    # 2. РЈРґР°Р»СЏРµРј СЃРІСЏР·Р°РЅРЅС‹Рµ РґР°РЅРЅС‹Рµ
    print("\n[LINK] РЈРґР°Р»РµРЅРёРµ СЃРІСЏР·Р°РЅРЅС‹С… РґР°РЅРЅС‹С…...")

    # РўРѕРєРµРЅС‹
    deleted = db.query(UserToken).filter(UserToken.user_id.in_(user_ids)).delete(synchronize_session=False)
    deleted_counts['user_tokens'] = deleted
    print(f"   вЂў РўРѕРєРµРЅС‹: {deleted}")

    # РќР°СЃС‚СЂРѕР№РєРё TTS
    deleted = db.query(TTSUserSettings).filter(TTSUserSettings.user_id.in_(user_ids)).delete(synchronize_session=False)
    deleted_counts['tts_user_settings'] = deleted
    print(f"   вЂў РќР°СЃС‚СЂРѕР№РєРё TTS: {deleted}")

    # РќР°СЃС‚СЂРѕР№РєРё Р°СѓРґРёРѕ
    deleted = db.query(AudioSettings).filter(AudioSettings.user_id.in_(user_ids)).delete(synchronize_session=False)
    deleted_counts['audio_settings'] = deleted
    print(f"   вЂў РќР°СЃС‚СЂРѕР№РєРё Р°СѓРґРёРѕ: {deleted}")

    # Р›РѕРєР°Р»СЊРЅС‹Рµ TTS endpoints
    deleted = db.query(LocalTTSEndpoint).filter(LocalTTSEndpoint.user_id.in_(user_ids)).delete(synchronize_session=False)
    deleted_counts['local_tts_endpoints'] = deleted
    print(f"   вЂў Р›РѕРєР°Р»СЊРЅС‹Рµ TTS: {deleted}")

    # Р¤РёР»СЊС‚СЂС‹ СЃР»РѕРІ
    deleted = db.query(FilteredWord).filter(FilteredWord.user_id.in_(user_ids)).delete(synchronize_session=False)
    deleted_counts['filtered_words'] = deleted
    print(f"   вЂў Р¤РёР»СЊС‚СЂС‹ СЃР»РѕРІ: {deleted}")

    # Р—Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРЅС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»Рё
    deleted = db.query(TTSBlockedUser).filter(TTSBlockedUser.user_id.in_(user_ids)).delete(synchronize_session=False)
    deleted_counts['tts_blocked_users'] = deleted
    print(f"   вЂў Р—Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРЅС‹Рµ: {deleted}")

    # РЎРµСЃСЃРёРё
    deleted = db.query(UserSession).filter(UserSession.user_id.in_(user_ids)).delete(synchronize_session=False)
    deleted_counts['user_sessions'] = deleted
    print(f"   вЂў РЎРµСЃСЃРёРё: {deleted}")

    # 3. РЈРґР°Р»СЏРµРј СЃР°РјРёС… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№
    print("\n РЈРґР°Р»РµРЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№...")
    for user in users_to_delete:
        display_name = user.twitch_username or user.vk_username or f'user_{user.id}'
        is_admin = " (ADMIN)" if user.is_admin else ""
        print(f"   вЂў {display_name}{is_admin} (ID: {user.id})")
        db.delete(user)

    deleted_counts['users'] = len(users_to_delete)

    # 4. РЎРѕС…СЂР°РЅСЏРµРј РёР·РјРµРЅРµРЅРёСЏ
    db.commit()
    print(f"\n[OK] РЈРґР°Р»РµРЅРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№: {len(users_to_delete)}")

    return deleted_counts

def main():
    print("\n" + "="*60)
    print("[DELETE]  РЎРљР РРџРў РћР§РРЎРўРљР Р‘РђР—Р« Р”РђРќРќР«РҐ РћРў РџРћР›Р¬Р—РћР’РђРўР•Р›Р•Р™")
    print("="*60)

    db = SessionLocal()

    try:
        # РџРѕРєР°Р·С‹РІР°РµРј СЃС‚Р°С‚РёСЃС‚РёРєСѓ Р”Рћ РѕС‡РёСЃС‚РєРё
        stats_before = show_database_stats(db)

        if stats_before['РџРѕР»СЊР·РѕРІР°С‚РµР»Рё (users)'] == 0:
            print("\n[OK] Р‘Р°Р·Р° РґР°РЅРЅС‹С… СѓР¶Рµ РїСѓСЃС‚Р°!")
            return

        # Р—Р°РїСЂР°С€РёРІР°РµРј РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ
        print("\n[WARN]  Р’РќРРњРђРќРР•! Р­С‚Р° РѕРїРµСЂР°С†РёСЏ СѓРґР°Р»РёС‚ Р’РЎР• РґР°РЅРЅС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№!")
        print("    РџРµСЂРµРґ РѕС‡РёСЃС‚РєРѕР№ Р±СѓРґРµС‚ СЃРѕР·РґР°РЅР° СЂРµР·РµСЂРІРЅР°СЏ РєРѕРїРёСЏ Р±Р°Р·С‹ РґР°РЅРЅС‹С….")
        print("\nР’С‹Р±РµСЂРёС‚Рµ СЂРµР¶РёРј:")
        print("  1. РЈРґР°Р»РёС‚СЊ РІСЃРµС… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РљР РћРњР• РђР”РњРРќРћР’ (СЂРµРєРѕРјРµРЅРґСѓРµС‚СЃСЏ)")
        print("  2. РЈРґР°Р»РёС‚СЊ Р’РЎР•РҐ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ (РІРєР»СЋС‡Р°СЏ Р°РґРјРёРЅРѕРІ)")
        print("  0. РћС‚РјРµРЅР°")

        choice = input("\nР’Р°С€ РІС‹Р±РѕСЂ (0/1/2): ").strip()

        if choice == '0':
            print("\n[ERROR] РћРїРµСЂР°С†РёСЏ РѕС‚РјРµРЅРµРЅР° РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј")
            return

        if choice not in ['1', '2']:
            print("\n[ERROR] РќРµРІРµСЂРЅС‹Р№ РІС‹Р±РѕСЂ!")
            return

        keep_admins = (choice == '1')

        # РЎРѕР·РґР°РµРј СЂРµР·РµСЂРІРЅСѓСЋ РєРѕРїРёСЋ
        print("\n[PACKAGE] РЎРѕР·РґР°РЅРёРµ СЂРµР·РµСЂРІРЅРѕР№ РєРѕРїРёРё...")
        backup_path = create_backup()

        if not backup_path:
            print("[ERROR] РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ СЂРµР·РµСЂРІРЅСѓСЋ РєРѕРїРёСЋ. РћРїРµСЂР°С†РёСЏ РѕС‚РјРµРЅРµРЅР°.")
            return

        # РџРѕСЃР»РµРґРЅРµРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ
        confirm = input("\n[WARN]  Р’С‹ СѓРІРµСЂРµРЅС‹? Р’РІРµРґРёС‚Рµ 'YES' РґР»СЏ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ: ").strip()

        if confirm != 'YES':
            print("\n[ERROR] РћРїРµСЂР°С†РёСЏ РѕС‚РјРµРЅРµРЅР°")
            return

        # Р’С‹РїРѕР»РЅСЏРµРј РѕС‡РёСЃС‚РєСѓ
        deleted_counts = cleanup_users(db, keep_admins=keep_admins)

        # РџРѕРєР°Р·С‹РІР°РµРј СЃС‚Р°С‚РёСЃС‚РёРєСѓ РџРћРЎР›Р• РѕС‡РёСЃС‚РєРё
        print("\n" + "="*60)
        print("[STATS] Р Р•Р—РЈР›Р¬РўРђРў РћР§РРЎРўРљР")
        print("="*60)

        total_deleted = sum(deleted_counts.values())
        for table_name, count in deleted_counts.items():
            print(f"  вЂў {table_name:<40} {count:>5} СѓРґР°Р»РµРЅРѕ")

        print("-"*60)
        print(f"  Р’РЎР•Р“Рћ РЈР”РђР›Р•РќРћ: {total_deleted}")
        print("="*60)

        # Р¤РёРЅР°Р»СЊРЅР°СЏ СЃС‚Р°С‚РёСЃС‚РёРєР°
        show_database_stats(db)

        print("\n[OK] РћС‡РёСЃС‚РєР° Р·Р°РІРµСЂС€РµРЅР° СѓСЃРїРµС€РЅРѕ!")
        print(f"[PACKAGE] Р РµР·РµСЂРІРЅР°СЏ РєРѕРїРёСЏ СЃРѕС…СЂР°РЅРµРЅР°: {backup_path}")

    except Exception as e:
        print(f"\n[ERROR] РћС€РёР±РєР° РїСЂРё РѕС‡РёСЃС‚РєРµ Р±Р°Р·С‹ РґР°РЅРЅС‹С…: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()

