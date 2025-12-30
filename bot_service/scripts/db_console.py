"""
Интерактивная консоль для работы с базой данных.

Использование:
    python scripts/db_console.py
"""

import sys
import os

# Добавляем корневую директорию в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import db_session


def main():
    """Интерактивная консоль для SQL запросов"""
    
    print("\n" + "="*60)
    print("DATABASE CONSOLE")
    print("="*60)
    print("\nПодключение к базе данных...")
    
    with db_session() as db:
        print("✅ Подключено!\n")
        
        # Показываем список таблиц
        result = db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """))
        
        tables = [row[0] for row in result]
        
        print(f"📊 Доступные таблицы ({len(tables)}):")
        for table in tables:
            print(f"  • {table}")
        
        print("\n" + "="*60)
        print("Введите SQL запрос (или 'exit' для выхода)")
        print("Примеры:")
        print("  SELECT * FROM users LIMIT 5;")
        print("  SELECT * FROM bot_tokens;")
        print("  SELECT COUNT(*) FROM chat_messages;")
        print("="*60 + "\n")
        
        while True:
            try:
                query = input("SQL> ").strip()
                
                if query.lower() in ['exit', 'quit', 'q']:
                    print("\n👋 До свидания!")
                    break
                
                if not query:
                    continue
                
                # Выполняем запрос
                result = db.execute(text(query))
                
                # Если это SELECT - показываем результаты
                if query.lower().startswith('select'):
                    rows = result.fetchall()
                    
                    if not rows:
                        print("  (нет результатов)\n")
                        continue
                    
                    # Показываем заголовки
                    headers = result.keys()
                    print("\n" + " | ".join(headers))
                    print("-" * 60)
                    
                    # Показываем данные
                    for row in rows:
                        print(" | ".join(str(val) for val in row))
                    
                    print(f"\n📊 Найдено строк: {len(rows)}\n")
                else:
                    # Для INSERT/UPDATE/DELETE
                    db.commit()
                    print(f"✅ Запрос выполнен успешно\n")
                
            except KeyboardInterrupt:
                print("\n\n👋 До свидания!")
                break
            except Exception as e:
                print(f"❌ Ошибка: {e}\n")


if __name__ == "__main__":
    main()
