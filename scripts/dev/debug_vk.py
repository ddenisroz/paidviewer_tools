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
from sqlalchemy import desc

def debug_vk_status():
    db = SessionLocal()
    try:
        # Find the user manually or get the last one
        user = db.query(User).filter(User.twitch_username == 'payedviewer').first()
        if not user:
            user = db.query(User).order_by(desc(User.created_at)).first()
            
        if not user:
            print("No users found")
            return

        print(f"User (ID: {user.id})")
        print(f"  Twitch Username: {user.twitch_username}")
        print(f"  VK Username: {user.vk_username}")
        print(f"  VK Channel Name (on User): {user.vk_channel_name}")
        print(f"  TTS Enabled: {user.tts_enabled}")

        # Check tokens
        tokens = db.query(UserToken).filter_by(user_id=user.id).all()
        print(f"Total tokens for user: {len(tokens)}")
        for t in tokens:
            print(f"  Platform: {t.platform}")
            print(f"    Platform User ID: {t.platform_user_id}")
            print(f"    Enabled: {t.enabled if hasattr(t, 'enabled') else 'N/A'}")
            print(f"    Is Active: {t.is_active}")
            if t.platform == 'vk':
                print(f"    VK Access Token (partial): {t.access_token[:10]}...")
                print(f"    VK Refresh Token: {'Exists' if t.refresh_token else 'None'}")
                print(f"    Expires At: {t.expires_at}")

        # Check UserSettings for vk_channel_name
        from models.user import UserSettings
        settings = db.query(UserSettings).filter_by(user_id=user.id).first()
        if settings:
             print(f"  UserSettings VK Channel Name: {settings.vk_channel_name}")
             print(f"  UserSettings Channel Name: {settings.channel_name}")

    finally:
        db.close()

if __name__ == "__main__":
    debug_vk_status()
