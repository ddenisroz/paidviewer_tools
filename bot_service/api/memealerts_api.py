"""
MemeAlerts API endpoints for coin grants and OAuth token management
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from core.database import get_db
from auth.auth import get_current_user, get_current_user_optional
from repositories.user_token_repository import UserTokenRepository
import logging
import httpx
import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/memealerts", tags=["memealerts"])

MEMEALERTS_API_BASE = "https://memealerts.com/api"


def decode_memealerts_token(token: str) -> dict:
    """
    Decode MemeAlerts JWT token without verification.
    Returns payload with 'id' (streamer ID), 'scope', 'tid', etc.
    """
    try:
        return jwt.decode(token, options={"verify_signature": False})
    except jwt.DecodeError as e:
        logger.error(f"Failed to decode MemeAlerts token: {e}")
        raise ValueError("Invalid token format")


@router.get("/status")
async def get_memealerts_status(
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Check MemeAlerts connection status"""
    try:
        if not user or not user.get('id'):
            return {"success": True, "connected": False}

        user_id = user.get('id')
        token_repo = UserTokenRepository(db)
        token = token_repo.get_by_user_and_platform(user_id, "memealerts")

        if token and token.access_token:
            # Try to decode token to get streamer info
            try:
                decoded = decode_memealerts_token(token.access_token)
                return {
                    "success": True, 
                    "connected": True,
                    "streamer_id": decoded.get("id"),
                    "platform_user_id": token.platform_user_id
                }
            except ValueError:
                # Token is invalid, but exists
                return {"success": True, "connected": True}
        
        return {"success": True, "connected": False}
    except Exception as e:
        logger.error(f"Error getting MemeAlerts status: {e}")
        return {"success": False, "error": str(e)}


@router.post("/connect")
async def connect_memealerts(
    token_data: dict = Body(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save MemeAlerts token obtained from popup OAuth flow.
    Expects: { access_token: string, refresh_token?: string }
    """
    try:
        user_id = user.get('id')
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")

        if not access_token:
            raise HTTPException(status_code=400, detail="access_token is required")

        # Validate and decode token to extract streamer ID
        try:
            decoded = decode_memealerts_token(access_token)
            streamer_id = decoded.get("id")
            token_scope = decoded.get("scope")
            
            if not streamer_id:
                raise HTTPException(status_code=400, detail="Token does not contain streamer ID")
            
            logger.info(f"MemeAlerts token decoded: streamer_id={streamer_id}, scope={token_scope}")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Optional: Validate token by making a test API call
        # This verifies the token is actually valid and not expired
        # Commenting out for now as we don't know a safe endpoint
        # async with httpx.AsyncClient() as client:
        #     response = await client.get(
        #         f"{MEMEALERTS_API_BASE}/user/me",
        #         headers={"Authorization": f"Bearer {access_token}"}
        #     )
        #     if response.status_code != 200:
        #         raise HTTPException(status_code=400, detail="Token validation failed")

        # Store token in database
        token_repo = UserTokenRepository(db)
        token_repo.upsert_token(
            user_id=user_id,
            platform="memealerts",
            access_token=access_token,
            refresh_token=refresh_token,
            platform_user_id=streamer_id
        )

        logger.info(f"[OK] MemeAlerts connected for user {user_id}, streamer_id={streamer_id}")
        return {"success": True, "connected": True, "streamer_id": streamer_id}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error connecting MemeAlerts: {e}")
        return {"success": False, "error": str(e)}


@router.post("/disconnect")
async def disconnect_memealerts(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove MemeAlerts token"""
    try:
        user_id = user.get('id')
        token_repo = UserTokenRepository(db)
        token_repo.delete_by_user_and_platform(user_id, "memealerts")
        
        logger.info(f"[OK] MemeAlerts disconnected for user {user_id}")
        return {"success": True, "connected": False}
    except Exception as e:
        logger.error(f"Error disconnecting MemeAlerts: {e}")
        return {"success": False, "error": str(e)}


@router.post("/grant")
async def grant_coins(
    grant_data: dict = Body(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Grant MemeCoins to a user.
    Expects: { userId: string, value: number }
    """
    try:
        user_id = user.get('id')
        
        # Get stored token
        token_repo = UserTokenRepository(db)
        token = token_repo.get_by_user_and_platform(user_id, "memealerts")
        
        if not token or not token.access_token:
            raise HTTPException(status_code=401, detail="MemeAlerts not connected")

        # Decode token to get streamer ID
        try:
            decoded = decode_memealerts_token(token.access_token)
            streamer_id = decoded.get("id")
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid stored token format")

        if not streamer_id:
            raise HTTPException(status_code=400, detail="Could not determine streamer ID from token")

        target_user_id = grant_data.get("userId")
        value = grant_data.get("value")

        if not target_user_id or value is None:
            raise HTTPException(status_code=400, detail="userId and value are required")

        # Prepare API request payload
        payload = {
            "userId": target_user_id,
            "streamerId": streamer_id,
            "value": int(value)
        }

        logger.info(f"[MemeAlerts] Granting {value} coins from {streamer_id} to {target_user_id}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{MEMEALERTS_API_BASE}/user/give-bonus",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token.access_token}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code not in (200, 201):
                logger.error(f"MemeAlerts API Error: {response.status_code} - {response.text}")
                return {
                    "success": False, 
                    "error": f"API Error: {response.status_code}", 
                    "detail": response.text
                }

            result = response.json()
            logger.info(f"[OK] MemeAlerts grant successful: {result}")
            return {"success": True, "data": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error granting coins: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
