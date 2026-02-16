"""
РџРѕРєР°Р·Р°С‚СЊ СЃС‚СЂСѓРєС‚СѓСЂСѓ Р±Р°Р·С‹ РґР°РЅРЅС‹С….

РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ:
    python scripts/show_db_structure.py
    python scripts/show_db_structure.py users  # Р”РµС‚Р°Р»Рё РєРѕРЅРєСЂРµС‚РЅРѕР№ С‚Р°Р±Р»РёС†С‹
"""

import sys
import os

# Р”РѕР±Р°РІР»СЏРµРј РєРѕСЂРЅРµРІСѓСЋ РґРёСЂРµРєС‚РѕСЂРёСЋ РІ РїСѓС‚СЊ
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Р—Р°РіСЂСѓР¶Р°РµРј РїРµСЂРµРјРµРЅРЅС‹Рµ РѕРєСЂСѓР¶РµРЅРёСЏ
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text  # noqa: E402
from core.database import db_session  # noqa: E402


def show_all_tables():
    """РџРѕРєР°Р·Р°С‚СЊ РІСЃРµ С‚Р°Р±Р»РёС†С‹"""
    
    print("\n" + "="*60)
    print("РЎРўР РЈРљРўРЈР Рђ Р‘РђР—Р« Р”РђРќРќР«РҐ")
    print("="*60 + "\n")
    
    with db_session() as db:
        # РџРѕР»СѓС‡Р°РµРј СЃРїРёСЃРѕРє С‚Р°Р±Р»РёС†
        result = db.execute(text("""
            SELECT 
                table_name,
                (SELECT COUNT(*) 
                 FROM information_schema.columns 
                 WHERE table_name = t.table_name 
                 AND table_schema = 'public') as column_count
            FROM information_schema.tables t
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """))
        
        tables = result.fetchall()
        
        print(f" Р’СЃРµРіРѕ С‚Р°Р±Р»РёС†: {len(tables)}\n")
        
        for table_name, column_count in tables:
            # РџРѕР»СѓС‡Р°РµРј РєРѕР»РёС‡РµСЃС‚РІРѕ Р·Р°РїРёСЃРµР№
            try:
                count_result = db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                row_count = count_result.scalar()
            except Exception:
                row_count = "N/A"
            
            print(f" {table_name}")
            print(f"   РљРѕР»РѕРЅРѕРє: {column_count} | Р—Р°РїРёСЃРµР№: {row_count}")
            print()


def show_table_details(table_name: str):
    """РџРѕРєР°Р·Р°С‚СЊ РґРµС‚Р°Р»Рё РєРѕРЅРєСЂРµС‚РЅРѕР№ С‚Р°Р±Р»РёС†С‹"""
    
    print("\n" + "="*60)
    print(f"РўРђР‘Р›РР¦Рђ: {table_name}")
    print("="*60 + "\n")
    
    with db_session() as db:
        # РџСЂРѕРІРµСЂСЏРµРј СЃСѓС‰РµСЃС‚РІРѕРІР°РЅРёРµ С‚Р°Р±Р»РёС†С‹
        result = db.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = :table_name
            );
        """), {"table_name": table_name})
        
        if not result.scalar():
            print(f"[ERROR] РўР°Р±Р»РёС†Р° '{table_name}' РЅРµ РЅР°Р№РґРµРЅР°\n")
            return
        
        # РџРѕР»СѓС‡Р°РµРј СЃС‚СЂСѓРєС‚СѓСЂСѓ С‚Р°Р±Р»РёС†С‹
        result = db.execute(text("""
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = :table_name
            AND table_schema = 'public'
            ORDER BY ordinal_position;
        """), {"table_name": table_name})
        
        columns = result.fetchall()
        
        print(" РљРѕР»РѕРЅРєРё:\n")
        print(f"{'РќР°Р·РІР°РЅРёРµ':<30} {'РўРёРї':<20} {'NULL':<8} {'РџРѕ СѓРјРѕР»С‡Р°РЅРёСЋ'}")
        print("-" * 80)
        
        for col_name, data_type, max_length, nullable, default in columns:
            type_str = data_type
            if max_length:
                type_str += f"({max_length})"
            
            nullable_str = "YES" if nullable == "YES" else "NO"
            default_str = str(default)[:30] if default else "-"
            
            print(f"{col_name:<30} {type_str:<20} {nullable_str:<8} {default_str}")
        
        # РџРѕР»СѓС‡Р°РµРј РёРЅРґРµРєСЃС‹
        result = db.execute(text("""
            SELECT
                indexname,
                indexdef
            FROM pg_indexes
            WHERE tablename = :table_name
            AND schemaname = 'public';
        """), {"table_name": table_name})
        
        indexes = result.fetchall()
        
        if indexes:
            print("\n РРЅРґРµРєСЃС‹:\n")
            for idx_name, idx_def in indexes:
                print(f"  вЂў {idx_name}")
                print(f"    {idx_def}\n")
        
        # РџРѕР»СѓС‡Р°РµРј РєРѕР»РёС‡РµСЃС‚РІРѕ Р·Р°РїРёСЃРµР№
        result = db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
        row_count = result.scalar()
        
        print(f"\n Р’СЃРµРіРѕ Р·Р°РїРёСЃРµР№: {row_count}")
        
        # РџРѕРєР°Р·С‹РІР°РµРј РїСЂРёРјРµСЂС‹ РґР°РЅРЅС‹С…
        if row_count > 0:
            print("\n РџСЂРёРјРµСЂС‹ РґР°РЅРЅС‹С… (РїРµСЂРІС‹Рµ 5 Р·Р°РїРёСЃРµР№):\n")
            result = db.execute(text(f"SELECT * FROM {table_name} LIMIT 5"))
            rows = result.fetchall()
            
            if rows:
                headers = result.keys()
                
                # РџРѕРєР°Р·С‹РІР°РµРј Р·Р°РіРѕР»РѕРІРєРё
                header_line = " | ".join(str(h)[:15] for h in headers)
                print(header_line)
                print("-" * len(header_line))
                
                # РџРѕРєР°Р·С‹РІР°РµРј РґР°РЅРЅС‹Рµ
                for row in rows:
                    row_line = " | ".join(str(val)[:15] if val is not None else "NULL" for val in row)
                    print(row_line)
        
        print("\n" + "="*60 + "\n")


def main():
    """Р“Р»Р°РІРЅР°СЏ С„СѓРЅРєС†РёСЏ"""
    
    if len(sys.argv) > 1:
        # РџРѕРєР°Р·Р°С‚СЊ РґРµС‚Р°Р»Рё РєРѕРЅРєСЂРµС‚РЅРѕР№ С‚Р°Р±Р»РёС†С‹
        table_name = sys.argv[1]
        show_table_details(table_name)
    else:
        # РџРѕРєР°Р·Р°С‚СЊ РІСЃРµ С‚Р°Р±Р»РёС†С‹
        show_all_tables()
        
        print("\n Р”Р»СЏ РїСЂРѕСЃРјРѕС‚СЂР° РґРµС‚Р°Р»РµР№ С‚Р°Р±Р»РёС†С‹:")
        print("   python scripts/show_db_structure.py <table_name>")
        print("\nРџСЂРёРјРµСЂ:")
        print("   python scripts/show_db_structure.py users")
        print("   python scripts/show_db_structure.py bot_tokens\n")


if __name__ == "__main__":
    main()
