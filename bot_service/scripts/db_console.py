"""Text cleaned."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy import text
from core.database import db_session

def main():
    """Text cleaned."""
    print('\n' + '=' * 60)
    print('DATABASE CONSOLE')
    print('=' * 60)
    print('\nПодключение к базе данных...')
    with db_session() as db:
        print(' Подключено!\n')
        result = db.execute(text("\n            SELECT table_name \n            FROM information_schema.tables \n            WHERE table_schema = 'public'\n            ORDER BY table_name;\n        "))
        tables = [row[0] for row in result]
        print(f' Доступные таблицы ({len(tables)}):')
        for table in tables:
            print(f'Text cleaned.{table}')
        print('\n' + '=' * 60)
        print("Введите SQL запрос (или 'exit' для выхода)")
        print('Примеры:')
        print('  SELECT * FROM users LIMIT 5;')
        print('  SELECT * FROM bot_tokens;')
        print('  SELECT COUNT(*) FROM chat_messages;')
        print('=' * 60 + '\n')
        while True:
            try:
                query = input('SQL> ').strip()
                if query.lower() in ['exit', 'quit', 'q']:
                    print('\n До свидания!')
                    break
                if not query:
                    continue
                result = db.execute(text(query))
                if query.lower().startswith('select'):
                    rows = result.fetchall()
                    if not rows:
                        print('  (нет результатов)\n')
                        continue
                    headers = result.keys()
                    print('\n' + ' | '.join(headers))
                    print('-' * 60)
                    for row in rows:
                        print(' | '.join((str(val) for val in row)))
                    print(f'\n Найдено строк: {len(rows)}\n')
                else:
                    db.commit()
                    print(' Запрос выполнен успешно\n')
            except KeyboardInterrupt:
                print('\n\n До свидания!')
                break
            except Exception as e:
                print(f'[ERROR] Ошибка: {e}\n')
if __name__ == '__main__':
    main()
