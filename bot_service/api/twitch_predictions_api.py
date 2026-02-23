"""Text cleaned."""
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal
import httpx
from auth.auth import get_current_user
from core.config import settings
from core.database import User
logger = structlog.get_logger(__name__)
router = APIRouter(prefix='/api/twitch/predictions', tags=['twitch-predictions'])

class PredictionOutcome(BaseModel):
    """Р’Р°СЂРёР°РЅС‚ РёСЃС…РѕРґР° РїСЂРµРґСЃРєР°Р·Р°РЅРёСЏ"""
    title: str = Field(..., min_length=1, max_length=25, description='РќР°Р·РІР°РЅРёРµ РёСЃС…РѕРґР°')

class PredictionCreate(BaseModel):
    """РЎРѕР·РґР°РЅРёРµ РїСЂРµРґСЃРєР°Р·Р°РЅРёСЏ"""
    title: str = Field(..., min_length=1, max_length=45, description='Р—Р°РіРѕР»РѕРІРѕРє РїСЂРµРґСЃРєР°Р·Р°РЅРёСЏ')
    outcomes: List[PredictionOutcome] = Field(..., min_length=2, max_length=10, description='Р’Р°СЂРёР°РЅС‚С‹ РёСЃС…РѕРґРѕРІ (2-10)')
    prediction_window: int = Field(..., ge=30, le=1800, description='Р’СЂРµРјСЏ РґР»СЏ СЃС‚Р°РІРѕРє РІ СЃРµРєСѓРЅРґР°С… (30-1800)')

    @field_validator('outcomes')
    @classmethod
    def validate_outcomes(cls, v: List[PredictionOutcome]) -> List[PredictionOutcome]:
        """Р’Р°Р»РёРґР°С†РёСЏ СѓРЅРёРєР°Р»СЊРЅРѕСЃС‚Рё РЅР°Р·РІР°РЅРёР№ РёСЃС…РѕРґРѕРІ"""
        titles = [outcome.title for outcome in v]
        if len(titles) != len(set(titles)):
            raise ValueError('РќР°Р·РІР°РЅРёСЏ РёСЃС…РѕРґРѕРІ РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ СѓРЅРёРєР°Р»СЊРЅС‹РјРё')
        return v

class PredictionEnd(BaseModel):
    """Р—Р°РІРµСЂС€РµРЅРёРµ РїСЂРµРґСЃРєР°Р·Р°РЅРёСЏ"""
    status: Literal['RESOLVED', 'CANCELED'] = Field(..., description='РЎС‚Р°С‚СѓСЃ Р·Р°РІРµСЂС€РµРЅРёСЏ (RESOLVED - СЃ РїРѕР±РµРґРёС‚РµР»РµРј, CANCELED - РѕС‚РјРµРЅР°)')
    winning_outcome_id: Optional[str] = Field(None, description='ID РїРѕР±РµРґРёРІС€РµРіРѕ РёСЃС…РѕРґР° (РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ РґР»СЏ RESOLVED)')

    @field_validator('winning_outcome_id')
    @classmethod
    def validate_winning_outcome(cls, v: Optional[str], info) -> Optional[str]:
        """Р’Р°Р»РёРґР°С†РёСЏ winning_outcome_id РґР»СЏ RESOLVED СЃС‚Р°С‚СѓСЃР°"""
        status = info.data.get('status')
        if status == 'RESOLVED' and (not v):
            raise ValueError('winning_outcome_id РѕР±СЏР·Р°С‚РµР»РµРЅ РґР»СЏ СЃС‚Р°С‚СѓСЃР° RESOLVED')
        if status == 'CANCELED' and v:
            raise ValueError('winning_outcome_id РЅРµ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ СѓРєР°Р·Р°РЅ РґР»СЏ СЃС‚Р°С‚СѓСЃР° CANCELED')
        return v

class PredictionResponse(BaseModel):
    """РћС‚РІРµС‚ СЃ РёРЅС„РѕСЂРјР°С†РёРµР№ Рѕ РїСЂРµРґСЃРєР°Р·Р°РЅРёРё"""
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

async def get_twitch_token(user: User) -> str:
    """Text cleaned."""
    from core.database import get_db
    from core.token_encryption import decrypt_token, is_token_encrypted
    from repositories.user_token_repository import UserTokenRepository
    db = next(get_db())
    try:
        token_repo = UserTokenRepository(db)
        user_token = token_repo.get_by_user_and_platform(user.id, 'twitch')
        if not user_token or not user_token.access_token:
            logger.error('twitch_token_not_found', user_id=user.id)
            raise HTTPException(status_code=400, detail='Twitch OAuth С‚РѕРєРµРЅ РЅРµ РЅР°Р№РґРµРЅ. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РїРѕРґРєР»СЋС‡РёС‚Рµ Twitch Р°РєРєР°СѓРЅС‚.')
        token = user_token.access_token
        if is_token_encrypted(token):
            token = decrypt_token(token)
        return token
    finally:
        db.close()

async def make_twitch_api_request(method: str, endpoint: str, token: str, json_data: Optional[dict]=None, params: Optional[dict]=None) -> dict:
    """Text cleaned."""
    url = f'https://api.twitch.tv/helix{endpoint}'
    headers = {'Authorization': f'Bearer {token}', 'Client-Id': settings.twitch_client_id, 'Content-Type': 'application/json'}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(method=method, url=url, headers=headers, json=json_data, params=params, timeout=30.0)
            if response.status_code == 200:
                return response.json()
            else:
                error_data = response.json() if response.text else {}
                error_message = error_data.get('message', 'Unknown error')
                logger.error('twitch_api_error', endpoint=endpoint, status_code=response.status_code, error=error_message)
                raise HTTPException(status_code=response.status_code, detail=f'Twitch API error: {error_message}')
    except httpx.RequestError as e:
        logger.error('twitch_api_request_error', endpoint=endpoint, error=str(e))
        raise HTTPException(status_code=500, detail=f'РћС€РёР±РєР° РїРѕРґРєР»СЋС‡РµРЅРёСЏ Рє Twitch API')

@router.post('/create', response_model=dict)
async def create_prediction(prediction: PredictionCreate, current_user: User=Depends(get_current_user)):
    """
    РЎРѕР·РґР°С‚СЊ РїСЂРµРґСЃРєР°Р·Р°РЅРёРµ СЃ Channel Points
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - Scope: channel:manage:predictions
    - Broadcaster РёР»Рё Editor
    - РЎС‚СЂРёРј РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РѕРЅР»Р°Р№РЅ
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: https://dev.twitch.tv/docs/api/reference#create-prediction
    """
    try:
        token = await get_twitch_token(current_user)
        data = {'broadcaster_id': current_user.twitch_user_id, 'title': prediction.title, 'outcomes': [{'title': outcome.title} for outcome in prediction.outcomes], 'prediction_window': prediction.prediction_window}
        logger.info('twitch_prediction_creating', user_id=current_user.id, title=prediction.title, outcomes_count=len(prediction.outcomes))
        response = await make_twitch_api_request(method='POST', endpoint='/predictions', token=token, json_data=data)
        prediction_data = response.get('data', [{}])[0]
        logger.info('twitch_prediction_created', user_id=current_user.id, prediction_id=prediction_data.get('id'), title=prediction.title)
        return {'success': True, 'prediction': prediction_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error('twitch_prediction_create_error', user_id=current_user.id, error=str(e))
        raise HTTPException(status_code=500, detail=f'РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ РїСЂРµРґСЃРєР°Р·Р°РЅРёСЏ')

@router.patch('/{prediction_id}/end', response_model=dict)
async def end_prediction(prediction_id: str, end_data: PredictionEnd, current_user: User=Depends(get_current_user)):
    """
    Р—Р°РІРµСЂС€РёС‚СЊ РїСЂРµРґСЃРєР°Р·Р°РЅРёРµ
    
    РЎС‚Р°С‚СѓСЃС‹:
    - RESOLVED: Р—Р°РІРµСЂС€РёС‚СЊ СЃ РїРѕР±РµРґРёС‚РµР»РµРј (С‚СЂРµР±СѓРµС‚СЃСЏ winning_outcome_id)
    - CANCELED: РћС‚РјРµРЅРёС‚СЊ РїСЂРµРґСЃРєР°Р·Р°РЅРёРµ (Р±Р°Р»Р»С‹ РІРѕР·РІСЂР°С‰Р°СЋС‚СЃСЏ)
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - Scope: channel:manage:predictions
    - Broadcaster РёР»Рё Editor
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: https://dev.twitch.tv/docs/api/reference#end-prediction
    """
    try:
        token = await get_twitch_token(current_user)
        data = {'broadcaster_id': current_user.twitch_user_id, 'id': prediction_id, 'status': end_data.status}
        if end_data.winning_outcome_id:
            data['winning_outcome_id'] = end_data.winning_outcome_id
        logger.info('twitch_prediction_ending', user_id=current_user.id, prediction_id=prediction_id, status=end_data.status)
        response = await make_twitch_api_request(method='PATCH', endpoint='/predictions', token=token, json_data=data)
        prediction_data = response.get('data', [{}])[0]
        logger.info('twitch_prediction_ended', user_id=current_user.id, prediction_id=prediction_id, status=end_data.status)
        return {'success': True, 'prediction': prediction_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error('twitch_prediction_end_error', user_id=current_user.id, prediction_id=prediction_id, error=str(e))
        raise HTTPException(status_code=500, detail=f'РћС€РёР±РєР° Р·Р°РІРµСЂС€РµРЅРёСЏ РїСЂРµРґСЃРєР°Р·Р°РЅРёСЏ')

@router.get('/active', response_model=dict)
async def get_active_predictions(current_user: User=Depends(get_current_user)):
    """
    РџРѕР»СѓС‡РёС‚СЊ Р°РєС‚РёРІРЅС‹Рµ РїСЂРµРґСЃРєР°Р·Р°РЅРёСЏ
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - Scope: channel:read:predictions РёР»Рё channel:manage:predictions
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: https://dev.twitch.tv/docs/api/reference#get-predictions
    """
    try:
        token = await get_twitch_token(current_user)
        response = await make_twitch_api_request(method='GET', endpoint='/predictions', token=token, params={'broadcaster_id': current_user.twitch_user_id})
        predictions = response.get('data', [])
        logger.info('twitch_predictions_fetched', user_id=current_user.id, count=len(predictions))
        return {'success': True, 'predictions': predictions}
    except HTTPException:
        raise
    except Exception as e:
        logger.error('twitch_predictions_fetch_error', user_id=current_user.id, error=str(e))
        raise HTTPException(status_code=500, detail=f'РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РїСЂРµРґСЃРєР°Р·Р°РЅРёР№')

@router.get('/{prediction_id}', response_model=dict)
async def get_prediction(prediction_id: str, current_user: User=Depends(get_current_user)):
    """
    РџРѕР»СѓС‡РёС‚СЊ РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ РєРѕРЅРєСЂРµС‚РЅРѕРј РїСЂРµРґСЃРєР°Р·Р°РЅРёРё
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - Scope: channel:read:predictions РёР»Рё channel:manage:predictions
    """
    try:
        token = await get_twitch_token(current_user)
        response = await make_twitch_api_request(method='GET', endpoint='/predictions', token=token, params={'broadcaster_id': current_user.twitch_user_id, 'id': prediction_id})
        predictions = response.get('data', [])
        if not predictions:
            raise HTTPException(status_code=404, detail='РџСЂРµРґСЃРєР°Р·Р°РЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ')
        return {'success': True, 'prediction': predictions[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error('twitch_prediction_fetch_error', user_id=current_user.id, prediction_id=prediction_id, error=str(e))
        raise HTTPException(status_code=500, detail=f'РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РїСЂРµРґСЃРєР°Р·Р°РЅРёСЏ')
