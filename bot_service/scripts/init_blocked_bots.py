#!/usr/bin/env python3
"""
РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ СЃРїРёСЃРєР° Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРЅС‹С… Р±РѕС‚РѕРІ
Р­С‚Рё Р±РѕС‚С‹ РЅРµ Р±СѓРґСѓС‚ РѕР·РІСѓС‡РёРІР°С‚СЊСЃСЏ С‡РµСЂРµР· TTS
"""
import sys
import os

# Р”РѕР±Р°РІР»СЏРµРј РїСѓС‚СЊ Рє bot_service РІ PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import SessionLocal, BlockedBot
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_blocked_bots():
    """РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ СЃРїРёСЃРєР° Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРЅС‹С… Р±РѕС‚РѕРІ"""
    db = SessionLocal()

    try:
        # РЎРїРёСЃРѕРє Р±РѕС‚РѕРІ РґР»СЏ Р±Р»РѕРєРёСЂРѕРІРєРё (РЅР°С€ Р±РѕС‚ + РїРѕРїСѓР»СЏСЂРЅС‹Рµ Р±РѕС‚С‹)
        bots_to_block = [
            "payedviewer",      # в­ђ РќРђРЁ Р‘РћРў - РЅРµ РѕР·РІСѓС‡РёРІР°С‚СЊ РµРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ
            "streamelements",   # РђР»РµСЂС‚С‹ Рё СЃРѕР±С‹С‚РёСЏ
            "nightbot",         # РњРѕРґРµСЂР°С†РёСЏ
            "streamlabs",       # Р”РѕРЅР°С‚С‹ Рё Р°Р»РµСЂС‚С‹
            "moobot",           # РњРѕРґРµСЂР°С†РёСЏ
            "twirapp",          # РўСѓСЂРЅРёСЂС‹
            "fossabot",         # РњРѕРґРµСЂР°С†РёСЏ
            "streamlabs",       # Р”РѕРЅР°С‚С‹
            "wizebot",          # РњРѕРґРµСЂР°С†РёСЏ
            "botrix",           # РњРѕРґРµСЂР°С†РёСЏ
            "coebot",           # РњРѕРґРµСЂР°С†РёСЏ
            "ankhbot",          # РњРѕРґРµСЂР°С†РёСЏ
            "deepbot",          # РњРѕРґРµСЂР°С†РёСЏ
            "xanbot",           # РњРѕРґРµСЂР°С†РёСЏ
            "vivbot",           # РњРѕРґРµСЂР°С†РёСЏ
            "ohbot",            # РњРѕРґРµСЂР°С†РёСЏ
            "scorpstradamus",   # РњРѕРґРµСЂР°С†РёСЏ
            "sery_bot",         # VK Р±РѕС‚
            "chatbot",          # VK Live СЃРёСЃС‚РµРјРЅС‹Р№ Р±РѕС‚ (РЅР°РіСЂР°РґС‹)
        ]

        added_count = 0
        skipped_count = 0

        for bot_name in bots_to_block:
            bot_name_lower = bot_name.lower()

            # РџСЂРѕРІРµСЂСЏРµРј, РЅРµ РґРѕР±Р°РІР»РµРЅ Р»Рё СѓР¶Рµ
            existing = db.query(BlockedBot).filter(
                BlockedBot.bot_name == bot_name_lower
            ).first()

            if existing:
                logger.info(f"[SKIP]  Bot '{bot_name_lower}' already in blocked list")
                skipped_count += 1
                continue

            # Р”РѕР±Р°РІР»СЏРµРј Р±РѕС‚Р°
            blocked_bot = BlockedBot(bot_name=bot_name_lower)
            db.add(blocked_bot)
            logger.info(f"[OK] Added bot '{bot_name_lower}' to blocked list")
            added_count += 1

        db.commit()

        print("\n" + "=" * 70)
        print("[OK] Blocked bots initialization complete!")
        print(f"   Added: {added_count}")
        print(f"   Skipped (already exists): {skipped_count}")
        print(f"   Total blocked bots: {added_count + skipped_count}")
        print("=" * 70)

        # РџРѕРєР°Р·С‹РІР°РµРј РїРѕР»РЅС‹Р№ СЃРїРёСЃРѕРє
        all_blocked = db.query(BlockedBot).order_by(BlockedBot.bot_name).all()
        print("\n[LIST] Current blocked bots list:")
        for bot in all_blocked:
            marker = "в­ђ" if bot.bot_name == "payedviewer" else "[BOT]"
            print(f"   {marker} {bot.bot_name}")
        print()

    except Exception as e:
        logger.error(f"[ERROR] Error initializing blocked bots: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("[BOT] Initializing blocked bots list...")
    print("   These bots will NOT be voiced by TTS\n")
    init_blocked_bots()
    print("[OK] Done!")

