"""
Twitch Interactive Features API (Hype Train, Clips)

Автор: AI Assistant
Дата: 27 декабря 2025

Документация:
- Hype Train: https://dev.twitch.tv/docs/api/reference#get-hype-train-events
- Clips: https://dev.twitch.tv/docs/api/reference#create-clip
"""
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import httpx

from auth.auth import get_current_user
from core.config import settings
from core.database import User

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/twitch/interactive", tags=["twitch-interactive"])


# === Helper Functions ===

async def get_twitch_token(user: User) -> str:
    """Получить Twitch OAuth токен пользователя через репозиторий"""
    from core.database import get_db
    from core.token_encryption import decrypt_token, is_token_encrypted
    from repositories.user_token_repository import UserTokenRepository
    
    db = next(get_db())
    try:
        token_repo = UserTokenRepository(db)
        user_token = token_repo.get_by_user_and_platform(user.id, 'twitch')
        
        if not user_token or not user_token.access_token:
            logger.error(
                "twitch_token_not_found",
                user_id=user.id
            )
            raise HTTPException(
                status_code=400,
                detail="Twitch OAuth токен не найден"
            )
        
        token = user_token.access_token
        if is_token_encrypted(token):
            token = decrypt_token(token)
        
        return token
    finally:
        db.close()



async def make_twitch_api_request(
    method: str,
    endpoint: str,
    token: str,
    json_data: Optional[dict] = None,
    params: Optional[dict] = None
) -> dict:
    """Выполнить запрос к Twitch API"""
    url = f"https://api.twitch.tv/helix{endpoint}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Client-Id": settings.twitch_client_id,
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                json=json_data,
                params=params,
                timeout=30.0
            )
            
            if response.status_code in [200, 202]:
                return response.json()
            else:
                error_data = response.json() if response.text else {}
                error_message = error_data.get('message', 'Unknown error')
                
                logger.error(
                    "twitch_api_error",
                    endpoint=endpoint,
                    status_code=response.status_code,
                    error=error_message
                )
                
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Twitch API error: {error_message}"
                )
                
    except httpx.RequestError as e:
        logger.error(
            "twitch_api_request_error",
            endpoint=endpoint,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка подключения к Twitch API: {str(e)}"
        )


# === Hype Train Endpoints ===

@router.get("/hype-train", response_model=dict)
async def get_hype_train_events(
    first: int = Query(default=1, ge=1, le=100, description="Количество событий (1-100)"),
    current_user: User = Depends(get_current_user)
):
    """
    Получить информацию о Hype Train событиях
    
    Hype Train - это событие когда зрители массово подписываются,
    дарят подписки или используют Bits.
    
    Требования:
    - Scope: channel:read:hype_train
    
    Документация: https://dev.twitch.tv/docs/api/reference#get-hype-train-events
    """
    try:
        token = await get_twitch_token(current_user)
        
        response = await make_twitch_api_request(
            method="GET",
            endpoint="/hypetrain/events",
            token=token,
            params={
                "broadcaster_id": current_user.twitch_user_id,
                "first": first
            }
        )
        
        events = response.get("data", [])
        pagination = response.get("pagination", {})
        
        logger.info(
            "twitch_hype_train_fetched",
            user_id=current_user.id,
            events_count=len(events)
        )
        
        return {
            "success": True,
            "events": events,
            "pagination": pagination
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "twitch_hype_train_fetch_error",
            user_id=current_user.id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка получения Hype Train: {str(e)}"
        )


@router.get("/hype-train/current", response_model=dict)
async def get_current_hype_train(
    current_user: User = Depends(get_current_user)
):
    """
    Получить информацию о текущем активном Hype Train
    
    Возвращает информацию только если Hype Train активен в данный момент.
    
    Требования:
    - Scope: channel:read:hype_train
    """
    try:
        token = await get_twitch_token(current_user)
        
        response = await make_twitch_api_request(
            method="GET",
            endpoint="/hypetrain/events",
            token=token,
            params={
                "broadcaster_id": current_user.twitch_user_id,
                "first": 1
            }
        )
        
        events = response.get("data", [])
        
        # Проверяем есть ли активный Hype Train
        active_event = None
        if events:
            event = events[0]
            # Hype Train активен если event_data.ended_at is None
            if not event.get("event_data", {}).get("ended_at"):
                active_event = event
        
        if active_event:
            logger.info(
                "twitch_hype_train_active",
                user_id=current_user.id,
                event_id=active_event.get("id"),
                level=active_event.get("event_data", {}).get("level")
            )
        else:
            logger.info(
                "twitch_hype_train_not_active",
                user_id=current_user.id
            )
        
        return {
            "success": True,
            "is_active": active_event is not None,
            "event": active_event
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "twitch_hype_train_current_error",
            user_id=current_user.id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка получения текущего Hype Train: {str(e)}"
        )


# === Clips Endpoints ===

@router.post("/clips/create", response_model=dict)
async def create_clip(
    has_delay: bool = Query(
        default=False,
        description="Добавить задержку перед созданием клипа (для синхронизации со стримом)"
    ),
    current_user: User = Depends(get_current_user)
):
    """
    Создать клип из текущего стрима
    
    Создает 30-секундный клип из текущего момента стрима.
    Стрим должен быть онлайн.
    
    Требования:
    - Scope: clips:edit
    - Стрим должен быть онлайн
    
    Примечание: API возвращает URL для редактирования клипа,
    но сам клип создается асинхронно и может быть недоступен сразу.
    
    Документация: https://dev.twitch.tv/docs/api/reference#create-clip
    """
    try:
        token = await get_twitch_token(current_user)
        
        params = {
            "broadcaster_id": current_user.twitch_user_id
        }
        
        if has_delay:
            params["has_delay"] = "true"
        
        logger.info(
            "twitch_clip_creating",
            user_id=current_user.id,
            has_delay=has_delay
        )
        
        response = await make_twitch_api_request(
            method="POST",
            endpoint="/clips",
            token=token,
            params=params
        )
        
        clip_data = response.get("data", [{}])[0]
        
        logger.info(
            "twitch_clip_created",
            user_id=current_user.id,
            clip_id=clip_data.get("id"),
            edit_url=clip_data.get("edit_url")
        )
        
        return {
            "success": True,
            "clip": clip_data,
            "message": "Клип создается. Он будет доступен через несколько секунд."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "twitch_clip_create_error",
            user_id=current_user.id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка создания клипа: {str(e)}"
        )


@router.get("/clips", response_model=dict)
async def get_clips(
    first: int = Query(default=20, ge=1, le=100, description="Количество клипов (1-100)"),
    started_at: Optional[str] = Query(
        default=None,
        description="Начало периода (RFC3339 format)"
    ),
    ended_at: Optional[str] = Query(
        default=None,
        description="Конец периода (RFC3339 format)"
    ),
    current_user: User = Depends(get_current_user)
):
    """
    Получить клипы канала
    
    Возвращает список клипов созданных на канале.
    Можно фильтровать по периоду времени.
    
    Требования:
    - Scope: Не требуется (публичные данные)
    
    Документация: https://dev.twitch.tv/docs/api/reference#get-clips
    """
    try:
        token = await get_twitch_token(current_user)
        
        params = {
            "broadcaster_id": current_user.twitch_user_id,
            "first": first
        }
        
        if started_at:
            params["started_at"] = started_at
        if ended_at:
            params["ended_at"] = ended_at
        
        response = await make_twitch_api_request(
            method="GET",
            endpoint="/clips",
            token=token,
            params=params
        )
        
        clips = response.get("data", [])
        pagination = response.get("pagination", {})
        
        logger.info(
            "twitch_clips_fetched",
            user_id=current_user.id,
            clips_count=len(clips)
        )
        
        return {
            "success": True,
            "clips": clips,
            "pagination": pagination
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "twitch_clips_fetch_error",
            user_id=current_user.id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка получения клипов: {str(e)}"
        )
