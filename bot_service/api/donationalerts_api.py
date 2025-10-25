# bot_service/api/donationalerts_api.py
"""API для DonationAlerts"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db, User
from auth.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/donationalerts", tags=["donationalerts"])

@router.get("/status")
async def get_donationalerts_status(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статус DonationAlerts"""
    try:
        from core.database import UserToken
        
        user_id = user.get('id')
        
        # Проверяем наличие токена DonationAlerts
        token = db.query(UserToken).filter(
            UserToken.user_id == user_id,
            UserToken.platform == "donationalerts",
            UserToken.is_active == True
        ).first()
        
        if token:
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
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Подключить DonationAlerts"""
    try:
        import os
        
        # Получаем настройки из .env
        client_id = os.getenv("DONATIONALERTS_CLIENT_ID")
        redirect_uri = os.getenv("DONATIONALERTS_REDIRECT_URI")
        
        # Проверяем настройки
        if not client_id:
            logger.error("DONATIONALERTS_CLIENT_ID not set in environment variables")
            return {"success": False, "error": "DonationAlerts integration is not configured"}
        
        if not redirect_uri:
            redirect_uri = "http://localhost:8000/auth/donationalerts/callback"
            logger.warning("DONATIONALERTS_REDIRECT_URI not set, using default value")
        
        # Формируем URL авторизации
        from urllib.parse import urlencode
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "oauth-user-show oauth-donation-subscribe oauth-donation-index"
        }
        auth_url = f"https://www.donationalerts.com/oauth/authorize?{urlencode(params)}"
        
        logger.info(f"DonationAlerts auth URL generated for user {user.get('id')}: {auth_url}")
        
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
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    
    try:
        from core.database import UserToken
        
        user_id = user.get('id')
        
        # Удаляем токен DonationAlerts
        deleted = db.query(UserToken).filter(
            UserToken.user_id == user_id,
            UserToken.platform == "donationalerts"
        ).delete()
        
        db.commit()
        
        logger.info(f"✅ Disconnected DonationAlerts for user {user_id}")
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
        from core.database import DonationAlert
        
        user_id = user.get('id')
        
        # Получаем сумму страниц
        total = db.query(DonationAlert).filter(
            DonationAlert.user_id == user_id
        ).count()
        
        # Получаем донаты с пагинацией
        donations = db.query(DonationAlert).filter(
            DonationAlert.user_id == user_id
        ).order_by(DonationAlert.processed_at.desc()).offset(offset).limit(limit).all()
        
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
        from core.database import DonationAlert
        from sqlalchemy import func
        from datetime import timedelta
        from datetime import datetime as dt
        
        user_id = user.get('id')
        
        # За всё время
        total_donations = db.query(DonationAlert).filter(
            DonationAlert.user_id == user_id
        ).count()
        
        total_amount = db.query(func.sum(DonationAlert.amount)).filter(
            DonationAlert.user_id == user_id
        ).scalar() or 0.0
        
        # За последний месяц
        one_month_ago = dt.utcnow() - timedelta(days=30)
        month_donations = db.query(DonationAlert).filter(
            DonationAlert.user_id == user_id,
            DonationAlert.processed_at > one_month_ago
        ).count()
        
        month_amount = db.query(func.sum(DonationAlert.amount)).filter(
            DonationAlert.user_id == user_id,
            DonationAlert.processed_at > one_month_ago
        ).scalar() or 0.0
        
        # За последнюю неделю
        one_week_ago = dt.utcnow() - timedelta(days=7)
        week_donations = db.query(DonationAlert).filter(
            DonationAlert.user_id == user_id,
            DonationAlert.processed_at > one_week_ago
        ).count()
        
        week_amount = db.query(func.sum(DonationAlert.amount)).filter(
            DonationAlert.user_id == user_id,
            DonationAlert.processed_at > one_week_ago
        ).scalar() or 0.0
        
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
