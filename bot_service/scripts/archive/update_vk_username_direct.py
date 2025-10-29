"""
Прямое обновление vk_username в базе данных
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import get_db, User
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_vk_username():
    """Обновляет vk_username напрямую в базе данных"""
    db = next(get_db())
    
    try:
        # Находим пользователя с VK username "Zavtra_Zavod"
        user = db.query(User).filter(User.id == 1).first()
        
        if not user:
            logger.error("❌ User с id=1 не найден")
            return
        
        logger.info(f"📊 Текущий vk_username: {user.vk_username}")
        
        if user.vk_username == "Zavtra_Zavod":
            # Обновляем на правильное значение из channel.url
            user.vk_username = "yourchy"
            db.commit()
            logger.info(f"✅ Обновлено: Zavtra_Zavod → yourchy")
        else:
            logger.info(f"ℹ️ vk_username уже корректный: {user.vk_username}")
        
        logger.info("\n✅ Обновление завершено!")
        
    except Exception as e:
        logger.error(f"❌ Критическая ошибка: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_vk_username()


