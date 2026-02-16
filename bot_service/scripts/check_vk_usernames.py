"""
РЎРєСЂРёРїС‚ РґР»СЏ РїСЂРѕРІРµСЂРєРё VK username Сѓ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№.
РџРѕРєР°Р·С‹РІР°РµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ СЃ VK С‚РѕРєРµРЅР°РјРё Рё РёС… С‚РµРєСѓС‰РёРµ username.

[WARN] Р’РќРРњРђРќРР•: Р­С‚РѕС‚ СЃРєСЂРёРїС‚ Р±РѕР»СЊС€Рµ РќР• СѓСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ fallback username!
VK Live API РІРѕР·РІСЂР°С‰Р°РµС‚ РїСЂР°РІРёР»СЊРЅС‹Р№ username РІ РїРѕР»Рµ "nick".
Р•СЃР»Рё Сѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ username = 'vk{id}', РµРјСѓ РЅСѓР¶РЅРѕ РџР•Р Р•РђР’РўРћР РР—РћР’РђРўР¬РЎРЇ С‡РµСЂРµР· VK Live.
"""
import sys
from pathlib import Path

# Р”РѕР±Р°РІР»СЏРµРј РєРѕСЂРµРЅСЊ РїСЂРѕРµРєС‚Р° РІ PYTHONPATH
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.database import get_db, User, UserToken
from sqlalchemy.orm import Session
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_vk_usernames():
    """РџСЂРѕРІРµСЂСЏРµС‚ vk_username РґР»СЏ РІСЃРµС… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ СЃ VK С‚РѕРєРµРЅР°РјРё"""
    db: Session = next(get_db())
    
    try:
        # РќР°Р№С‚Рё РІСЃРµС… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ СЃ VK С‚РѕРєРµРЅР°РјРё
        vk_tokens = db.query(UserToken).filter(
            UserToken.platform == 'vk',
            UserToken.access_token.isnot(None)
        ).all()
        
        logger.info(f"[DEBUG] Found {len(vk_tokens)} VK tokens")
        
        # [OK] PERFORMANCE: Р—Р°РіСЂСѓР¶Р°РµРј РІСЃРµС… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РѕРґРЅРёРј Р·Р°РїСЂРѕСЃРѕРј (РёР·Р±РµРіР°РµРј N+1)
        user_ids = [token.user_id for token in vk_tokens]
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        users_dict = {user.id: user for user in users}
        
        needs_reauth = []
        for token in vk_tokens:
            user = users_dict.get(token.user_id)
            
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
            logger.warning(f"VK Live API now returns correct username in 'nick' field.")
            logger.warning(f"After reauthorization, username will be correct (e.g., 'yourchy').")
            logger.warning(f"{'='*60}\n")
        else:
            logger.info(f"\n[OK] All users have valid VK usernames!")
        
    except Exception as e:
        logger.error(f"[ERROR] Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("=== Checking VK usernames ===")
    check_vk_usernames()
    logger.info("=== Check completed ===")

