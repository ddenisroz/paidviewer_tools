# bot_service/api/donationalerts_api.py
"""API для DonationAlerts - Clean Architecture версия"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from auth.auth import get_current_user, get_current_user_optional
from core.config import settings
from repositories.user_token_repository import UserTokenRepository
from repositories.donation_alert_repository import DonationAlertRepository
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/donationalerts", tags=["donationalerts"])


@router.get("/status")
async def get_donationalerts_status(
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Получить статус DonationAlerts"""
    try:
        # Extract user_id from user dict
        user_id = user.get('id') if user else None
        
        if not user_id:
            return {
                "success": True,
                "connected": False,
                "user_info": None
            }

        # Проверяем наличие токена DonationAlerts через репозиторий
        token_repo = UserTokenRepository(db)
        token = token_repo.get_by_user_and_platform(user_id, "donationalerts")

        if token and token.access_token:
            return {
                "success": True,
                "connected": True,
                "user_info": {
                    "platform_user_id": token.platform_user_id
                }
            }
        else:
            return {
                "success": True,
                "connected": False,
                "user_info": None
            }
    except Exception as e:
        logger.error(f"Error getting DonationAlerts status: {e}")
        return {"success": False, "error": str(e)}


@router.post("/connect")
async def connect_donationalerts(
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Подключить DonationAlerts"""
    try:
        # Проверяем что пользователь авторизован
        # NOTE: get_current_user_optional might return None or a guest user dict?
        # Assuming we only want real users now
        if not user or not user.get('id') or user.get('id') <= 0:
            logger.error("User not authenticated")
            return {"success": False, "error": "Not authenticated"}
            
        user_id = user.get('id')

        # Получаем настройки
        client_id = settings.donationalerts_client_id
        redirect_uri = settings.donationalerts_redirect_uri

        # Проверяем настройки
        if not client_id:
            logger.error("DONATIONALERTS_CLIENT_ID not set in environment variables")
            return {"success": False, "error": "DonationAlerts integration is not configured"}

        # Формируем URL авторизации
        from urllib.parse import urlencode
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "oauth-user-show oauth-donation-subscribe oauth-donation-index"
        }
        auth_url = f"https://www.donationalerts.com/oauth/authorize?{urlencode(params)}"

        logger.info(f"DonationAlerts auth URL generated for user {user_id}: {auth_url}")

        return {
            "success": True,
            "message": "DonationAlerts connection initiated",
            "auth_url": auth_url
        }
    except Exception as e:
        logger.error(f"Error connecting DonationAlerts: {e}")
        return {"success": False, "error": str(e)}


@router.post("/disconnect")
async def disconnect_donationalerts(
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Отключить DonationAlerts"""
    try:
        if not user or not user.get('id') or user.get('id') <= 0:
            return {"success": False, "error": "Not authenticated"}
            
        user_id = user.get('id')

        # Удаляем токен DonationAlerts через репозиторий
        token_repo = UserTokenRepository(db)
        token_repo.delete_by_user_and_platform(user_id, "donationalerts")

        logger.info(f"[OK] Disconnected DonationAlerts for user {user_id}")
        return {
            "success": True,
            "message": "DonationAlerts disconnected successfully"
        }
    except Exception as e:
        logger.error(f"Error disconnecting DonationAlerts: {e}")
        db.rollback()
        return {"success": False, "error": str(e)}


@router.get("/donations")
async def get_donations_history(
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить историю донатов пользователя"""
    try:
        user_id = user.get('id')
        donation_repo = DonationAlertRepository(db)

        # Получаем данные через репозиторий
        total = donation_repo.count_by_user_id(user_id)
        donations = donation_repo.get_by_user_id(user_id, limit=limit, offset=offset)

        return {
            "success": True,
            "donations": [
                {
                    "id": d.id,
                    "amount": d.amount,
                    "currency": d.currency,
                    "message": d.message,
                    "channel_name": d.channel_name,
                    "processed_at": d.processed_at.isoformat() if d.processed_at else None,
                    "is_processed": d.is_processed,
                    "alert_id": d.alert_id
                }
                for d in donations
            ],
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset,
                "pages": (total + limit - 1) // limit if limit > 0 else 0
            }
        }
    except Exception as e:
        logger.error(f"Error getting donations: {e}")
        return {"success": False, "error": str(e)}


@router.get("/donations/stats")
async def get_donations_stats(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статистику по донатам"""
    try:
        from datetime import timedelta
        from datetime import datetime as dt

        user_id = user.get('id')
        donation_repo = DonationAlertRepository(db)

        # За всё время
        total_donations = donation_repo.count_by_user_id(user_id)
        total_amount = donation_repo.sum_amount_by_user(user_id)

        # За последний месяц
        one_month_ago = dt.utcnow() - timedelta(days=30)
        month_donations = donation_repo.count_by_user_since(user_id, one_month_ago)
        month_amount = donation_repo.sum_amount_by_user_since(user_id, one_month_ago)

        # За последнюю неделю
        one_week_ago = dt.utcnow() - timedelta(days=7)
        week_donations = donation_repo.count_by_user_since(user_id, one_week_ago)
        week_amount = donation_repo.sum_amount_by_user_since(user_id, one_week_ago)

        return {
            "success": True,
            "stats": {
                "total_donations": total_donations,
                "total_amount": round(total_amount, 2),
                "average_donation": round(total_amount / total_donations if total_donations > 0 else 0, 2),
                "month_donations": month_donations,
                "month_amount": round(month_amount, 2),
                "week_donations": week_donations,
                "week_amount": round(week_amount, 2)
            }
        }
    except Exception as e:
        logger.error(f"Error getting donations stats: {e}")
        return {"success": False, "error": str(e)}
