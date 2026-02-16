#!/usr/bin/env python
"""РЎРєСЂРёРїС‚ РґР»СЏ РїСЂРѕРІРµСЂРєРё РґР°РЅРЅС‹С… РІ PostgreSQL"""
import sys
import os
from pathlib import Path

# РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј UTF-8 РґР»СЏ РєРѕРЅСЃРѕР»Рё Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Р”РѕР±Р°РІР»СЏРµРј РїСѓС‚СЊ РґР»СЏ РёРјРїРѕСЂС‚Р°
BOT_SERVICE_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BOT_SERVICE_ROOT))

# Р—Р°РіСЂСѓР¶Р°РµРј .env С„Р°Р№Р»
from dotenv import load_dotenv
env_path = BOT_SERVICE_ROOT / '.env'
load_dotenv(dotenv_path=env_path)

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from core.database import (
    User, UserSettings, UserToken, UserSession, BotCommand,
    ChatMessage, DropsConfig, WhitelistedChannel, ChannelReward,
    RewardQueue
)

def main():
    """РџСЂРѕРІРµСЂСЏРµС‚ РґР°РЅРЅС‹Рµ РІ PostgreSQL"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("[ERROR] DATABASE_URL РЅРµ СѓСЃС‚Р°РЅРѕРІР»РµРЅ")
        return 1
    
    print("=" * 60)
    print("  РџР РћР’Р•Р РљРђ Р”РђРќРќР«РҐ Р’ POSTGRESQL")
    print("=" * 60)
    print()
    print(f"Р‘Р°Р·Р° РґР°РЅРЅС‹С…: {database_url.split('@')[1] if '@' in database_url else database_url}")
    print()
    
    try:
        engine = create_engine(database_url)
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # РџСЂРѕРІРµСЂСЏРµРј РѕСЃРЅРѕРІРЅС‹Рµ С‚Р°Р±Р»РёС†С‹
        tables_to_check = [
            ('РџРѕР»СЊР·РѕРІР°С‚РµР»Рё', User),
            ('РќР°СЃС‚СЂРѕР№РєРё РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№', UserSettings),
            ('РўРѕРєРµРЅС‹ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№', UserToken),
            ('РЎРµСЃСЃРёРё РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№', UserSession),
            ('РљРѕРјР°РЅРґС‹ Р±РѕС‚Р°', BotCommand),
            ('РЎРѕРѕР±С‰РµРЅРёСЏ С‡Р°С‚Р°', ChatMessage),
            ('РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ Drops', DropsConfig),
            ('Whitelisted РєР°РЅР°Р»С‹', WhitelistedChannel),
            ('РќР°РіСЂР°РґС‹ РєР°РЅР°Р»Р°', ChannelReward),
            ('РћС‡РµСЂРµРґСЊ РЅР°РіСЂР°Рґ', RewardQueue),
        ]
        
        total_records = 0
        print("[STATS] РЎС‚Р°С‚РёСЃС‚РёРєР° РїРѕ С‚Р°Р±Р»РёС†Р°Рј:")
        print("-" * 60)
        for table_name, model in tables_to_check:
            count = session.query(model).count()
            total_records += count
            status = "[OK]" if count > 0 else "в—‹"
            print(f"{status} {table_name:.<40} {count:>5} Р·Р°РїРёСЃРµР№")
        
        print("-" * 60)
        print(f"Р’СЃРµРіРѕ Р·Р°РїРёСЃРµР№: {total_records}")
        print()
        
        # РџРѕРєР°Р·С‹РІР°РµРј РїСЂРёРјРµСЂС‹ РґР°РЅРЅС‹С… РёР· РѕСЃРЅРѕРІРЅС‹С… С‚Р°Р±Р»РёС†
        print("=" * 60)
        print("  РџР РРњР•Р Р« Р”РђРќРќР«РҐ")
        print("=" * 60)
        print()
        
        # РџРѕР»СЊР·РѕРІР°С‚РµР»Рё
        users = session.query(User).limit(3).all()
        if users:
            print(" РџРѕР»СЊР·РѕРІР°С‚РµР»Рё (РїРµСЂРІС‹Рµ 3):")
            for user in users:
                platforms = []
                if user.twitch_username:
                    platforms.append(f"Twitch: {user.twitch_username}")
                if user.vk_username:
                    platforms.append(f"VK: {user.vk_username}")
                admin_status = " (Admin)" if user.is_admin else ""
                active_status = "" if user.is_active else " (РќРµР°РєС‚РёРІРµРЅ)"
                print(f"   ID: {user.id}, {', '.join(platforms) if platforms else 'РќРµС‚ РїР»Р°С‚С„РѕСЂРј'}{admin_status}{active_status}")
            print()
        
        # РљРѕРјР°РЅРґС‹
        commands = session.query(BotCommand).limit(5).all()
        if commands:
            print("[BOT] РљРѕРјР°РЅРґС‹ Р±РѕС‚Р° (РїРµСЂРІС‹Рµ 5):")
            for cmd in commands:
                print(f"   {cmd.command_name} -> {cmd.response_text[:50]}...")
            print()
        
        # РЎРѕРѕР±С‰РµРЅРёСЏ
        messages = session.query(ChatMessage).order_by(ChatMessage.timestamp.desc()).limit(5).all()
        if messages:
            print("[CHAT] РџРѕСЃР»РµРґРЅРёРµ СЃРѕРѕР±С‰РµРЅРёСЏ (5):")
            for msg in messages:
                print(f"   [{msg.timestamp}] {msg.author_username}: {msg.message[:50]}...")
            print()
        
        # РџСЂРѕРІРµСЂРєР° РІРµСЂСЃРёРё Р±Р°Р·С‹
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();"))
            version = result.fetchone()[0]
            print(f"[PACKAGE] PostgreSQL РІРµСЂСЃРёСЏ: {version.split(',')[0]}")
        
        session.close()
        engine.dispose()
        
        print()
        print("=" * 60)
        print("[OK] РџСЂРѕРІРµСЂРєР° Р·Р°РІРµСЂС€РµРЅР°")
        print("=" * 60)
        
        return 0
        
    except Exception as e:
        print(f"[ERROR] РћС€РёР±РєР°: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())

