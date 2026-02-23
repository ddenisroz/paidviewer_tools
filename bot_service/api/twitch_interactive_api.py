"""Text cleaned."""
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import httpx
from auth.auth import get_current_user
from core.config import settings
from core.database import User
logger = structlog.get_logger(__name__)
router = APIRouter(prefix='/api/twitch/interactive', tags=['twitch-interactive'])

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
            if response.status_code in [200, 202]:
                return response.json()
            else:
                error_data = response.json() if response.text else {}
                error_message = error_data.get('message', 'Unknown error')
                logger.error('twitch_api_error', endpoint=endpoint, status_code=response.status_code, error=error_message)
                raise HTTPException(status_code=response.status_code, detail=f'Twitch API error: {error_message}')
    except httpx.RequestError as e:
        logger.error('twitch_api_request_error', endpoint=endpoint, error=str(e))
        raise HTTPException(status_code=500, detail=f'РћС€РёР±РєР° РїРѕРґРєР»СЋС‡РµРЅРёСЏ Рє Twitch API')

@router.get('/hype-train', response_model=dict)
async def get_hype_train_events(first: int=Query(default=1, ge=1, le=100, description='РљРѕР»РёС‡РµСЃС‚РІРѕ СЃРѕР±С‹С‚РёР№ (1-100)'), current_user: User=Depends(get_current_user)):
    """
    РџРѕР»СѓС‡РёС‚СЊ РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ Hype Train СЃРѕР±С‹С‚РёСЏС…
    
    Hype Train - СЌС‚Рѕ СЃРѕР±С‹С‚РёРµ РєРѕРіРґР° Р·СЂРёС‚РµР»Рё РјР°СЃСЃРѕРІРѕ РїРѕРґРїРёСЃС‹РІР°СЋС‚СЃСЏ,
    РґР°СЂСЏС‚ РїРѕРґРїРёСЃРєРё РёР»Рё РёСЃРїРѕР»СЊР·СѓСЋС‚ Bits.
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - Scope: channel:read:hype_train
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: https://dev.twitch.tv/docs/api/reference#get-hype-train-events
    """
    try:
        token = await get_twitch_token(current_user)
        response = await make_twitch_api_request(method='GET', endpoint='/hypetrain/events', token=token, params={'broadcaster_id': current_user.twitch_user_id, 'first': first})
        events = response.get('data', [])
        pagination = response.get('pagination', {})
        logger.info('twitch_hype_train_fetched', user_id=current_user.id, events_count=len(events))
        return {'success': True, 'events': events, 'pagination': pagination}
    except HTTPException:
        raise
    except Exception as e:
        logger.error('twitch_hype_train_fetch_error', user_id=current_user.id, error=str(e))
        raise HTTPException(status_code=500, detail=f'РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ Hype Train')

@router.get('/hype-train/current', response_model=dict)
async def get_current_hype_train(current_user: User=Depends(get_current_user)):
    """
    РџРѕР»СѓС‡РёС‚СЊ РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ С‚РµРєСѓС‰РµРј Р°РєС‚РёРІРЅРѕРј Hype Train
    
    Р’РѕР·РІСЂР°С‰Р°РµС‚ РёРЅС„РѕСЂРјР°С†РёСЋ С‚РѕР»СЊРєРѕ РµСЃР»Рё Hype Train Р°РєС‚РёРІРµРЅ РІ РґР°РЅРЅС‹Р№ РјРѕРјРµРЅС‚.
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - Scope: channel:read:hype_train
    """
    try:
        token = await get_twitch_token(current_user)
        response = await make_twitch_api_request(method='GET', endpoint='/hypetrain/events', token=token, params={'broadcaster_id': current_user.twitch_user_id, 'first': 1})
        events = response.get('data', [])
        active_event = None
        if events:
            event = events[0]
            if not event.get('event_data', {}).get('ended_at'):
                active_event = event
        if active_event:
            logger.info('twitch_hype_train_active', user_id=current_user.id, event_id=active_event.get('id'), level=active_event.get('event_data', {}).get('level'))
        else:
            logger.info('twitch_hype_train_not_active', user_id=current_user.id)
        return {'success': True, 'is_active': active_event is not None, 'event': active_event}
    except HTTPException:
        raise
    except Exception as e:
        logger.error('twitch_hype_train_current_error', user_id=current_user.id, error=str(e))
        raise HTTPException(status_code=500, detail=f'РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ С‚РµРєСѓС‰РµРіРѕ Hype Train')

@router.post('/clips/create', response_model=dict)
async def create_clip(has_delay: bool=Query(default=False, description='Р”РѕР±Р°РІРёС‚СЊ Р·Р°РґРµСЂР¶РєСѓ РїРµСЂРµРґ СЃРѕР·РґР°РЅРёРµРј РєР»РёРїР° (РґР»СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё СЃРѕ СЃС‚СЂРёРјРѕРј)'), current_user: User=Depends(get_current_user)):
    """
    РЎРѕР·РґР°С‚СЊ РєР»РёРї РёР· С‚РµРєСѓС‰РµРіРѕ СЃС‚СЂРёРјР°
    
    РЎРѕР·РґР°РµС‚ 30-СЃРµРєСѓРЅРґРЅС‹Р№ РєР»РёРї РёР· С‚РµРєСѓС‰РµРіРѕ РјРѕРјРµРЅС‚Р° СЃС‚СЂРёРјР°.
    РЎС‚СЂРёРј РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РѕРЅР»Р°Р№РЅ.
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - Scope: clips:edit
    - РЎС‚СЂРёРј РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РѕРЅР»Р°Р№РЅ
    
    РџСЂРёРјРµС‡Р°РЅРёРµ: API РІРѕР·РІСЂР°С‰Р°РµС‚ URL РґР»СЏ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ РєР»РёРїР°,
    РЅРѕ СЃР°Рј РєР»РёРї СЃРѕР·РґР°РµС‚СЃСЏ Р°СЃРёРЅС…СЂРѕРЅРЅРѕ Рё РјРѕР¶РµС‚ Р±С‹С‚СЊ РЅРµРґРѕСЃС‚СѓРїРµРЅ СЃСЂР°Р·Сѓ.
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: https://dev.twitch.tv/docs/api/reference#create-clip
    """
    try:
        token = await get_twitch_token(current_user)
        params = {'broadcaster_id': current_user.twitch_user_id}
        if has_delay:
            params['has_delay'] = 'true'
        logger.info('twitch_clip_creating', user_id=current_user.id, has_delay=has_delay)
        response = await make_twitch_api_request(method='POST', endpoint='/clips', token=token, params=params)
        clip_data = response.get('data', [{}])[0]
        logger.info('twitch_clip_created', user_id=current_user.id, clip_id=clip_data.get('id'), edit_url=clip_data.get('edit_url'))
        return {'success': True, 'clip': clip_data, 'message': 'РљР»РёРї СЃРѕР·РґР°РµС‚СЃСЏ. РћРЅ Р±СѓРґРµС‚ РґРѕСЃС‚СѓРїРµРЅ С‡РµСЂРµР· РЅРµСЃРєРѕР»СЊРєРѕ СЃРµРєСѓРЅРґ.'}
    except HTTPException:
        raise
    except Exception as e:
        logger.error('twitch_clip_create_error', user_id=current_user.id, error=str(e))
        raise HTTPException(status_code=500, detail=f'РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ РєР»РёРїР°')

@router.get('/clips', response_model=dict)
async def get_clips(first: int=Query(default=20, ge=1, le=100, description='РљРѕР»РёС‡РµСЃС‚РІРѕ РєР»РёРїРѕРІ (1-100)'), started_at: Optional[str]=Query(default=None, description='РќР°С‡Р°Р»Рѕ РїРµСЂРёРѕРґР° (RFC3339 format)'), ended_at: Optional[str]=Query(default=None, description='РљРѕРЅРµС† РїРµСЂРёРѕРґР° (RFC3339 format)'), current_user: User=Depends(get_current_user)):
    """
    РџРѕР»СѓС‡РёС‚СЊ РєР»РёРїС‹ РєР°РЅР°Р»Р°
    
    Р’РѕР·РІСЂР°С‰Р°РµС‚ СЃРїРёСЃРѕРє РєР»РёРїРѕРІ СЃРѕР·РґР°РЅРЅС‹С… РЅР° РєР°РЅР°Р»Рµ.
    РњРѕР¶РЅРѕ С„РёР»СЊС‚СЂРѕРІР°С‚СЊ РїРѕ РїРµСЂРёРѕРґСѓ РІСЂРµРјРµРЅРё.
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - Scope: РќРµ С‚СЂРµР±СѓРµС‚СЃСЏ (РїСѓР±Р»РёС‡РЅС‹Рµ РґР°РЅРЅС‹Рµ)
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: https://dev.twitch.tv/docs/api/reference#get-clips
    """
    try:
        token = await get_twitch_token(current_user)
        params = {'broadcaster_id': current_user.twitch_user_id, 'first': first}
        if started_at:
            params['started_at'] = started_at
        if ended_at:
            params['ended_at'] = ended_at
        response = await make_twitch_api_request(method='GET', endpoint='/clips', token=token, params=params)
        clips = response.get('data', [])
        pagination = response.get('pagination', {})
        logger.info('twitch_clips_fetched', user_id=current_user.id, clips_count=len(clips))
        return {'success': True, 'clips': clips, 'pagination': pagination}
    except HTTPException:
        raise
    except Exception as e:
        logger.error('twitch_clips_fetch_error', user_id=current_user.id, error=str(e))
        raise HTTPException(status_code=500, detail=f'РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РєР»РёРїРѕРІ')
