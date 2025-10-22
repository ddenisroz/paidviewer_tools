import sqlite3

print("Clearing user data from database...")

conn = sqlite3.connect('data/app_data.db')
cursor = conn.cursor()

# Clear all user-related tables
tables_to_clear = [
    'users',
    'user_tokens', 
    'user_sessions',
    'user_settings',
    'tts_user_settings',
    'audio_settings'
]

for table in tables_to_clear:
    try:
        cursor.execute(f'DELETE FROM {table}')
        count = cursor.rowcount
        print(f"  ✅ Cleared {table}: {count} rows deleted")
    except Exception as e:
        print(f"  ⚠️  Could not clear {table}: {e}")

conn.commit()
conn.close()

print("\n✅ Database cleared! User data removed.")
print("   Next server restart will start with a clean slate.")

