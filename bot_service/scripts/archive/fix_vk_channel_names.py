"""
Скрипт для исправления VK username в базе данных.
Извлекает ник канала из channel.url вместо user.nick
"""
import sys
import os

# Добавляем путь к bot_service в sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import get_db, User, UserToken
import requests
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_vk_channel_names():
    """Обновляет vk_username для всех пользователей с VK Live токенами"""
    db = next(get_db())

    try:
        # Находим всех пользователей с VK токенами
        vk_tokens = db.query(UserToken).filter(UserToken.platform == 'vk').all()

        logger.info(f"[STATS] Найдено {len(vk_tokens)} VK токенов")

        for token in vk_tokens:
            try:
                user = db.query(User).filter(User.id == token.user_id).first()
                if not user:
                    logger.warning(f"[WARN] User {token.user_id} not found")
                    continue

                logger.info(f"\n[DEBUG] Проверяем пользователя: {user.id}")
                logger.info(f"   Текущий vk_username: {user.vk_username}")

                # Получаем информацию о канале через VK API
                headers = {"Authorization": f"Bearer {token.access_token}"}
                response = requests.get("https://api.live.vkvideo.ru/v1/current_user", headers=headers)

                if response.status_code == 200:
                    data = response.json()
                    if "data" in data:
                        channel_url = data["data"].get("channel", {}).get("url")
                        user_nick = data["data"].get("user", {}).get("nick")

                        logger.info(f"   channel.url: {channel_url}")
                        logger.info(f"   user.nick: {user_nick}")

                        if channel_url:
                            # Извлекаем ник канала из URL
                            channel_name = channel_url.rstrip('/').split('/')[-1]

                            if channel_name != user.vk_username:
                                logger.info(f"   [OK] Обновляем: {user.vk_username} → {channel_name}")
                                user.vk_username = channel_name
                                db.commit()
                            else:
                                logger.info(f"   [INFO] Ник канала уже корректный: {channel_name}")
                        else:
                            logger.warning("   [WARN] channel.url отсутствует в API ответе")
                    else:
                        logger.error(f"   [ERROR] Неожиданный формат ответа API: {data}")
                else:
                    logger.error(f"   [ERROR] API вернул {response.status_code}: {response.text}")

            except Exception as e:
                logger.error(f"[ERROR] Ошибка обработки токена {token.id}: {e}")
                continue

        logger.info("\n[OK] Обновление завершено!")

    except Exception as e:
        logger.error(f"[ERROR] Критическая ошибка: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_vk_channel_names()


