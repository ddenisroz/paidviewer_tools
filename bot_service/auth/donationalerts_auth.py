"""
DonationAlerts OAuth авторизация
"""
import httpx
import logging
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from core.database import get_db, UserToken
from core.datetime_utils import utcnow_naive
from core.config import settings
from auth.auth import get_current_user_optional
from core.security_modern import limiter

logger = logging.getLogger(__name__)

router = APIRouter()

# DonationAlerts OAuth настройки из централизованной конфигурации
DA_CLIENT_ID = settings.donationalerts_client_id
DA_CLIENT_SECRET = settings.donationalerts_client_secret
DA_REDIRECT_URI = settings.donationalerts_redirect_uri
FRONTEND_URL = settings.frontend_url

# Проверяем настройки DonationAlerts (только warning, не raise - для dev окружения)
if not DA_CLIENT_ID:
    logger.warning("DONATIONALERTS_CLIENT_ID not configured - DonationAlerts integration disabled")

if not DA_CLIENT_SECRET:
    logger.warning("DONATIONALERTS_CLIENT_SECRET not configured - DonationAlerts integration disabled")

@router.get("/auth/donationalerts/callback")
@limiter.limit("20/minute")
async def donationalerts_callback(
    request: Request,
    code: str = None,
    error: str = None,
    error_description: str = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_optional)
):
    """DonationAlerts OAuth callback"""

    logger.info("=" * 80)
    logger.info("[NOTIFY] DONATIONALERTS CALLBACK FUNCTION CALLED!")
    logger.info(f"[NOTIFY] DA callback URL: {request.url}")
    logger.info(f"[NOTIFY] DA callback cookies: {list(request.cookies.keys())}")
    logger.info("=" * 80)

    # Обработка отмены авторизации
    if error:
        logger.warning(f"DonationAlerts OAuth cancelled: {error} - {error_description}")
        return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?auth_error=cancelled")

    # Проверяем наличие кода авторизации
    if not code:
        logger.error("No authorization code received from DonationAlerts")
        raise HTTPException(status_code=400, detail="No authorization code received")

    # Проверяем настройки
    if not all([DA_CLIENT_ID, DA_CLIENT_SECRET, DA_REDIRECT_URI]):
        logger.error("DonationAlerts credentials not configured")
        raise HTTPException(status_code=500, detail="DonationAlerts integration is not configured")

    # Для DonationAlerts callback пользователь может быть не авторизован в сессии
    # потому что callback приходит от внешнего сервиса
    # Поддерживаем гостей (user_id = -1) и авторизованных пользователей
    user_id = None
    session_id = None
    is_guest = False

    if current_user and current_user.get('id'):
        if current_user.get('id') > 0:
            user_id = current_user.get('id')
            logger.info(f"DonationAlerts callback for authenticated user {user_id}")
        elif current_user.get('id') == -1:
            is_guest = True
            session_id = current_user.get('session_id')
            logger.info(f"DonationAlerts callback for guest session {session_id}")
        else:
            logger.error("Invalid user_id in session")
            return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?auth_error=invalid_session")
    else:
        logger.info("DonationAlerts callback without authenticated session")
        return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?auth_error=not_authenticated")

    try:
        user_identifier = f"guest {session_id}" if is_guest else f"user {user_id}"
        logger.info(f"DonationAlerts callback for {user_identifier}, code: {code[:10]}...")

        # 1. Обмен кода на токен
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Используем Basic Auth для DonationAlerts OAuth
            import base64
            credentials = f"{DA_CLIENT_ID}:{DA_CLIENT_SECRET}"
            base64_credentials = base64.b64encode(credentials.encode()).decode()

            token_response = await client.post(
                "https://www.donationalerts.com/oauth/token",
                data={
                    "grant_type": "authorization_code",
                    "redirect_uri": DA_REDIRECT_URI,
                    "code": code
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": f"Basic {base64_credentials}"
                }
            )

            if token_response.status_code != 200:
                error_data = token_response.json() if token_response.headers.get('content-type') == 'application/json' else token_response.text
                logger.error(f"DonationAlerts token exchange failed: {token_response.status_code} - {error_data}")
                raise HTTPException(
                    status_code=token_response.status_code,
                    detail="Failed to get access token"
                )

            token_data = token_response.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")

            if not access_token:
                raise HTTPException(status_code=500, detail="No access token in response")

            logger.info(f"[OK] DonationAlerts access token received for user {user_id}")

            # 2. Получаем информацию о пользователе
            user_info_response = await client.get(
                "https://www.donationalerts.com/api/v1/user/oauth",
                headers={"Authorization": f"Bearer {access_token}"}
            )

            if user_info_response.status_code != 200:
                logger.error(f"Failed to get user info: {user_info_response.status_code}")
                raise HTTPException(status_code=500, detail="Failed to get user info")

            user_info = user_info_response.json()
            da_user_id = str(user_info.get("data", {}).get("id"))
            da_username = user_info.get("data", {}).get("name")

            logger.info(f"DonationAlerts user: {da_username} (ID: {da_user_id})")

            # 3. Сохраняем токен (для гостей используем session_id, для авторизованных - user_id)
            # Проверяем, существует ли уже токен
            if is_guest:
                existing_token = db.query(UserToken).filter(
                    UserToken.session_id == session_id,
                    UserToken.platform == "donationalerts"
                ).first()
            else:
                existing_token = db.query(UserToken).filter(
                    UserToken.user_id == user_id,
                    UserToken.platform == "donationalerts"
                ).first()

            if existing_token:
                # Обновляем существующий токен
                existing_token.access_token = access_token
                existing_token.refresh_token = refresh_token
                existing_token.platform_user_id = da_user_id
                existing_token.is_active = True  # Активируем токен при повторной авторизации
                existing_token.updated_at = utcnow_naive()
                logger.info(f"[OK] Updated DonationAlerts token for {user_identifier}")
            else:
                # Создаем новый токен
                new_token = UserToken(
                    user_id=user_id if not is_guest else None,
                    session_id=session_id if is_guest else None,
                    platform="donationalerts",
                    platform_user_id=da_user_id,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    avatar_url=None,
                    scopes=["oauth-user-show", "oauth-donation-subscribe", "oauth-donation-index"]
                )
                db.add(new_token)
                logger.info(f"[OK] Created DonationAlerts token for {user_identifier}")

            db.commit()

            # 4. Редиректим на дашборд
            logger.info(f"[OK] DonationAlerts integration completed for {user_identifier}")
            return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?da_connected=true")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in DonationAlerts callback: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Authentication failed")

