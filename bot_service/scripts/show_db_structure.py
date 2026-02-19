"""
Показать структуру базы данных.

РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ:
    python scripts/show_db_structure.py
    python scripts/show_db_structure.py users  # Детали конкретной таблицы
"""

import sys
import os

# Добавляем корневую директорию в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Загружаем переменные окружения
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text  # noqa: E402
from core.database import db_session  # noqa: E402


def show_all_tables():
    """Показать все таблицы"""
    
    print("\n" + "="*60)
    print("СТРУКТУРА БАЗЫ ДАННЫХ")
    print("="*60 + "\n")
    
    with db_session() as db:
        # Получаем список таблиц
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
        
        print(f" Всего таблиц: {len(tables)}\n")
        
        for table_name, column_count in tables:
            # Получаем количество записей
            try:
                count_result = db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                row_count = count_result.scalar()
            except Exception:
                row_count = "N/A"
            
            print(f" {table_name}")
            print(f"   Колонок: {column_count} | Записей: {row_count}")
            print()


def show_table_details(table_name: str):
    """Показать детали конкретной таблицы"""
    
    print("\n" + "="*60)
    print(f"РўРђР‘Р›РР¦Рђ: {table_name}")
    print("="*60 + "\n")
    
    with db_session() as db:
        # Проверяем существование таблицы
        result = db.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = :table_name
            );
        """), {"table_name": table_name})
        
        if not result.scalar():
            print(f"[ERROR] Таблица '{table_name}' не найдена\n")
            return
        
        # Получаем структуру таблицы
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
        
        print(" Колонки:\n")
        print(f"{'Название':<30} {'Тип':<20} {'NULL':<8} {'По умолчанию'}")
        print("-" * 80)
        
        for col_name, data_type, max_length, nullable, default in columns:
            type_str = data_type
            if max_length:
                type_str += f"({max_length})"
            
            nullable_str = "YES" if nullable == "YES" else "NO"
            default_str = str(default)[:30] if default else "-"
            
            print(f"{col_name:<30} {type_str:<20} {nullable_str:<8} {default_str}")
        
        # Получаем индексы
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
        
        # Получаем количество записей
        result = db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
        row_count = result.scalar()
        
        print(f"\n Всего записей: {row_count}")
        
        # Показываем примеры данных
        if row_count > 0:
            print("\n Примеры данных (первые 5 записей):\n")
            result = db.execute(text(f"SELECT * FROM {table_name} LIMIT 5"))
            rows = result.fetchall()
            
            if rows:
                headers = result.keys()
                
                # Показываем заголовки
                header_line = " | ".join(str(h)[:15] for h in headers)
                print(header_line)
                print("-" * len(header_line))
                
                # Показываем данные
                for row in rows:
                    row_line = " | ".join(str(val)[:15] if val is not None else "NULL" for val in row)
                    print(row_line)
        
        print("\n" + "="*60 + "\n")


def main():
    """Главная функция"""
    
    if len(sys.argv) > 1:
        # Показать детали конкретной таблицы
        table_name = sys.argv[1]
        show_table_details(table_name)
    else:
        # Показать все таблицы
        show_all_tables()
        
        print("\n Для просмотра деталей таблицы:")
        print("   python scripts/show_db_structure.py <table_name>")
        print("\nПример:")
        print("   python scripts/show_db_structure.py users")
        print("   python scripts/show_db_structure.py bot_tokens\n")


if __name__ == "__main__":
    main()
