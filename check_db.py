import sqlite3

conn = sqlite3.connect('bot_service/data/app_data.db')
cursor = conn.cursor()

# Проверяем таблицы
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Таблицы в БД:")
for table in tables:
    print(f"- {table[0]}")

# Проверяем колонки users
if ('users',) in tables:
    cursor.execute("PRAGMA table_info(users)")
    columns = cursor.fetchall()
    print("\nКолонки в таблице users:")
    for col in columns:
        print(f"{col[1]} - {col[2]}")
else:
    print("\nТаблица users не найдена!")

conn.close()
