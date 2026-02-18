"""
VK Live API Integration (Refactored)
Facade class inheriting from modular components.
"""
import logging

# Standard and Third-party imports for Facade and Router
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Project imports
from api.vk.vk_auth import VKAuth
from api.vk.vk_stream import VKStream
from api.vk.vk_rewards import VKRewards
from core.database import get_db
from auth.auth import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)

class VKLiveAPI(VKRewards, VKStream, VKAuth):
    """
    Main VK Live API class acting as a facade.
    Inherits methods from:
    - VKAuth: Authentication and User Info
    - VKStream: Stream management and Categories
    - VKRewards: Channel Points and Rewards
    
    Order of inheritance matters:
    VKRewards and VKStream rely on VKAuth (or VKBase), which is at the end of MRO relative to specific methods.
    Since they don't override each other's methods, the order here is flexible.
    """
    def __init__(self):
        super().__init__()
        self.live_base_url = self.BASE_URL # Backward compatibility if accessed directly
        # rate_limiter and ssl_context are initialized in VKBase.__init__ (called via super)

# Create global instance
vk_api = VKLiveAPI()

# ============================================================================
# FastAPI Routers for VK Live API
# ============================================================================

router = APIRouter(prefix="/api/vk", tags=["vk"])

class UpdateCategoryRequest(BaseModel):
    categoryId: str

class UpdateTitleRequest(BaseModel):
    title: str

@router.post("/update-category")
async def update_vk_category(
    request: UpdateCategoryRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update VK Live stream category"""
    try:
        user_id = str(current_user.get('id'))
        session_id = current_user.get('session_id')
        category_id = request.categoryId

        logger.info(f"[REFRESH] Updating VK category for user {user_id} to {category_id}")

        result = await vk_api.update_stream_category(user_id, category_id, session_id)

        if result:
            return JSONResponse(content={"success": True, "message": "Р В РЎв„ўР В Р’В°Р РЋРІР‚С™Р В Р’ВµР В РЎвЂ“Р В РЎвЂўР РЋР вЂљР В РЎвЂР РЋР РЏ Р РЋРЎвЂњР РЋР С“Р В РЎвЂ”Р В Р’ВµР РЋРІвЂљВ¬Р В Р вЂ¦Р В РЎвЂў Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В Р’В°"})
        else:
            raise HTTPException(status_code=400, detail="Р В РЎСљР В Р’Вµ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂўР РЋР С“Р РЋР Р‰ Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂќР В Р’В°Р РЋРІР‚С™Р В Р’ВµР В РЎвЂ“Р В РЎвЂўР РЋР вЂљР В РЎвЂР РЋР вЂ№")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error updating VK category")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/update-title")
async def update_vk_title(
    request: UpdateTitleRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update VK Live stream title"""
    try:
        user_id = str(current_user.get('id'))
        session_id = current_user.get('session_id')
        title = request.title

        logger.info(f"[REFRESH] Updating VK title for user {user_id} to '{title}'")

        result = await vk_api.update_stream_title(user_id, title, session_id)

        if result:
            return JSONResponse(content={"success": True, "message": "Р В РЎСљР В Р’В°Р В Р’В·Р В Р вЂ Р В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ Р РЋРЎвЂњР РЋР С“Р В РЎвЂ”Р В Р’ВµР РЋРІвЂљВ¬Р В Р вЂ¦Р В РЎвЂў Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂў"})
        else:
            raise HTTPException(status_code=400, detail="Р В РЎСљР В Р’Вµ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂўР РЋР С“Р РЋР Р‰ Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р В Р вЂ¦Р В Р’В°Р В Р’В·Р В Р вЂ Р В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error updating VK title")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/categories")
async def get_vk_categories(
    search: str = "",
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get VK Live categories list"""
    try:
        user_id = current_user.get('id') if current_user else None
        session_id = current_user.get('session_id') if current_user else None

        logger.info(f"[VK CATEGORIES] Fetching for user {user_id} with search: '{search}'")

        # Helper to get VK token through repository
        from repositories.user_token_repository import UserTokenRepository
        
        token_repo = UserTokenRepository(db)
        user_token = None
        
        if user_id:
            user_token = token_repo.get_by_user_and_platform(user_id, 'vk')
        
        # Fallback: get first available VK token
        if not user_token or not user_token.access_token:
            user_token = token_repo.get_first_by_platform('vk')

        if not user_token or not user_token.access_token:
            logger.warning("[ERROR] [VK CATEGORIES] No VK token available")
            raise HTTPException(status_code=503, detail="No VK token found")
            
        # If we are using a random token, we pass user_id as that token's owner ID to refresh it if needed
        token_owner_id = str(user_token.user_id)
        
        # Call API using the token owner's ID for auth context
        categories = await vk_api.get_categories(search=search, user_id=token_owner_id, session_id=session_id)

        logger.info(f"[OK] [VK CATEGORIES] Found {len(categories)} categories")

        return JSONResponse(
            content={"success": True, "categories": categories},
            status_code=200
        )

    except HTTPException:
        raise
    except Exception:
        logger.exception("[ERROR] [VK CATEGORIES] Error")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/stream-info")
async def get_vk_stream_info(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get VK Live stream info"""
    try:
        user_id = str(current_user.get('id'))
        session_id = current_user.get('session_id')

        stream_info = await vk_api.get_stream_info(user_id, session_id)

        if stream_info:
            return JSONResponse(content=stream_info)
        raise HTTPException(status_code=404, detail="VK stream info not found")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting VK stream info")
        raise HTTPException(status_code=500, detail="Internal server error")

