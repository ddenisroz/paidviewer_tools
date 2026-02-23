"""Text cleaned."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import text
from core.database import db_session

def show_all_tables():
    """Показать все таблицы"""
    print('\n' + '=' * 60)
    print('Text cleaned.')
    print('=' * 60 + '\n')
    with db_session() as db:
        result = db.execute(text("\n            SELECT \n                table_name,\n                (SELECT COUNT(*) \n                 FROM information_schema.columns \n                 WHERE table_name = t.table_name \n                 AND table_schema = 'public') as column_count\n            FROM information_schema.tables t\n            WHERE table_schema = 'public'\n            ORDER BY table_name;\n        "))
        tables = result.fetchall()
        print(f' Всего таблиц: {len(tables)}\n')
        for (table_name, column_count) in tables:
            try:
                count_result = db.execute(text(f'SELECT COUNT(*) FROM {table_name}'))
                row_count = count_result.scalar()
            except Exception:
                row_count = 'N/A'
            print(f' {table_name}')
            print(f'   Колонок: {column_count} | Записей: {row_count}')
            print()

def show_table_details(table_name: str):
    """Показать детали конкретной таблицы"""
    print('\n' + '=' * 60)
    print(f'Text cleaned.{table_name}')
    print('=' * 60 + '\n')
    with db_session() as db:
        result = db.execute(text("\n            SELECT EXISTS (\n                SELECT FROM information_schema.tables \n                WHERE table_schema = 'public' \n                AND table_name = :table_name\n            );\n        "), {'table_name': table_name})
        if not result.scalar():
            print(f"[ERROR] Таблица '{table_name}' не найдена\n")
            return
        result = db.execute(text("\n            SELECT \n                column_name,\n                data_type,\n                character_maximum_length,\n                is_nullable,\n                column_default\n            FROM information_schema.columns\n            WHERE table_name = :table_name\n            AND table_schema = 'public'\n            ORDER BY ordinal_position;\n        "), {'table_name': table_name})
        columns = result.fetchall()
        print(' Колонки:\n')
        print(f"{'Название':<30} {'Тип':<20} {'NULL':<8} {'По умолчанию'}")
        print('-' * 80)
        for (col_name, data_type, max_length, nullable, default) in columns:
            type_str = data_type
            if max_length:
                type_str += f'({max_length})'
            nullable_str = 'YES' if nullable == 'YES' else 'NO'
            default_str = str(default)[:30] if default else '-'
            print(f'{col_name:<30} {type_str:<20} {nullable_str:<8} {default_str}')
        result = db.execute(text("\n            SELECT\n                indexname,\n                indexdef\n            FROM pg_indexes\n            WHERE tablename = :table_name\n            AND schemaname = 'public';\n        "), {'table_name': table_name})
        indexes = result.fetchall()
        if indexes:
            print('Text cleaned.')
            for (idx_name, idx_def) in indexes:
                print(f'Text cleaned.{idx_name}')
                print(f'    {idx_def}\n')
        result = db.execute(text(f'SELECT COUNT(*) FROM {table_name}'))
        row_count = result.scalar()
        print(f'\n Всего записей: {row_count}')
        if row_count > 0:
            print('\n Примеры данных (первые 5 записей):\n')
            result = db.execute(text(f'SELECT * FROM {table_name} LIMIT 5'))
            rows = result.fetchall()
            if rows:
                headers = result.keys()
                header_line = ' | '.join((str(h)[:15] for h in headers))
                print(header_line)
                print('-' * len(header_line))
                for row in rows:
                    row_line = ' | '.join((str(val)[:15] if val is not None else 'NULL' for val in row))
                    print(row_line)
        print('\n' + '=' * 60 + '\n')

def main():
    """Главная функция"""
    if len(sys.argv) > 1:
        table_name = sys.argv[1]
        show_table_details(table_name)
    else:
        show_all_tables()
        print('\n Для просмотра деталей таблицы:')
        print('   python scripts/show_db_structure.py <table_name>')
        print('\nПример:')
        print('   python scripts/show_db_structure.py users')
        print('   python scripts/show_db_structure.py bot_tokens\n')
if __name__ == '__main__':
    main()
