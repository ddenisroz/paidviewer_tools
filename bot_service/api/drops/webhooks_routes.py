"""
Drops Webhooks, Triggers, and Widget API endpoints.
Clean Architecture: uses repositories for data access.
"""
import logging
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from core.database import get_db, DonationAlert
from core.config import settings
from auth.auth import get_current_user
from repositories.user_repository import UserRepository
from repositories.drops_reward_repository import DropsRewardRepository
logger = logging.getLogger(__name__)
router = APIRouter(prefix='/api/drops', tags=['drops'])

@router.get('/triggers')
async def get_drops_triggers(current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        logger.info(f"[PACKAGE] [DROPS] Getting triggers for user {current_user.get('id')}")
        return {'success': True, 'triggers': []}
    except HTTPException:
        raise
    except Exception:
        logger.exception('[ERROR] [DROPS] Error getting triggers')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.post('/triggers')
async def create_drops_trigger(request: dict, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        logger.info(f"[PACKAGE] [DROPS] Creating trigger for user {current_user.get('id')}")
        return {'success': True, 'message': 'Operation completed.', 'trigger_id': 1}
    except HTTPException:
        raise
    except Exception:
        logger.exception('[ERROR] [DROPS] Error creating trigger')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.put('/triggers/{trigger_id}')
async def update_drops_trigger(trigger_id: int, request: dict, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        logger.info(f'[PACKAGE] [DROPS] Updating trigger {trigger_id}')
        return {'success': True, 'message': 'Operation completed.'}
    except HTTPException:
        raise
    except Exception:
        logger.exception('[ERROR] [DROPS] Error updating trigger')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.delete('/triggers/{trigger_id}')
async def delete_drops_trigger(trigger_id: int, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        logger.info(f'[PACKAGE] [DROPS] Deleting trigger {trigger_id}')
        return {'success': True, 'message': 'Operation completed.'}
    except HTTPException:
        raise
    except Exception:
        logger.exception('[ERROR] [DROPS] Error deleting trigger')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.post('/triggers/test/{trigger_id}')
async def test_drops_trigger(trigger_id: int, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        logger.info(f'[PACKAGE] [DROPS] Testing trigger {trigger_id}')
        return {'success': True, 'message': 'Operation completed.'}
    except HTTPException:
        raise
    except Exception:
        logger.exception('[ERROR] [DROPS] Error testing trigger')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.get('/user-from-token/{token}')
async def get_user_from_token(token: str, db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        repo = DropsRewardRepository(db)
        config = repo.get_config_by_token(token)
        if not config or not config.user_id:
            logger.warning(f'Drops widget: Config not found for token: {token[:8]}...')
            raise HTTPException(status_code=404, detail='Invalid widget token')
        return {'user_id': config.user_id, 'channel_name': config.channel_name, 'platform': config.platform or 'global', 'success': True}
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error getting user from token')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.post('/widget-url')
async def generate_widget_url(regenerate: bool=False, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        user_repo = UserRepository(db)
        user = user_repo.get_by_id(current_user['id'])
        if not user:
            raise HTTPException(status_code=400, detail='Operation failed.')
        channel_name = user.twitch_username or user.vk_channel_name or user.username or 'unknown'
        if channel_name == 'unknown':
            raise HTTPException(status_code=400, detail='Operation failed.')
        from services.drops.drops_service import DropsService
        drops_service = DropsService(db)
        config = drops_service.get_config(user_id=current_user['id'], session_id=None, channel_name=channel_name, platform=None)
        widget_token_value = None
        if config and hasattr(config, 'widget_token'):
            widget_token_value = config.widget_token
        if config and widget_token_value and (not regenerate):
            frontend_url = settings.frontend_url
            widget_url = f'{frontend_url}/drops-widget/{widget_token_value}'
            return {'success': True, 'data': {'url': widget_url, 'token': widget_token_value}}
        token = secrets.token_urlsafe(32)
        if config:
            try:
                from sqlalchemy import text
                db.execute(text('UPDATE drops_configs SET widget_token = :token WHERE id = :config_id'), {'token': token, 'config_id': config.id})
                if hasattr(config, 'widget_token'):
                    config.widget_token = token
            except Exception:
                logger.exception('Cannot set widget_token')
        if not config:
            config = drops_service.create_or_update_config(user_id=current_user['id'], session_id=None, channel_name=channel_name, platform=None, config_data={})
            try:
                from sqlalchemy import text
                db.execute(text('UPDATE drops_configs SET widget_token = :token WHERE id = :config_id'), {'token': token, 'config_id': config.id})
                if hasattr(config, 'widget_token'):
                    config.widget_token = token
            except Exception:
                logger.exception('Cannot set widget_token on new config')
        db.commit()
        frontend_url = settings.frontend_url
        widget_url = f'{frontend_url}/drops-widget/{token}'
        return {'success': True, 'data': {'url': widget_url, 'token': token}}
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error generating widget URL')
        db.rollback()
        raise HTTPException(status_code=500, detail='Internal server error')

@router.post('/donationalerts/webhook')
async def donationalerts_webhook(request: Request, db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        from services.drops.drops_service import DropsService
        from services.memealerts_service import MemeAlertsService
        data = await request.json()
        donation_amount = data.get('amount', 0)
        donor_name = data.get('username', 'Anonymous')
        donor_id = data.get('user_id', 'unknown')
        message = data.get('message', '')
        alert_id = data.get('id', '')
        logger.info(f'[REWARD] [DONATION DROPS] Received donation: {donor_name} - {donation_amount}Text cleaned.')
        user_repo = UserRepository(db)
        user_token = user_repo.get_token_by_platform('donationalerts', data.get('user_id', ''))
        if not user_token:
            logger.warning(f"No user found for DonationAlerts ID: {data.get('user_id')}")
            return {'success': True, 'processed': False, 'message': 'User not found'}
        user = user_repo.get_by_id(user_token.user_id)
        if not user:
            logger.warning(f'User not found for user_id: {user_token.user_id}')
            return {'success': True, 'processed': False, 'message': 'User record not found'}
        channel_name = user.twitch_username or user.vk_channel_name or 'default'
        result = None
        memealerts_result = None
        try:
            existing_donation = db.query(DonationAlert).filter(DonationAlert.alert_id == alert_id).with_for_update().first()
            if not existing_donation:
                donation_record = DonationAlert(user_id=user_token.user_id, channel_name=channel_name, amount=float(donation_amount), currency=data.get('currency', 'RUB'), message=message, alert_id=alert_id, is_processed=False)
                db.add(donation_record)
                logger.info(f'[OK] [DONATION RECORD] Saved donation {alert_id}')
            else:
                logger.info(f'[INFO] [DONATION RECORD] Donation {alert_id} already recorded')
            drops_service = DropsService(db)
            result = drops_service.process_donation_drops(user_id=user_token.user_id, channel_name=channel_name, platform='donationalerts', viewer_id=donor_id, viewer_name=donor_name, donation_amount=donation_amount)
            memealerts_service = MemeAlertsService(db)
            memealerts_result = await memealerts_service.process_donation_auto_grant(user_id=user_token.user_id, channel_name=channel_name, donor_name=donor_name, donation_amount=donation_amount)
            db.commit()
        except Exception:
            db.rollback()
            logger.exception('[ERROR] Error processing donation {alert_id}')
        if memealerts_result and memealerts_result.get('handled'):
            if memealerts_result.get('success'):
                logger.info('[MEMEALERTS] Donation auto-grant success: donor=%s, amount=%s', memealerts_result.get('nickname'), memealerts_result.get('amount'))
            else:
                logger.warning('[MEMEALERTS] Donation auto-grant skipped/failed: %s', memealerts_result.get('error'))
        if result:
            logger.info(f"[REWARD] [DONATION DROPS] {donor_name}Text cleaned.{result['reward']} ({result['quality']})")
            from utils.websocket_helper import broadcast_drops_event
            await broadcast_drops_event(result)
            response_payload = {'success': True, 'message': 'Drops processed successfully', 'data': result}
            if memealerts_result and memealerts_result.get('handled'):
                response_payload['memealerts'] = memealerts_result
            return response_payload
        else:
            response_payload = {'success': True, 'processed': False, 'message': 'No drops available for this donation'}
            if memealerts_result and memealerts_result.get('handled'):
                response_payload['memealerts'] = memealerts_result
            return response_payload
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error processing DonationAlerts webhook')
        raise HTTPException(status_code=500, detail='Internal server error')
