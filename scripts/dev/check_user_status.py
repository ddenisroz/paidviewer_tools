import sys
import os
from dotenv import load_dotenv

# Set base path
base_path = os.path.join(os.getcwd(), 'bot_service')
sys.path.append(base_path)

# Load .env from bot_service
load_dotenv(os.path.join(base_path, '.env'))

from core.database import SessionLocal, User
from sqlalchemy import desc

def check_users():
    db = SessionLocal()
    try:
        users = db.query(User).order_by(desc(User.created_at)).limit(5).all()
        print(f"Checking last {len(users)} users:")
        for u in users:
            print(f"ID: {u.id}, Username: {u.twitch_username or u.vk_username}, TTS Enabled: {u.tts_enabled}, Created At: {u.created_at}")
    finally:
        db.close()

if __name__ == "__main__":
    check_users()
