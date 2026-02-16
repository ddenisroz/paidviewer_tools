"""
РџСЂРѕРІРµСЂРёС‚СЊ СЃС‚Р°С‚СѓСЃ tts_enabled РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text
from core.database import db_session


def check_tts():
    with db_session() as db:
        result = db.execute(text("SELECT id, tts_enabled, tts_listening_mode FROM users WHERE id=1"))
        row = result.fetchone()
        
        if row:
            print(f"\nUser ID: {row[0]}")
            print(f"tts_enabled: {row[1]}")
            print(f"tts_listening_mode: {row[2]}")
            
            if row[1]:
                print("\nвљ пёЏ TTS Р’РљР›Р®Р§Р•Рќ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ!")
                print("\nРћС‚РєР»СЋС‡РёС‚СЊ:")
                print("UPDATE users SET tts_enabled = false WHERE id = 1;")
            else:
                print("\n TTS РІС‹РєР»СЋС‡РµРЅ (РїСЂР°РІРёР»СЊРЅРѕ)")
        else:
            print("User not found")


if __name__ == "__main__":
    check_tts()
