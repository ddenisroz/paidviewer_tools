import sqlite3
import os

# Определяем путь к базе данных
db_path = os.path.join(os.path.dirname(__file__), 'data', 'app_data.db')

def clean_database():
    """Очищает таблицы сессий, токенов и верификаций в базе данных."""
    
    # Таблицы для очистки
    tables_to_clean = [
        "user_sessions",
        "user_tokens",
        "vk_guest_verifications"
    ]
    
    print(f"Подключение к базе данных по пути: {db_path}")
    
    if not os.path.exists(db_path):
        print("Ошибка: Файл базы данных не найден!")
        return

    try:
        # Подключаемся к базе данных
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("\nНачинаем очистку таблиц...")
        
        for table in tables_to_clean:
            try:
                # Считаем количество записей до удаления
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count_before = cursor.fetchone()[0]
                
                # Выполняем удаление
                cursor.execute(f"DELETE FROM {table}")
                
                # Считаем количество записей после удаления
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count_after = cursor.fetchone()[0]
                
                print(f"- Таблица '{table}': удалено {count_before} записей. Осталось: {count_after}.")
                
            except sqlite3.OperationalError as e:
                print(f"- Ошибка при очистке таблицы '{table}': {e}")
        
        # Сохраняем изменения
        conn.commit()
        print("\nОчистка успешно завершена. Изменения сохранены.")
        
    except sqlite3.Error as e:
        print(f"\nПроизошла ошибка при работе с базой данных: {e}")
        
    finally:
        # Закрываем соединение
        if 'conn' in locals() and conn:
            conn.close()
            print("Соединение с базой данных закрыто.")

if __name__ == "__main__":
    clean_database()
