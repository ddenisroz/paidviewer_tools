"""
Twitch Predictions API

Автор: AI Assistant
Дата: 27 декабря 2025

Документация: https://dev.twitch.tv/docs/api/reference#create-prediction
"""
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal
from datetime import datetime
import httpx

from auth.dependencies import get_current_user
from core.config import settings
from core.database import User

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/twitch/predictions", tags=["twitch-predictions"])


# === Pydantic Models ===

class PredictionOutcome(BaseModel):
    """Вариант исхода предсказания"""
    title: str = Field(..., min_length=1, max_length=25, description="Название исхода")


class PredictionCreate(BaseModel):
    """Создание предсказания"""
    title: str = Field(
        ..., 
        min_length=1, 
        max_length=45, 
        description="Заголовок предсказания"
    )
    outcomes: List[PredictionOutcome] = Field(
        ..., 
        min_length=2, 
        max_length=10,
        description="Варианты исходов (2-10)"
    )
    prediction_window: int = Field(
        ..., 
        ge=30, 
        le=1800,
        description="Время для ставок в секундах (30-1800)"
    )
    
    @field_validator('outcomes')
    @classmethod
    def validate_outcomes(cls, v: List[PredictionOutcome]) -> List[PredictionOutcome]:
        """Валидация уникальности названий исходов"""
        titles = [outcome.title for outcome in v]
        if len(titles) != len(set(titles)):
            raise ValueError("Названия исходов должны быть уникальными")
        return v


class PredictionEnd(BaseModel):
    """Завершение предсказания"""
    status: Literal["RESOLVED", "CANCELED"] = Field(
        ...,
        description="Статус завершения (RESOLVED - с победителем, CANCELED - отмена)"
    )
    winning_outcome_id: Optional[str] = Field(
        None,
        description="ID победившего исхода (обязательно для RESOLVED)"
    )
    
    @field_validator('winning_outcome_id')
    @classmethod
    def validate_winning_outcome(cls, v: Optional[str], info) -> Optional[str]:
        """Валидация winning_outcome_id для RESOLVED статуса"""
        status = info.data.get('status')
        if status == 'RESOLVED' and not v:
            raise ValueError("winning_outcome_id обязателен для статуса RESOLVED")
        if status == 'CANCELED' and v:
            raise ValueError("winning_outcome_id не должен быть указан для статуса CANCELED")
        return v


class PredictionResponse(BaseModel):
    """Ответ с информацией о предсказании"""
    id: str
    broadcaster_id: str
    broadcaster_name: str
    broadcaster_login: str
    title: str
    winning_outcome_id: Optional[str]
    outcomes: List[dict]
    prediction_window: int
    status: str
    created_at: str
    ended_at: Optional[str]
    locked_at: Optional[str]


# === Helper Functions ===

async def get_twitch_token(user: User) -> str:
    """
    Получить Twitch OAuth токен пользователя
    
    Args:
        user: Пользователь из базы данных
        
    Returns:
        str: OAuth токен
        
    Raises:
        HTTPException: Если токен не найден
    """
    from core.database import UserToken, get_db
    from core.token_encryption import decrypt_token, is_token_encrypted
    
    db = next(get_db())
    try:
        user_token = db.query(UserToken).filter(
            UserToken.user_id == user.id,
            UserToken.platform == 'twitch'
        ).first()
        
        if not user_token or not user_token.access_token:
            logger.error(
                "twitch_token_not_found",
                user_id=user.id
            )
            raise HTTPException(
                status_code=400,
                detail="Twitch OAuth токен не найден. Пожалуйста, подключите Twitch аккаунт."
            )
        
        # Расшифровываем токен если нужно
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
    """
    Выполнить запрос к Twitch API
    
    Args:
        method: HTTP метод (GET, POST, PATCH)
        endpoint: API endpoint
        token: OAuth токен
        json_data: JSON данные для POST/PATCH
        params: Query параметры
        
    Returns:
        dict: Ответ API
        
    Raises:
        HTTPException: При ошибке API
    """
    url = f"https://api.twitch.tv/helix{endpoint}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Client-Id": settings.TWITCH_CLIENT_ID,
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
            
            if response.status_code == 200:
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


# === API Endpoints ===

@router.post("/create", response_model=dict)
async def create_prediction(
    prediction: PredictionCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Создать предсказание с Channel Points
    
    Требования:
    - Scope: channel:manage:predictions
    - Broadcaster или Editor
    - Стрим должен быть онлайн
    
    Документация: https://dev.twitch.tv/docs/api/reference#create-prediction
    """
    try:
        # Получаем токен пользователя
        token = await get_twitch_token(current_user)
        
        # Формируем данные для API
        data = {
            "broadcaster_id": current_user.twitch_user_id,
            "title": prediction.title,
            "outcomes": [{"title": outcome.title} for outcome in prediction.outcomes],
            "prediction_window": prediction.prediction_window
        }
        
        logger.info(
            "twitch_prediction_creating",
            user_id=current_user.id,
            title=prediction.title,
            outcomes_count=len(prediction.outcomes)
        )
        
        # Создаем предсказание
        response = await make_twitch_api_request(
            method="POST",
            endpoint="/predictions",
            token=token,
            json_data=data
        )
        
        prediction_data = response.get("data", [{}])[0]
        
        logger.info(
            "twitch_prediction_created",
            user_id=current_user.id,
            prediction_id=prediction_data.get("id"),
            title=prediction.title
        )
        
        return {
            "success": True,
            "prediction": prediction_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "twitch_prediction_create_error",
            user_id=current_user.id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка создания предсказания: {str(e)}"
        )


@router.patch("/{prediction_id}/end", response_model=dict)
async def end_prediction(
    prediction_id: str,
    end_data: PredictionEnd,
    current_user: User = Depends(get_current_user)
):
    """
    Завершить предсказание
    
    Статусы:
    - RESOLVED: Завершить с победителем (требуется winning_outcome_id)
    - CANCELED: Отменить предсказание (баллы возвращаются)
    
    Требования:
    - Scope: channel:manage:predictions
    - Broadcaster или Editor
    
    Документация: https://dev.twitch.tv/docs/api/reference#end-prediction
    """
    try:
        # Получаем токен пользователя
        token = await get_twitch_token(current_user)
        
        # Формируем данные для API
        data = {
            "broadcaster_id": current_user.twitch_user_id,
            "id": prediction_id,
            "status": end_data.status
        }
        
        if end_data.winning_outcome_id:
            data["winning_outcome_id"] = end_data.winning_outcome_id
        
        logger.info(
            "twitch_prediction_ending",
            user_id=current_user.id,
            prediction_id=prediction_id,
            status=end_data.status
        )
        
        # Завершаем предсказание
        response = await make_twitch_api_request(
            method="PATCH",
            endpoint="/predictions",
            token=token,
            json_data=data
        )
        
        prediction_data = response.get("data", [{}])[0]
        
        logger.info(
            "twitch_prediction_ended",
            user_id=current_user.id,
            prediction_id=prediction_id,
            status=end_data.status
        )
        
        return {
            "success": True,
            "prediction": prediction_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "twitch_prediction_end_error",
            user_id=current_user.id,
            prediction_id=prediction_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка завершения предсказания: {str(e)}"
        )


@router.get("/active", response_model=dict)
async def get_active_predictions(
    current_user: User = Depends(get_current_user)
):
    """
    Получить активные предсказания
    
    Требования:
    - Scope: channel:read:predictions или channel:manage:predictions
    
    Документация: https://dev.twitch.tv/docs/api/reference#get-predictions
    """
    try:
        # Получаем токен пользователя
        token = await get_twitch_token(current_user)
        
        # Получаем предсказания
        response = await make_twitch_api_request(
            method="GET",
            endpoint="/predictions",
            token=token,
            params={"broadcaster_id": current_user.twitch_user_id}
        )
        
        predictions = response.get("data", [])
        
        logger.info(
            "twitch_predictions_fetched",
            user_id=current_user.id,
            count=len(predictions)
        )
        
        return {
            "success": True,
            "predictions": predictions
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "twitch_predictions_fetch_error",
            user_id=current_user.id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка получения предсказаний: {str(e)}"
        )


@router.get("/{prediction_id}", response_model=dict)
async def get_prediction(
    prediction_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Получить информацию о конкретном предсказании
    
    Требования:
    - Scope: channel:read:predictions или channel:manage:predictions
    """
    try:
        # Получаем токен пользователя
        token = await get_twitch_token(current_user)
        
        # Получаем предсказание
        response = await make_twitch_api_request(
            method="GET",
            endpoint="/predictions",
            token=token,
            params={
                "broadcaster_id": current_user.twitch_user_id,
                "id": prediction_id
            }
        )
        
        predictions = response.get("data", [])
        
        if not predictions:
            raise HTTPException(
                status_code=404,
                detail="Предсказание не найдено"
            )
        
        return {
            "success": True,
            "prediction": predictions[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "twitch_prediction_fetch_error",
            user_id=current_user.id,
            prediction_id=prediction_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка получения предсказания: {str(e)}"
        )
