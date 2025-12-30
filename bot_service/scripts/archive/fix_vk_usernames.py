"""
Скрипт для проверки VK username у существующих пользователей.
Показывает пользователей с VK токенами и их текущие username.

[WARN] ВНИМАНИЕ: Этот скрипт больше НЕ устанавливает fallback username!
VK Live API возвращает правильный username в поле "nick".
Если у пользователя username = 'vk{id}', ему нужно ПЕРЕАВТОРИЗОВАТЬСЯ через VK Live.
"""
import sys
from pathlib import Path

# Добавляем корень проекта в PYTHONPATH
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.database import get_db, User, UserToken
from sqlalchemy.orm import Session
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_vk_usernames():
    """Проверяет vk_username для всех пользователей с VK токенами"""
    db: Session = next(get_db())

    try:
        # Найти всех пользователей с VK токенами
        vk_tokens = db.query(UserToken).filter(
            UserToken.platform == 'vk',
            UserToken.access_token.isnot(None)
        ).all()

        logger.info(f"[DEBUG] Found {len(vk_tokens)} VK tokens")

        needs_reauth = []
        for token in vk_tokens:
            user = db.query(User).filter(User.id == token.user_id).first()

            if user:
                if not user.vk_username:
                    logger.warning(f"[WARN] User {user.id}: No vk_username (NEEDS REAUTH)")
                    needs_reauth.append(user.id)
                elif user.vk_username.startswith('vk') and user.vk_username[2:].isdigit():
                    logger.warning(f"[WARN] User {user.id}: Has fallback username '{user.vk_username}' (NEEDS REAUTH)")
                    needs_reauth.append(user.id)
                else:
                    logger.info(f"[OK] User {user.id}: Has valid vk_username '{user.vk_username}'")

        if needs_reauth:
            logger.warning(f"\n{'='*60}")
            logger.warning(f"[WARN] {len(needs_reauth)} users need to RE-AUTHORIZE via VK Live!")
            logger.warning(f"User IDs: {needs_reauth}")
            logger.warning("VK Live API now returns correct username in 'nick' field.")
            logger.warning("After reauthorization, username will be correct (e.g., 'yourchy').")
            logger.warning(f"{'='*60}\n")
        else:
            logger.info("\n[OK] All users have valid VK usernames!")

    except Exception as e:
        logger.error(f"[ERROR] Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("=== Checking VK usernames ===")
    check_vk_usernames()
    logger.info("=== Check completed ===")

