import sqlite3
import os

# Путь к базе данных относительно скрипта
DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'app_data.db')

def clean_vk_tokens():
    """
    Удаляет все записи из таблицы user_tokens, где platform = 'vk'.
    """
    try:
        print(f"Подключение к базе данных по пути: {DB_PATH}")
        if not os.path.exists(DB_PATH):
            print("Файл базы данных не найден. Очистка не требуется.")
            return

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        table_to_clean = 'user_tokens'
        platform_to_clean = 'vk'

        cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_to_clean}';")
        if cursor.fetchone() is None:
            print(f"Таблица '{table_to_clean}' не существует. Очистка не требуется.")
            conn.close()
            return
            
        cursor.execute(f"SELECT COUNT(*) FROM {table_to_clean} WHERE platform = ?", (platform_to_clean,))
        count_before = cursor.fetchone()[0]
        print(f"Найдено {count_before} токенов VK для удаления в таблице '{table_to_clean}'.")

        if count_before > 0:
            cursor.execute(f"DELETE FROM {table_to_clean} WHERE platform = ?", (platform_to_clean,))
            conn.commit()
            print(f"Успешно удалено {count_before} токенов VK.")
        
        cursor.execute(f"SELECT COUNT(*) FROM {table_to_clean} WHERE platform = ?", (platform_to_clean,))
        count_after = cursor.fetchone()[0]
        print(f"Проверка: осталось {count_after} токенов VK в таблице '{table_to_clean}'.")

        conn.close()
        print("Соединение с базой данных закрыто.")

    except sqlite3.Error as e:
        print(f"Ошибка базы данных: {e}")
    except Exception as e:
        print(f"Произошла ошибка: {e}")

if __name__ == "__main__":
    clean_vk_tokens()
