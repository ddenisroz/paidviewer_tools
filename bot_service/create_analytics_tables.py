#!/usr/bin/env python3
"""
Скрипт для создания новых таблиц аналитики
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def create_tables():
    try:
        from sqlalchemy import create_engine, text
        from core.database import DATABASE_URL
        
        engine = create_engine(DATABASE_URL)
        
        # SQL для создания таблицы пиков
        create_stream_peaks_sql = """
        CREATE TABLE IF NOT EXISTS stream_peaks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            platform VARCHAR NOT NULL,
            channel_name VARCHAR NOT NULL,
            peak_viewers INTEGER NOT NULL,
            peak_time DATETIME NOT NULL,
            stream_session_id VARCHAR,
            category_name VARCHAR,
            title VARCHAR,
            peak_type VARCHAR NOT NULL DEFAULT 'stream',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            date_key VARCHAR NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        """
        
        # SQL для создания индексов
        create_indexes_sql = """
        CREATE INDEX IF NOT EXISTS idx_stream_peaks_user_id ON stream_peaks(user_id);
        CREATE INDEX IF NOT EXISTS idx_stream_peaks_platform ON stream_peaks(platform);
        CREATE INDEX IF NOT EXISTS idx_stream_peaks_channel_name ON stream_peaks(channel_name);
        CREATE INDEX IF NOT EXISTS idx_stream_peaks_peak_type ON stream_peaks(peak_type);
        CREATE INDEX IF NOT EXISTS idx_stream_peaks_date_key ON stream_peaks(date_key);
        CREATE INDEX IF NOT EXISTS idx_stream_peaks_stream_session_id ON stream_peaks(stream_session_id);
        CREATE INDEX IF NOT EXISTS idx_stream_peaks_created_at ON stream_peaks(created_at);
        """
        
        # Добавляем новые колонки в stream_data если их нет
        alter_stream_data_sql = """
        ALTER TABLE stream_data ADD COLUMN title VARCHAR;
        ALTER TABLE stream_data ADD COLUMN is_live BOOLEAN DEFAULT 1;
        """
        
        with engine.connect() as conn:
            # Создаем таблицу пиков
            print("Creating stream_peaks table...")
            conn.execute(text(create_stream_peaks_sql))
            
            # Создаем индексы
            print("Creating indexes...")
            for sql in create_indexes_sql.split(';'):
                if sql.strip():
                    conn.execute(text(sql))
            
            # Добавляем новые колонки (может вылететь с ошибкой если уже есть - это нормально)
            print("Adding new columns to stream_data...")
            try:
                conn.execute(text("ALTER TABLE stream_data ADD COLUMN title VARCHAR;"))
            except Exception as e:
                print(f"Column 'title' already exists or error: {e}")
            
            try:
                conn.execute(text("ALTER TABLE stream_data ADD COLUMN is_live BOOLEAN DEFAULT 1;"))
            except Exception as e:
                print(f"Column 'is_live' already exists or error: {e}")
                
            conn.commit()
            
        print("✅ Analytics tables created successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

if __name__ == "__main__":
    create_tables()
