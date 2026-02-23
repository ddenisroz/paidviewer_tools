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
router = APIRouter(prefix='/api/twitch/polls', tags=['twitch-polls'])

class PollChoice(BaseModel):
    """Р’Р°СЂРёР°РЅС‚ РѕС‚РІРµС‚Р° РІ РіРѕР»РѕСЃРѕРІР°РЅРёРё"""
    title: str = Field(..., min_length=1, max_length=25, description='РўРµРєСЃС‚ РІР°СЂРёР°РЅС‚Р°')

class PollCreate(BaseModel):
    """РЎРѕР·РґР°РЅРёРµ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ"""
    title: str = Field(..., min_length=1, max_length=60, description='Р’РѕРїСЂРѕСЃ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ')
    choices: List[PollChoice] = Field(..., min_length=2, max_length=5, description='Р’Р°СЂРёР°РЅС‚С‹ РѕС‚РІРµС‚РѕРІ (2-5)')
    duration: int = Field(..., ge=15, le=1800, description='Р”Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ РІ СЃРµРєСѓРЅРґР°С… (15-1800)')
    channel_points_voting_enabled: bool = Field(default=False, description='Р Р°Р·СЂРµС€РёС‚СЊ РіРѕР»РѕСЃРѕРІР°РЅРёРµ Р·Р° Channel Points')
    channel_points_per_vote: Optional[int] = Field(default=None, ge=1, le=1000000, description='РЎС‚РѕРёРјРѕСЃС‚СЊ РіРѕР»РѕСЃР° РІ Channel Points (1-1000000)')

    @field_validator('choices')
    @classmethod
    def validate_choices(cls, v: List[PollChoice]) -> List[PollChoice]:
        """Р’Р°Р»РёРґР°С†РёСЏ СѓРЅРёРєР°Р»СЊРЅРѕСЃС‚Рё РІР°СЂРёР°РЅС‚РѕРІ"""
        titles = [choice.title for choice in v]
        if len(titles) != len(set(titles)):
            raise ValueError('Р’Р°СЂРёР°РЅС‚С‹ РѕС‚РІРµС‚РѕРІ РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ СѓРЅРёРєР°Р»СЊРЅС‹РјРё')
        return v

    @field_validator('channel_points_per_vote')
    @classmethod
    def validate_channel_points(cls, v: Optional[int], info) -> Optional[int]:
        """Р’Р°Р»РёРґР°С†РёСЏ channel_points_per_vote"""
        enabled = info.data.get('channel_points_voting_enabled')
        if enabled and (not v):
            raise ValueError('channel_points_per_vote РѕР±СЏР·Р°С‚РµР»РµРЅ РєРѕРіРґР° channel_points_voting_enabled=true')
        if not enabled and v:
            raise ValueError('channel_points_per_vote РЅРµ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ СѓРєР°Р·Р°РЅ РєРѕРіРґР° channel_points_voting_enabled=false')
        return v

class PollEnd(BaseModel):
    """Р—Р°РІРµСЂС€РµРЅРёРµ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ"""
    status: Literal['TERMINATED', 'ARCHIVED'] = Field(..., description='РЎС‚Р°С‚СѓСЃ Р·Р°РІРµСЂС€РµРЅРёСЏ (TERMINATED - РґРѕСЃСЂРѕС‡РЅРѕ, ARCHIVED - Р°СЂС…РёРІРёСЂРѕРІР°С‚СЊ)')

async def get_twitch_token(user: User) -> str:
    """РџРѕР»СѓС‡РёС‚СЊ Twitch OAuth С‚РѕРєРµРЅ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ С‡РµСЂРµР· СЂРµРїРѕР·РёС‚РѕСЂРёР№"""
    from core.database import get_db
    from core.token_encryption import decrypt_token, is_token_encrypted
    from repositories.user_token_repository import UserTokenRepository
    db = next(get_db())
    try:
        token_repo = UserTokenRepository(db)
        user_token = token_repo.get_by_user_and_platform(user.id, 'twitch')
        if not user_token or not user_token.access_token:
            logger.error('twitch_token_not_found', user_id=user.id)
            raise HTTPException(status_code=400, detail='Twitch OAuth С‚РѕРєРµРЅ РЅРµ РЅР°Р№РґРµРЅ')
        token = user_token.access_token
        if is_token_encrypted(token):
            token = decrypt_token(token)
        return token
    finally:
        db.close()

async def make_twitch_api_request(method: str, endpoint: str, token: str, json_data: Optional[dict]=None, params: Optional[dict]=None) -> dict:
    """Р’С‹РїРѕР»РЅРёС‚СЊ Р·Р°РїСЂРѕСЃ Рє Twitch API"""
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
async def create_poll(poll: PollCreate, current_user: User=Depends(get_current_user)):
    """
    РЎРѕР·РґР°С‚СЊ РіРѕР»РѕСЃРѕРІР°РЅРёРµ
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - Scope: channel:manage:polls
    - Broadcaster РёР»Рё Editor
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: https://dev.twitch.tv/docs/api/reference#create-poll
    """
    try:
        token = await get_twitch_token(current_user)
        data = {'broadcaster_id': current_user.twitch_user_id, 'title': poll.title, 'choices': [{'title': choice.title} for choice in poll.choices], 'duration': poll.duration}
        if poll.channel_points_voting_enabled:
            data['channel_points_voting_enabled'] = True
            data['channel_points_per_vote'] = poll.channel_points_per_vote
        logger.info('twitch_poll_creating', user_id=current_user.id, title=poll.title, choices_count=len(poll.choices), duration=poll.duration)
        response = await make_twitch_api_request(method='POST', endpoint='/polls', token=token, json_data=data)
        poll_data = response.get('data', [{}])[0]
        logger.info('twitch_poll_created', user_id=current_user.id, poll_id=poll_data.get('id'), title=poll.title)
        return {'success': True, 'poll': poll_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error('twitch_poll_create_error', user_id=current_user.id, error=str(e))
        raise HTTPException(status_code=500, detail=f'РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ')

@router.patch('/{poll_id}/end', response_model=dict)
async def end_poll(poll_id: str, end_data: PollEnd, current_user: User=Depends(get_current_user)):
    """
    Р—Р°РІРµСЂС€РёС‚СЊ РіРѕР»РѕСЃРѕРІР°РЅРёРµ
    
    РЎС‚Р°С‚СѓСЃС‹:
    - TERMINATED: Р—Р°РІРµСЂС€РёС‚СЊ РґРѕСЃСЂРѕС‡РЅРѕ
    - ARCHIVED: РђСЂС…РёРІРёСЂРѕРІР°С‚СЊ (РїРѕСЃР»Рµ РµСЃС‚РµСЃС‚РІРµРЅРЅРѕРіРѕ Р·Р°РІРµСЂС€РµРЅРёСЏ)
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - Scope: channel:manage:polls
    - Broadcaster РёР»Рё Editor
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: https://dev.twitch.tv/docs/api/reference#end-poll
    """
    try:
        token = await get_twitch_token(current_user)
        data = {'broadcaster_id': current_user.twitch_user_id, 'id': poll_id, 'status': end_data.status}
        logger.info('twitch_poll_ending', user_id=current_user.id, poll_id=poll_id, status=end_data.status)
        response = await make_twitch_api_request(method='PATCH', endpoint='/polls', token=token, json_data=data)
        poll_data = response.get('data', [{}])[0]
        logger.info('twitch_poll_ended', user_id=current_user.id, poll_id=poll_id, status=end_data.status)
        return {'success': True, 'poll': poll_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error('twitch_poll_end_error', user_id=current_user.id, poll_id=poll_id, error=str(e))
        raise HTTPException(status_code=500, detail=f'РћС€РёР±РєР° Р·Р°РІРµСЂС€РµРЅРёСЏ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ')

@router.get('/active', response_model=dict)
async def get_active_polls(current_user: User=Depends(get_current_user)):
    """
    РџРѕР»СѓС‡РёС‚СЊ Р°РєС‚РёРІРЅС‹Рµ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - Scope: channel:read:polls РёР»Рё channel:manage:polls
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: https://dev.twitch.tv/docs/api/reference#get-polls
    """
    try:
        token = await get_twitch_token(current_user)
        response = await make_twitch_api_request(method='GET', endpoint='/polls', token=token, params={'broadcaster_id': current_user.twitch_user_id})
        polls = response.get('data', [])
        logger.info('twitch_polls_fetched', user_id=current_user.id, count=len(polls))
        return {'success': True, 'polls': polls}
    except HTTPException:
        raise
    except Exception as e:
        logger.error('twitch_polls_fetch_error', user_id=current_user.id, error=str(e))
        raise HTTPException(status_code=500, detail=f'РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РіРѕР»РѕСЃРѕРІР°РЅРёР№')

@router.get('/{poll_id}', response_model=dict)
async def get_poll(poll_id: str, current_user: User=Depends(get_current_user)):
    """
    РџРѕР»СѓС‡РёС‚СЊ РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ РєРѕРЅРєСЂРµС‚РЅРѕРј РіРѕР»РѕСЃРѕРІР°РЅРёРё
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - Scope: channel:read:polls РёР»Рё channel:manage:polls
    """
    try:
        token = await get_twitch_token(current_user)
        response = await make_twitch_api_request(method='GET', endpoint='/polls', token=token, params={'broadcaster_id': current_user.twitch_user_id, 'id': poll_id})
        polls = response.get('data', [])
        if not polls:
            raise HTTPException(status_code=404, detail='Р“РѕР»РѕСЃРѕРІР°РЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ')
        return {'success': True, 'poll': polls[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error('twitch_poll_fetch_error', user_id=current_user.id, poll_id=poll_id, error=str(e))
        raise HTTPException(status_code=500, detail=f'РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ')
