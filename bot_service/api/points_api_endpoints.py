# bot_service/api/points_api_endpoints.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging

from core.database import get_db
from services.points_service import PointsService

logger = logging.getLogger('bot_service')

# Создаем роутер для Points API
points_router = APIRouter(prefix="/api/points", tags=["points"])

# Вспомогательная функция для получения имени VK канала
def _get_vk_channel_name(user_id: int, db: Session) -> str:
    """Получить имя VK канала из таблицы User (не UserSettings!)"""
    from core.database import User
    user_record = db.query(User).filter(User.id == user_id).first()
    if not user_record or not user_record.vk_channel_name:
        raise HTTPException(status_code=404, detail="VK канал не настроен")
    return user_record.vk_channel_name

# Вспомогательная функция для расшифровки токена
def _decrypt_access_token(encrypted_token: str) -> str:
    """Расшифровать access_token перед отправкой в API"""
    from core.token_encryption import decrypt_token
    return decrypt_token(encrypted_token)

# Pydantic модели для API
class AddPointsRequest(BaseModel):
    viewer_id: str
    viewer_name: str
    platform: str
    channel_name: str
    amount: int
    reason: Optional[str] = "Manual add"

class DeductPointsRequest(BaseModel):
    viewer_id: str
    viewer_name: str
    platform: str
    channel_name: str
    amount: int
    reason: Optional[str] = "Manual deduct"

class CreateRewardRequest(BaseModel):
    platform: str
    channel_name: str
    title: str
    description: str
    cost: int
    icon_url: Optional[str] = None
    background_color: Optional[str] = "#3B82F6"
    is_user_input_required: Optional[bool] = False
    max_per_stream: Optional[int] = None
    max_per_user_per_stream: Optional[int] = None
    prompt: Optional[str] = None
    reward_type: Optional[str] = "custom"

class RedeemRewardRequest(BaseModel):
    reward_id: int
    viewer_id: str
    viewer_name: str
    platform: str
    channel_name: str
    user_input: Optional[str] = None

class ProcessRewardRequest(BaseModel):
    queue_id: int
    action: str  # approve, reject, fulfill
    moderator_note: Optional[str] = None

# Инициализируем сервис
points_service = PointsService()

# Импортируем правильную аутентификацию
from auth.auth import get_current_user

# Создаем singleton для PointsService
points_service = PointsService()

# ============================================================================
# PLATFORM-SPECIFIC REWARD ENDPOINTS
# ============================================================================

@points_router.get("/rewards/twitch")
async def get_twitch_rewards(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить награды Twitch канала"""
    try:
        from api.twitch_api import TwitchAPI
        from core.connection_manager import get_connection_manager
        from core.database import User, UserToken
        
        logger.info(f"🎮 [TWITCH REWARDS] Fetching rewards for user {user['id']}")
        
        # Получаем токены пользователя
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == "twitch"
        ).first()
        
        if not user_token:
            logger.warning(f"❌ [TWITCH REWARDS] Token not found for user {user['id']}")
            raise HTTPException(status_code=404, detail="Твич токен не найден. Пожалуйста, авторизуйтесь")
        
        # Получаем Twitch user ID
        db_user = db.query(User).filter(User.id == user["id"]).first()
        if not db_user or not db_user.twitch_user_id:
            logger.warning(f"❌ [TWITCH REWARDS] Twitch ID not found for user {user['id']}")
            raise HTTPException(status_code=404, detail="Twitch user ID не найден")
        
        # Используем Twitch API для получения наград
        connection_manager = get_connection_manager()
        twitch_api = TwitchAPI(connection_manager)
        
        # Расшифровываем токен перед использованием
        decrypted_token = _decrypt_access_token(user_token.access_token)
        
        rewards = await twitch_api.get_custom_rewards(
            db_user.twitch_user_id,
            decrypted_token,
            only_manageable=True
        )
        
        if rewards is None:
            logger.warning(f"❌ [TWITCH REWARDS] Failed to fetch rewards from Twitch API")
            raise HTTPException(status_code=400, detail="Не удалось получить награды от Twitch")
        
        logger.info(f"✅ [TWITCH REWARDS] Fetched {len(rewards)} rewards for user {user['id']}")
        from fastapi.responses import JSONResponse
        return JSONResponse(content={
            "success": True,
            "platform": "twitch",
            "rewards": rewards
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [TWITCH REWARDS] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения наград Twitch: {str(e)}")

@points_router.get("/rewards/vk")
async def get_vk_rewards(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить награды VK канала"""
    try:
        from api.vk_api import vk_api
        from core.database import User, UserToken
        
        logger.info(f"📺 [VK REWARDS] Fetching rewards for user {user['id']}")
        
        # Сначала проверяем наличие VK токена (обязательно для управления наградами)
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == "vk"
        ).first()
        
        if not user_token:
            logger.warning(f"❌ [VK REWARDS] VK token not found for user {user['id']}")
            raise HTTPException(status_code=404, detail="VK Live не подключен. Авторизуйтесь через настройки")
        
        # Получаем имя VK канала (VK API ожидает только имя, а не полный URL!)
        channel_name = _get_vk_channel_name(user["id"], db)
        logger.info(f"📺 [VK REWARDS] Using channel name: {channel_name}")
        
        # Расшифровываем токен перед использованием
        decrypted_token = _decrypt_access_token(user_token.access_token)
        
        # Получаем список наград для управления
        rewards = await vk_api.get_rewards_manage_info(
            channel_name,
            decrypted_token
        )
        
        if rewards is None:
            logger.warning(f"❌ [VK REWARDS] Failed to fetch rewards from VK API")
            raise HTTPException(status_code=400, detail="Не удалось получить награды от VK")
        
        logger.info(f"✅ [VK REWARDS] Fetched {len(rewards)} rewards for user {user['id']}")
        from fastapi.responses import JSONResponse
        return JSONResponse(content={
            "success": True,
            "platform": "vk",
            "rewards": rewards
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [VK REWARDS] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения наград VK: {str(e)}")

@points_router.post("/rewards/twitch/create")
async def create_twitch_reward(
    reward_data: CreateRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать награду на Twitch"""
    try:
        from api.twitch_api import TwitchAPI
        from core.connection_manager import get_connection_manager
        from core.database import User, UserToken
        
        # Получаем токены пользователя
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == "twitch"
        ).first()
        
        if not user_token:
            raise HTTPException(status_code=404, detail="Твич токен не найден. Пожалуйста, авторизуйтесь")
        
        # Получаем Twitch user ID
        db_user = db.query(User).filter(User.id == user["id"]).first()
        if not db_user or not db_user.twitch_username:
            raise HTTPException(status_code=404, detail="Twitch username не найден")
        
        # Используем Twitch API для создания награды
        connection_manager = get_connection_manager()
        twitch_api = TwitchAPI(connection_manager)
        
        result = await twitch_api.create_custom_reward(
            user_id=user["id"],
            access_token=_decrypt_access_token(user_token.access_token),
            title=reward_data.title,
            description=reward_data.description,
            cost=reward_data.cost,
            icon_url=reward_data.icon_url,
            background_color=reward_data.background_color,
            is_user_input_required=reward_data.is_user_input_required,
            max_per_stream=reward_data.max_per_stream,
            max_per_user_per_stream=reward_data.max_per_user_per_stream,
            prompt=reward_data.prompt
        )
        
        if result.get("success"):
            return {
                "success": True,
                "platform": "twitch",
                "reward": result.get("reward")
            }
        else:
            raise HTTPException(status_code=400, detail=result.get("error", "Ошибка создания награды"))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating Twitch reward: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка создания награды Twitch: {str(e)}")

@points_router.post("/rewards/vk/create")
async def create_vk_reward(
    reward_data: CreateRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать награду на VK Live"""
    try:
        from api.vk_api import vk_api
        from core.database import UserToken
        
        # Получаем токены пользователя
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == "vk"
        ).first()
        
        if not user_token:
            raise HTTPException(status_code=404, detail="VK Live токен не найден. Пожалуйста, авторизуйтесь")
        
        # Получаем имя VK канала
        channel_name = _get_vk_channel_name(user["id"], db)
        
        # Prepare reward data structure for VK API
        reward_data = {
            "name": reward_data.title,
            "description": reward_data.description,
            "cost": reward_data.cost,
            "icon_url": reward_data.icon_url,
            "background_color": reward_data.background_color
        }
        
        # Используем VK API для создания награды
        result = await vk_api.create_channel_reward(
            channel_url=channel_name,
            access_token=_decrypt_access_token(user_token.access_token),
            reward_data=reward_data
        )
        
        if result:
            return {
                "success": True,
                "platform": "vk",
                "reward": result
            }
        else:
            raise HTTPException(status_code=400, detail="Ошибка создания награды на VK Live API")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating VK reward: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка создания награды VK: {str(e)}")

@points_router.patch("/rewards/twitch/{reward_id}/update")
async def update_twitch_reward(
    reward_id: str,
    reward_data: CreateRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить награду на Twitch"""
    try:
        from api.twitch_api import TwitchAPI
        from core.connection_manager import get_connection_manager
        from core.database import User, UserToken
        
        # Получаем токены пользователя
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == "twitch"
        ).first()
        
        if not user_token:
            raise HTTPException(status_code=404, detail="Твич токен не найден")
        
        # Получаем Twitch user ID
        db_user = db.query(User).filter(User.id == user["id"]).first()
        if not db_user or not db_user.twitch_user_id:
            raise HTTPException(status_code=404, detail="Twitch user ID не найден")
        
        # Используем Twitch API для обновления награды
        connection_manager = get_connection_manager()
        twitch_api = TwitchAPI(connection_manager)
        
        result = await twitch_api.update_custom_reward(
            broadcaster_id=str(db_user.twitch_user_id),
            reward_id=reward_id,
            access_token=_decrypt_access_token(user_token.access_token),
            title=reward_data.title,
            description=reward_data.description,
            cost=reward_data.cost,
            background_color=reward_data.background_color,
            is_user_input_required=reward_data.is_user_input_required,
            max_per_stream=reward_data.max_per_stream,
            max_per_user_per_stream=reward_data.max_per_user_per_stream,
            prompt=reward_data.prompt
        )
        
        if result:
            from fastapi.responses import JSONResponse
            return JSONResponse(content={
                "success": True,
                "platform": "twitch",
                "reward": result
            })
        else:
            raise HTTPException(status_code=400, detail="Ошибка обновления награды")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating Twitch reward: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка обновления награды Twitch: {str(e)}")

@points_router.delete("/rewards/twitch/{reward_id}/delete")
async def delete_twitch_reward(
    reward_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить награду на Twitch"""
    try:
        from api.twitch_api import TwitchAPI
        from core.connection_manager import get_connection_manager
        from core.database import User, UserToken
        
        # Получаем токены пользователя
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == "twitch"
        ).first()
        
        if not user_token:
            raise HTTPException(status_code=404, detail="Твич токен не найден")
        
        # Получаем Twitch user ID
        db_user = db.query(User).filter(User.id == user["id"]).first()
        if not db_user or not db_user.twitch_user_id:
            raise HTTPException(status_code=404, detail="Twitch user ID не найден")
        
        # Используем Twitch API для удаления награды
        connection_manager = get_connection_manager()
        twitch_api = TwitchAPI(connection_manager)
        
        result = await twitch_api.delete_custom_reward(
            broadcaster_id=str(db_user.twitch_user_id),
            reward_id=reward_id,
            access_token=_decrypt_access_token(user_token.access_token)
        )
        
        if result:
            from fastapi.responses import JSONResponse
            return JSONResponse(content={
                "success": True,
                "platform": "twitch",
                "message": "Награда удалена"
            })
        else:
            raise HTTPException(status_code=400, detail="Ошибка удаления награды")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting Twitch reward: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка удаления награды Twitch: {str(e)}")

@points_router.patch("/rewards/vk/{reward_id}/update")
async def update_vk_reward(
    reward_id: str,
    reward_data: CreateRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить награду на VK Live"""
    try:
        from api.vk_api import vk_api
        from core.database import UserToken
        
        # Получаем токены пользователя
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == "vk"
        ).first()
        
        if not user_token:
            raise HTTPException(status_code=404, detail="VK Live токен не найден")
        
        # Получаем имя VK канала
        channel_name = _get_vk_channel_name(user["id"], db)
        
        # Prepare reward data structure for VK API
        vk_reward_data = {
            "name": reward_data.title,
            "description": reward_data.description,
            "cost": reward_data.cost,
        }
        
        # Используем VK API для обновления награды
        result = await vk_api.update_channel_reward(
            channel_url=channel_name,
            reward_id=reward_id,
            access_token=_decrypt_access_token(user_token.access_token),
            reward_data=vk_reward_data
        )
        
        if result:
            from fastapi.responses import JSONResponse
            return JSONResponse(content={
                "success": True,
                "platform": "vk",
                "reward": result
            })
        else:
            raise HTTPException(status_code=400, detail="Ошибка обновления награды на VK Live API")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating VK reward: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка обновления награды VK: {str(e)}")

@points_router.delete("/rewards/vk/{reward_id}/delete")
async def delete_vk_reward(
    reward_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить награду на VK Live"""
    try:
        from api.vk_api import vk_api
        from core.database import UserToken
        
        # Получаем токены пользователя
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == "vk"
        ).first()
        
        if not user_token:
            raise HTTPException(status_code=404, detail="VK Live токен не найден")
        
        # Получаем имя VK канала
        channel_name = _get_vk_channel_name(user["id"], db)
        
        # Используем VK API для удаления награды
        result = await vk_api.delete_channel_reward(
            channel_url=channel_name,
            reward_id=reward_id,
            access_token=_decrypt_access_token(user_token.access_token)
        )
        
        if result:
            from fastapi.responses import JSONResponse
            return JSONResponse(content={
                "success": True,
                "platform": "vk",
                "message": "Награда удалена"
            })
        else:
            raise HTTPException(status_code=400, detail="Ошибка удаления награды на VK Live API")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting VK reward: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка удаления награды VK: {str(e)}")

class ToggleRewardRequest(BaseModel):
    is_enabled: bool

@points_router.patch("/rewards/vk/{reward_id}/toggle")
async def toggle_vk_reward(
    reward_id: str,
    request: ToggleRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Включить/выключить награду на VK Live"""
    try:
        from api.vk_api import vk_api
        from core.database import UserToken
        
        # Получаем токены пользователя
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == "vk"
        ).first()
        
        if not user_token:
            raise HTTPException(status_code=404, detail="VK Live токен не найден")
        
        # Получаем имя VK канала
        channel_name = _get_vk_channel_name(user["id"], db)
        
        # Используем VK API для включения/выключения награды
        if request.is_enabled:
            result = await vk_api.enable_channel_reward(
                channel_url=channel_name,
                reward_id=reward_id,
                access_token=_decrypt_access_token(user_token.access_token)
            )
        else:
            result = await vk_api.disable_channel_reward(
                channel_url=channel_name,
                reward_id=reward_id,
                access_token=_decrypt_access_token(user_token.access_token)
            )
        
        if result:
            from fastapi.responses import JSONResponse
            return JSONResponse(content={
                "success": True,
                "platform": "vk",
                "is_enabled": request.is_enabled,
                "message": f"Награда {'включена' if request.is_enabled else 'выключена'}"
            })
        else:
            raise HTTPException(status_code=400, detail="Ошибка переключения награды на VK Live API")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling VK reward: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка переключения награды VK: {str(e)}")

@points_router.get("/rewards/vk/demands")
async def get_vk_reward_demands(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список запросов наград VK Live"""
    try:
        from api.vk_api import vk_api
        from core.database import UserToken
        
        # Получаем токены пользователя
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == "vk"
        ).first()
        
        if not user_token:
            raise HTTPException(status_code=404, detail="VK Live токен не найден")
        
        # Получаем имя VK канала
        channel_name = _get_vk_channel_name(user["id"], db)
        
        # Получаем запросы наград
        demands = await vk_api.get_reward_demands(
            channel_url=channel_name,
            access_token=_decrypt_access_token(user_token.access_token)
        )
        
        if demands is not None:
            from fastapi.responses import JSONResponse
            return JSONResponse(content={
                "success": True,
                "platform": "vk",
                "demands": demands
            })
        else:
            raise HTTPException(status_code=400, detail="Ошибка получения запросов наград")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting VK reward demands: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения запросов наград VK: {str(e)}")

class ProcessVKDemandsRequest(BaseModel):
    demand_ids: List[int]
    action: str  # 'accept' or 'reject'

@points_router.post("/rewards/vk/demands/process")
async def process_vk_reward_demands(
    request: ProcessVKDemandsRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обработать запросы наград VK Live (принять/отклонить)"""
    try:
        from api.vk_api import vk_api
        from core.database import UserToken
        
        # Получаем токены пользователя
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == "vk"
        ).first()
        
        if not user_token:
            raise HTTPException(status_code=404, detail="VK Live токен не найден")
        
        # Получаем имя VK канала
        channel_name = _get_vk_channel_name(user["id"], db)
        
        # Обрабатываем запросы
        if request.action == 'accept':
            result = await vk_api.accept_reward_demands(
                channel_url=channel_name,
                access_token=_decrypt_access_token(user_token.access_token),
                demand_ids=request.demand_ids
            )
        elif request.action == 'reject':
            result = await vk_api.reject_reward_demands(
                channel_url=channel_name,
                access_token=_decrypt_access_token(user_token.access_token),
                demand_ids=request.demand_ids
            )
        else:
            raise HTTPException(status_code=400, detail="Неверное действие (action)")
        
        if result:
            from fastapi.responses import JSONResponse
            return JSONResponse(content={
                "success": True,
                "platform": "vk",
                "action": request.action,
                "processed_count": len(request.demand_ids),
                "message": f"Запросы {'приняты' if request.action == 'accept' else 'отклонены'}"
            })
        else:
            raise HTTPException(status_code=400, detail="Ошибка обработки запросов наград")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing VK reward demands: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка обработки запросов наград VK: {str(e)}")

# ============================================================================
# EXISTING REWARD ENDPOINTS
# ============================================================================

@points_router.get("/rewards")
async def get_rewards(
    platform: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение наград канала"""
    try:
        rewards = points_service.get_channel_rewards(user["id"], platform, db)
        
        return {
            "success": True,
            "rewards": rewards
        }
        
    except Exception as e:
        logger.error(f"Error getting rewards: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения наград")

@points_router.post("/rewards/redeem")
async def redeem_reward(
    request: RedeemRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обмен награды за баллы"""
    try:
        result = points_service.redeem_reward(
            user["id"],
            request.reward_id,
            request.viewer_id,
            request.viewer_name,
            request.platform,
            request.channel_name,
            request.user_input
        )
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error redeeming reward: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обмена награды")

@points_router.get("/rewards/queue")
async def get_reward_queue(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение очереди наград"""
    try:
        queue = points_service.get_reward_queue(user["id"], status, db)
        
        return {
            "success": True,
            "queue": queue
        }
        
    except Exception as e:
        logger.error(f"Error getting reward queue: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения очереди наград")

@points_router.post("/rewards/process")
async def process_reward(
    request: ProcessRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обработка награды модератором"""
    try:
        result = points_service.process_reward(
            user["id"],
            request.queue_id,
            request.action,
            request.moderator_note
        )
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing reward: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обработки награды")

# === ПЛАТФОРМЕННЫЕ API (TWITCH / VK LIVE) ===

@points_router.get("/platform/rewards")
async def get_platform_rewards(
    platform: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить награды напрямую с платформы (Twitch или VK Live)"""
    try:
        from api.twitch_api import twitch_api
        from api.vk_api import vk_api
        from core.database import UserToken
        
        # Получаем токен пользователя
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == platform.lower()
        ).first()
        
        if not user_token:
            raise HTTPException(status_code=404, detail=f"Токен для платформы {platform} не найден")
        
        rewards = None
        if platform.lower() == "twitch":
            # Получаем Twitch broadcaster_id
            from core.database import User
            db_user = db.query(User).filter(User.id == user["id"]).first()
            if not db_user or not db_user.twitch_user_id:
                raise HTTPException(status_code=404, detail="Twitch user ID не найден")
            
            rewards = await twitch_api.get_custom_rewards(
                db_user.twitch_user_id,
                user_token.access_token,
                only_manageable=True
            )
        
        elif platform.lower() == "vk":
            # Получаем имя VK канала
            channel_name = _get_vk_channel_name(user["id"], db)
            
            # Get channel rewards from VK Live API
            rewards = await vk_api.get_channel_rewards(
                channel_name,
                user_token.access_token
            )
        
        if rewards is None:
            raise HTTPException(status_code=500, detail="Ошибка получения использований")
        
        return {
            "success": True,
            "platform": platform,
            "rewards": rewards
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting platform rewards: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@points_router.post("/platform/rewards/create")
async def create_platform_reward(
    platform: str,
    reward_data: dict,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать награду на платформе (Twitch или VK Live)"""
    try:
        from api.twitch_api import twitch_api
        from api.vk_api import vk_api
        from core.database import UserToken
        
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == platform.lower()
        ).first()
        
        if not user_token:
            raise HTTPException(status_code=404, detail=f"Токен для платформы {platform} не найден")
        
        result = None
        if platform.lower() == "twitch":
            from core.database import User
            db_user = db.query(User).filter(User.id == user["id"]).first()
            if not db_user or not db_user.twitch_user_id:
                raise HTTPException(status_code=404, detail="Twitch user ID не найден")
            
            result = await twitch_api.create_custom_reward(
                db_user.twitch_user_id,
                user_token.access_token,
                reward_data
            )
        
        elif platform.lower() == "vk":
            # Получаем имя VK канала
            channel_name = _get_vk_channel_name(user["id"], db)
            
            result = await vk_api.create_channel_reward(
                channel_name,
                user_token.access_token,
                reward_data
            )
        
        if result is None:
            raise HTTPException(status_code=500, detail="Ошибка создания награды на платформе")
        
        return {
            "success": True,
            "platform": platform,
            "reward": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating platform reward: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@points_router.delete("/platform/rewards/{reward_id}")
async def delete_platform_reward(
    platform: str,
    reward_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить награду на платформе"""
    try:
        from api.twitch_api import twitch_api
        from api.vk_api import vk_api
        from core.database import UserToken
        
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == platform.lower()
        ).first()
        
        if not user_token:
            raise HTTPException(status_code=404, detail=f"Токен для платформы {platform} не найден")
        
        success = False
        if platform.lower() == "twitch":
            from core.database import User
            db_user = db.query(User).filter(User.id == user["id"]).first()
            if not db_user or not db_user.twitch_user_id:
                raise HTTPException(status_code=404, detail="Twitch user ID не найден")
            
            success = await twitch_api.delete_custom_reward(
                db_user.twitch_user_id,
                reward_id,
                user_token.access_token
            )
        
        elif platform.lower() == "vk":
            # Получаем имя VK канала
            channel_name = _get_vk_channel_name(user["id"], db)
            
            success = await vk_api.delete_channel_reward(
                channel_name,
                reward_id,
                user_token.access_token
            )
        
        if not success:
            raise HTTPException(status_code=500, detail="Ошибка удаления награды")
        
        return {
            "success": True,
            "message": "Награда удалена"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting platform reward: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@points_router.get("/platform/redemptions")
async def get_platform_redemptions(
    platform: str,
    reward_id: str,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список использований награды с платформы"""
    try:
        from api.twitch_api import twitch_api
        from api.vk_api import vk_api
        from core.database import UserToken
        
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == platform.lower()
        ).first()
        
        if not user_token:
            raise HTTPException(status_code=404, detail=f"Токен для платформы {platform} не найден")
        
        redemptions = None
        if platform.lower() == "twitch":
            from core.database import User
            db_user = db.query(User).filter(User.id == user["id"]).first()
            if not db_user or not db_user.twitch_user_id:
                raise HTTPException(status_code=404, detail="Twitch user ID не найден")
            
            redemptions = await twitch_api.get_custom_reward_redemptions(
                db_user.twitch_user_id,
                reward_id,
                user_token.access_token,
                status=status
            )
        
        elif platform.lower() == "vk":
            # Получаем имя VK канала
            channel_name = _get_vk_channel_name(user["id"], db)
            
            redemptions = await vk_api.get_reward_demands(
                channel_name,
                user_token.access_token
            )
        
        if redemptions is None:
            raise HTTPException(status_code=500, detail="Ошибка получения использований")
        
        return {
            "success": True,
            "platform": platform,
            "redemptions": redemptions
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting platform redemptions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@points_router.patch("/platform/redemptions/{redemption_id}")
async def update_platform_redemption(
    platform: str,
    reward_id: str,
    redemption_id: str,
    status: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить статус использования награды (одобрить/отклонить)"""
    try:
        from api.twitch_api import twitch_api
        from api.vk_api import vk_api
        from core.database import UserToken
        
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user["id"],
            UserToken.platform == platform.lower()
        ).first()
        
        if not user_token:
            raise HTTPException(status_code=404, detail=f"Токен для платформы {platform} не найден")
        
        success = False
        if platform.lower() == "twitch":
            from core.database import User
            db_user = db.query(User).filter(User.id == user["id"]).first()
            if not db_user or not db_user.twitch_user_id:
                raise HTTPException(status_code=404, detail="Twitch user ID не найден")
            
            success = await twitch_api.update_redemption_status(
                db_user.twitch_user_id,
                reward_id,
                redemption_id,
                user_token.access_token,
                status  # FULFILLED or CANCELED
            )
        
        elif platform.lower() == "vk":
            # Получаем имя VK канала
            channel_name = _get_vk_channel_name(user["id"], db)
            
            # VK использует demand_ids (массив)
            demand_ids = [int(redemption_id)]
            if status.lower() == "fulfilled":
                success = await vk_api.accept_reward_demands(
                    channel_name,
                    user_token.access_token,
                    demand_ids
                )
            elif status.lower() == "canceled":
                success = await vk_api.reject_reward_demands(
                    channel_name,
                    user_token.access_token,
                    demand_ids
                )
        
        if not success:
            raise HTTPException(status_code=500, detail="Ошибка обновления статуса")
        
        return {
            "success": True,
            "message": f"Статус обновлен: {status}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating platform redemption: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === СТАТИСТИКА ===

@points_router.get("/stats")
async def get_channel_stats(
    channel_name: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение статистики канала"""
    try:
        stats = points_service.get_channel_stats(user["id"], channel_name, db)
        
        return {
            "success": True,
            "stats": stats,
            "channel_name": channel_name
        }
        
    except Exception as e:
        logger.error(f"Error getting channel stats: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения статистики")

# === УПРАВЛЕНИЕ НАГРАДАМИ (НОВЫЕ ENDPOINTS) ===

class UpdateRewardRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    cost: Optional[int] = None
    icon_url: Optional[str] = None
    background_color: Optional[str] = None
    is_user_input_required: Optional[bool] = None
    max_per_stream: Optional[int] = None
    max_per_user_per_stream: Optional[int] = None
    prompt: Optional[str] = None
    enabled: Optional[bool] = None

@points_router.put("/rewards/{reward_id}")
async def update_reward(
    reward_id: int,
    request: UpdateRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление награды"""
    try:
        result = points_service.update_reward(
            user["id"],
            reward_id,
            request.dict(exclude_unset=True),
            db
        )
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result.get("error", "Ошибка обновления награды"))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating reward {reward_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обновления награды")

@points_router.delete("/rewards/{reward_id}")
async def delete_reward(
    reward_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удаление награды"""
    try:
        result = points_service.delete_reward(user["id"], reward_id, db)
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result.get("error", "Ошибка удаления награды"))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting reward {reward_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка удаления награды")

@points_router.patch("/rewards/{reward_id}/toggle")
async def toggle_reward(
    reward_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Переключение статуса награды (enabled/disabled)"""
    try:
        result = points_service.toggle_reward(user["id"], reward_id, db)
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result.get("error", "Ошибка переключения награды"))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling reward {reward_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка переключения награды")