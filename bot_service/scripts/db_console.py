#!/usr/bin/env python
"""Интерактивная SQL-консоль для текущей БД проекта."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text

BOT_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(BOT_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(BOT_SERVICE_ROOT))

load_dotenv(BOT_SERVICE_ROOT / '.env')

from core.database import db_session  # noqa: E402


def main() -> None:
    print('\n' + '=' * 64)
    print('КОНСОЛЬ БАЗЫ ДАННЫХ')
    print('=' * 64)

    with db_session() as db:
        print('Подключение установлено.\n')
        tables = db.execute(
            text(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
                """
            )
        ).fetchall()

        print(f'Доступные таблицы: {len(tables)}')
        for table in tables:
            print(f"- {table[0]}")

        print('\nВведите SQL-запрос или `exit` для выхода.')
        print('Примеры:')
        print('  SELECT * FROM users LIMIT 5;')
        print('  SELECT COUNT(*) FROM user_sessions;')
        print('  UPDATE users SET role = \'admin\' WHERE id = 1;')
        print()

        while True:
            try:
                query = input('SQL> ').strip()
                if query.lower() in {'exit', 'quit', 'q'}:
                    print('\nВыход из консоли.')
                    break
                if not query:
                    continue

                result = db.execute(text(query))
                if query.lower().startswith('select'):
                    rows = result.fetchall()
                    if not rows:
                        print('(нет результатов)\n')
                        continue

                    headers = result.keys()
                    print('\n' + ' | '.join(headers))
                    print('-' * 80)
                    for row in rows:
                        print(' | '.join(str(value) for value in row))
                    print(f'\nНайдено строк: {len(rows)}\n')
                else:
                    db.commit()
                    print('Запрос выполнен успешно.\n')
            except KeyboardInterrupt:
                print('\n\nВыход из консоли.')
                break
            except Exception as exc:
                print(f'[ERROR] {exc}\n')


if __name__ == '__main__':
    main()
