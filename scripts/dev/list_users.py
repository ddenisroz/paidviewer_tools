import sys
import os
from dotenv import load_dotenv

# Set base path
base_path = os.path.join(os.getcwd(), 'bot_service')
sys.path.append(base_path)

# Load .env from bot_service
load_dotenv(os.path.join(base_path, '.env'))

from core.database import SessionLocal, User
from models.user import UserToken

def list_all_users():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"Total users: {len(users)}")
        for u in users:
            tokens = db.query(UserToken).filter_by(user_id=u.id).all()
            platforms = [t.platform for t in tokens]
            print(f"ID: {u.id}, Twitch: {u.twitch_username}, VK: {u.vk_username}, Platforms: {platforms}")
    finally:
        db.close()

if __name__ == "__main__":
    list_all_users()
