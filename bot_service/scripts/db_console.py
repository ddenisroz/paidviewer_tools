"""
РРЅС‚РµСЂР°РєС‚РёРІРЅР°СЏ РєРѕРЅСЃРѕР»СЊ РґР»СЏ СЂР°Р±РѕС‚С‹ СЃ Р±Р°Р·РѕР№ РґР°РЅРЅС‹С….

РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ:
    python scripts/db_console.py
"""

import sys
import os

# Р”РѕР±Р°РІР»СЏРµРј РєРѕСЂРЅРµРІСѓСЋ РґРёСЂРµРєС‚РѕСЂРёСЋ РІ РїСѓС‚СЊ
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import db_session


def main():
    """РРЅС‚РµСЂР°РєС‚РёРІРЅР°СЏ РєРѕРЅСЃРѕР»СЊ РґР»СЏ SQL Р·Р°РїСЂРѕСЃРѕРІ"""
    
    print("\n" + "="*60)
    print("DATABASE CONSOLE")
    print("="*60)
    print("\nРџРѕРґРєР»СЋС‡РµРЅРёРµ Рє Р±Р°Р·Рµ РґР°РЅРЅС‹С…...")
    
    with db_session() as db:
        print(" РџРѕРґРєР»СЋС‡РµРЅРѕ!\n")
        
        # РџРѕРєР°Р·С‹РІР°РµРј СЃРїРёСЃРѕРє С‚Р°Р±Р»РёС†
        result = db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """))
        
        tables = [row[0] for row in result]
        
        print(f" Р”РѕСЃС‚СѓРїРЅС‹Рµ С‚Р°Р±Р»РёС†С‹ ({len(tables)}):")
        for table in tables:
            print(f"  вЂў {table}")
        
        print("\n" + "="*60)
        print("Р’РІРµРґРёС‚Рµ SQL Р·Р°РїСЂРѕСЃ (РёР»Рё 'exit' РґР»СЏ РІС‹С…РѕРґР°)")
        print("РџСЂРёРјРµСЂС‹:")
        print("  SELECT * FROM users LIMIT 5;")
        print("  SELECT * FROM bot_tokens;")
        print("  SELECT COUNT(*) FROM chat_messages;")
        print("="*60 + "\n")
        
        while True:
            try:
                query = input("SQL> ").strip()
                
                if query.lower() in ['exit', 'quit', 'q']:
                    print("\n Р”Рѕ СЃРІРёРґР°РЅРёСЏ!")
                    break
                
                if not query:
                    continue
                
                # Р’С‹РїРѕР»РЅСЏРµРј Р·Р°РїСЂРѕСЃ
                result = db.execute(text(query))
                
                # Р•СЃР»Рё СЌС‚Рѕ SELECT - РїРѕРєР°Р·С‹РІР°РµРј СЂРµР·СѓР»СЊС‚Р°С‚С‹
                if query.lower().startswith('select'):
                    rows = result.fetchall()
                    
                    if not rows:
                        print("  (РЅРµС‚ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ)\n")
                        continue
                    
                    # РџРѕРєР°Р·С‹РІР°РµРј Р·Р°РіРѕР»РѕРІРєРё
                    headers = result.keys()
                    print("\n" + " | ".join(headers))
                    print("-" * 60)
                    
                    # РџРѕРєР°Р·С‹РІР°РµРј РґР°РЅРЅС‹Рµ
                    for row in rows:
                        print(" | ".join(str(val) for val in row))
                    
                    print(f"\n РќР°Р№РґРµРЅРѕ СЃС‚СЂРѕРє: {len(rows)}\n")
                else:
                    # Р”Р»СЏ INSERT/UPDATE/DELETE
                    db.commit()
                    print(" Р—Р°РїСЂРѕСЃ РІС‹РїРѕР»РЅРµРЅ СѓСЃРїРµС€РЅРѕ\n")
                
            except KeyboardInterrupt:
                print("\n\n Р”Рѕ СЃРІРёРґР°РЅРёСЏ!")
                break
            except Exception as e:
                print(f"[ERROR] РћС€РёР±РєР°: {e}\n")


if __name__ == "__main__":
    main()
