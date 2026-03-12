"""DonationAlerts OAuth integration."""

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from auth.auth import get_current_user_optional
from core.config import settings
from core.database import UserToken, get_db
from core.datetime_utils import utcnow_naive
from core.security_modern import limiter
from core.token_encryption import encrypt_token

logger = logging.getLogger(__name__)

router = APIRouter()

DA_CLIENT_ID = settings.donationalerts_client_id
DA_CLIENT_SECRET = settings.donationalerts_client_secret
DA_REDIRECT_URI = settings.donationalerts_redirect_uri
FRONTEND_URL = settings.frontend_url


def _redirect_with_state_cleanup(url: str) -> RedirectResponse:
    response = RedirectResponse(url=url)
    response.delete_cookie(
        key="oauth_state_da",
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
    )
    return response


if not DA_CLIENT_ID:
    logger.warning("DONATIONALERTS_CLIENT_ID not configured - DonationAlerts integration disabled")

if not DA_CLIENT_SECRET:
    logger.warning("DONATIONALERTS_CLIENT_SECRET not configured - DonationAlerts integration disabled")


@router.get("/auth/donationalerts/callback")
@limiter.limit("20/minute")
async def donationalerts_callback(
    request: Request,
    code: str = None,
    state: str = None,
    error: str = None,
    error_description: str = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_optional),
):
    """DonationAlerts OAuth callback."""
    logger.info(
        "[NOTIFY] DonationAlerts callback received: path=%s has_code=%s has_error=%s",
        request.url.path,
        bool(code),
        bool(error),
    )

    expected_state = request.cookies.get("oauth_state_da")
    if not state or not expected_state or state != expected_state:
        logger.warning(
            "DonationAlerts OAuth CSRF state mismatch: has_state=%s has_expected_state=%s",
            bool(state),
            bool(expected_state),
        )
        return _redirect_with_state_cleanup(url=f"{FRONTEND_URL}/dashboard?auth_error=invalid_state")

    if error:
        logger.warning("DonationAlerts OAuth cancelled: %s - %s", error, error_description)
        return _redirect_with_state_cleanup(url=f"{FRONTEND_URL}/dashboard?auth_error=cancelled")

    if not code:
        logger.error("No authorization code received from DonationAlerts")
        raise HTTPException(status_code=400, detail="No authorization code received")

    if not all([DA_CLIENT_ID, DA_CLIENT_SECRET, DA_REDIRECT_URI]):
        logger.error("DonationAlerts credentials not configured")
        raise HTTPException(status_code=500, detail="DonationAlerts integration is not configured")

    user_id = current_user.get("id") if current_user else None
    if not user_id or user_id <= 0:
        logger.info("DonationAlerts callback without authenticated session")
        return _redirect_with_state_cleanup(url=f"{FRONTEND_URL}/dashboard?auth_error=not_authenticated")

    try:
        logger.info("DonationAlerts callback for user %s", user_id)

        async with httpx.AsyncClient(timeout=30.0) as client:
            import base64

            credentials = f"{DA_CLIENT_ID}:{DA_CLIENT_SECRET}"
            base64_credentials = base64.b64encode(credentials.encode()).decode()

            token_response = await client.post(
                "https://www.donationalerts.com/oauth/token",
                data={
                    "grant_type": "authorization_code",
                    "redirect_uri": DA_REDIRECT_URI,
                    "code": code,
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": f"Basic {base64_credentials}",
                },
            )

            if token_response.status_code != 200:
                error_data = (
                    token_response.json()
                    if token_response.headers.get("content-type") == "application/json"
                    else token_response.text
                )
                logger.error(
                    "DonationAlerts token exchange failed: %s - %s",
                    token_response.status_code,
                    error_data,
                )
                raise HTTPException(
                    status_code=token_response.status_code,
                    detail="Failed to get access token",
                )

            token_data = token_response.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")

            if not access_token:
                raise HTTPException(status_code=500, detail="No access token in response")

            logger.info("[OK] DonationAlerts access token received for user %s", user_id)

            user_info_response = await client.get(
                "https://www.donationalerts.com/api/v1/user/oauth",
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if user_info_response.status_code != 200:
                logger.error("Failed to get user info: %s", user_info_response.status_code)
                raise HTTPException(status_code=500, detail="Failed to get user info")

            user_info = user_info_response.json()
            da_user_id = str(user_info.get("data", {}).get("id"))
            da_username = user_info.get("data", {}).get("name")
            logger.info("DonationAlerts user: %s (ID: %s)", da_username, da_user_id)

            existing_token = db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == "donationalerts",
            ).first()

            if existing_token:
                existing_token.access_token = encrypt_token(access_token)
                if refresh_token:
                    existing_token.refresh_token = encrypt_token(refresh_token)
                existing_token.platform_user_id = da_user_id
                existing_token.is_active = True
                existing_token.updated_at = utcnow_naive()
                logger.info("[OK] Updated DonationAlerts token for user %s", user_id)
            else:
                db.add(
                    UserToken(
                        user_id=user_id,
                        session_id=None,
                        platform="donationalerts",
                        platform_user_id=da_user_id,
                        access_token=encrypt_token(access_token),
                        refresh_token=encrypt_token(refresh_token) if refresh_token else None,
                        avatar_url=None,
                        scopes=["oauth-user-show", "oauth-donation-subscribe", "oauth-donation-index"],
                    )
                )
                logger.info("[OK] Created DonationAlerts token for user %s", user_id)

            db.commit()
            logger.info("[OK] DonationAlerts integration completed for user %s", user_id)
            return _redirect_with_state_cleanup(url=f"{FRONTEND_URL}/dashboard?da_connected=true")

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error in DonationAlerts callback: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Authentication failed")

