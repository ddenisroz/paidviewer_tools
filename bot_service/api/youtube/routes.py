# bot_service/api/youtube/routes.py


from fastapi import APIRouter, Depends, HTTPException


from sqlalchemy.orm import Session


from typing import Optional


from pydantic import BaseModel


import logging


import time


import sys


import os





from core.database import get_db


# [Modified Import] Use services.youtube


from services.youtube.queue_service import QueueService
from repositories.command_repository import CommandRepository
from bots.command_handlers.song_request_handler import SkipHandler


from services.youtube.youtube_service import YouTubeService


from utils.enhanced_logger import log_request, log_response


from core.connection_manager import get_connection_manager


from auth.auth import get_current_user, get_current_user_optional





logger = logging.getLogger('bot_service')





# РЎРѕР·РґР°РµРј СЂРѕСѓС‚РµСЂ РґР»СЏ YouTube API


youtube_router = APIRouter(prefix="/api/youtube", tags=["youtube"])





# Pydantic РјРѕРґРµР»Рё РґР»СЏ API


class AddVideoRequest(BaseModel):


    video_url: str


    is_paid: Optional[bool] = False


    points_cost: Optional[int] = None





class QueueResponse(BaseModel):


    id: int


    video_id: str


    title: str


    duration: Optional[str]


    thumbnail_url: Optional[str]


    url: str


    channel_name: str


    platform: str


    requester_name: str


    position: int


    is_paid: bool


    points_cost: Optional[int]


    added_at: Optional[str]


    played_at: Optional[str] = None





class QueueManagementRequest(BaseModel):


    queue_id: int





# РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј СЃРµСЂРІРёСЃС‹


queue_service = QueueService()


youtube_service = YouTubeService()





# Р’СЃРїРѕРјРѕРіР°С‚РµР»СЊРЅР°СЏ С„СѓРЅРєС†РёСЏ РґР»СЏ РѕС‚РїСЂР°РІРєРё WebSocket СѓРІРµРґРѕРјР»РµРЅРёР№


async def notify_queue_update(user_id: int = None, session_id: str = None, db: Session = None):


    """РћС‚РїСЂР°РІР»СЏРµС‚ WebSocket СѓРІРµРґРѕРјР»РµРЅРёРµ РѕР± РѕР±РЅРѕРІР»РµРЅРёРё РѕС‡РµСЂРµРґРё"""


    try:


        connection_manager = get_connection_manager()


        queue_items = queue_service.get_queue(user_id=user_id, session_id=session_id, db=db)





        # РћРїСЂРµРґРµР»СЏРµРј РїРѕР»СѓС‡Р°С‚РµР»СЏ СѓРІРµРґРѕРјР»РµРЅРёСЏ


        target_id = str(user_id) if user_id else session_id





        await connection_manager.send_to_user(


            target_id,


            {


                "type": "youtube_queue_update",


                "queue": queue_items,


                "timestamp": time.time()


            }


        )


        logger.debug(f"[YOUTUBE] Sent youtube_queue_update to {target_id}")


    except Exception as e:


        logger.error(f"Error sending youtube_queue_update: {e}")





@youtube_router.post("/queue/add")


async def add_video_to_queue(


    request: AddVideoRequest,


    user: dict = Depends(get_current_user_optional),


    db: Session = Depends(get_db)


):


    """Р”РѕР±Р°РІР»РµРЅРёРµ РІРёРґРµРѕ РІ РѕС‡РµСЂРµРґСЊ (С‚РѕР»СЊРєРѕ РґР»СЏ Р°РІС‚РѕСЂРёР·РѕРІР°РЅРЅС‹С… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№)"""


    user_id = user.get('id')


    if not user_id or user_id <= 0:


        raise HTTPException(status_code=401, detail="Authentication required")





    log_request("/youtube/queue/add", "POST", {"video_url": request.video_url}, user_id)


    start_time = time.time()





    # [OK] VALIDATION: РџСЂРѕРІРµСЂСЏРµРј YouTube URL РёР»Рё РІС‹РїРѕР»РЅСЏРµРј РїРѕРёСЃРє РїРѕ Р·Р°РїСЂРѕСЃСѓ


    from validators.youtube_validators import validate_youtube_url





    video_input = (request.video_url or "").strip()


    if len(video_input) < 2:


        raise HTTPException(status_code=400, detail="Search query is too short")





    is_valid, video_id, error = validate_youtube_url(video_input)


    if not is_valid:


        pending_queue = queue_service.get_queue(user_id=user_id, session_id=None, db=db)


        pending_ids = {item.get("video_id") for item in pending_queue if item.get("video_id")}


        search_results = await youtube_service.search_videos(video_input, max_results=5)


        if not search_results:


            logger.warning(


                f"[ERROR] [YOUTUBE] Search returned no results: {video_input}, user: {user_id}"


            )


            raise HTTPException(status_code=400, detail="No videos found for this query")


        selected_url = None


        for candidate in search_results:


            candidate_id = candidate.get("video_id")


            candidate_url = candidate.get("url")


            if not candidate_id or not candidate_url:


                continue


            if candidate_id in pending_ids:


                continue


            selected_url = candidate_url


            break


        if not selected_url:


            raise HTTPException(status_code=400, detail="??? ????????? ????? ??? ? ???????. ???????? ??????.")


        video_input = selected_url


        is_valid, video_id, error = validate_youtube_url(video_input)


        if not is_valid:


            logger.warning(


                f"[ERROR] [YOUTUBE] Invalid URL after search: {video_input}, "


                f"user: {user_id}, error: {error}"


            )


            raise HTTPException(status_code=400, detail=f"Invalid YouTube URL: {error}")





    logger.debug(f"[OK] [YOUTUBE] Valid URL: {video_input} в†’ video_id: {video_id}")





    # [OK] RATE LIMITING: РџСЂРѕРІРµСЂСЏРµРј РєРѕР»РёС‡РµСЃС‚РІРѕ РІРёРґРµРѕ РІ РѕС‡РµСЂРµРґРё (РјР°РєСЃ 10)


    from constants import MAX_YOUTUBE_QUEUE_SIZE


    current_queue = queue_service.get_queue(user_id=user_id, session_id=None, db=db)





    if len(current_queue) >= MAX_YOUTUBE_QUEUE_SIZE:


        logger.warning(


            f"[ERROR] [YOUTUBE] Queue full: user={user_id}, "


            f"current={len(current_queue)}, max={MAX_YOUTUBE_QUEUE_SIZE}"


        )


        raise HTTPException(


            status_code=400,


            detail=f"Queue is full (max {MAX_YOUTUBE_QUEUE_SIZE} videos). Please remove some videos first."


        )





    try:


        # Р’СЂРµРјРµРЅРЅРѕ РёСЃРїРѕР»СЊР·СѓРµРј Р·Р°РіР»СѓС€РєРё РґР»СЏ requester info


        # Р’ СЂРµР°Р»СЊРЅРѕР№ СЃРёСЃС‚РµРјРµ СЌС‚Рѕ Р±СѓРґРµС‚ РёР· СЃРµСЃСЃРёРё/С‡Р°С‚Р°


        result = await queue_service.add_video_to_queue(


            user_id=user_id,


            session_id=None,


            video_url=video_input,


            channel_name="web_interface",  # Р”РѕР±Р°РІР»РµРЅРѕ С‡РµСЂРµР· РІРµР±-РёРЅС‚РµСЂС„РµР№СЃ


            platform="web",


            requester_name=f"User_{user_id}",


            requester_id=str(user_id),


            is_paid=request.is_paid,


            points_cost=request.points_cost,


            db=db


        )





        if result["success"]:


            # РћС‚РїСЂР°РІР»СЏРµРј WebSocket СѓРІРµРґРѕРјР»РµРЅРёРµ РѕР± РѕР±РЅРѕРІР»РµРЅРёРё РѕС‡РµСЂРµРґРё


            await notify_queue_update(user_id=user_id, session_id=None, db=db)





            response = {


                "success": True,


                "message": "Р’РёРґРµРѕ РґРѕР±Р°РІР»РµРЅРѕ РІ РѕС‡РµСЂРµРґСЊ",


                "queue_item": result["queue_item"]


            }


            log_response("/youtube/queue/add", 200, response, time.time() - start_time)


            return response


        else:


            log_response("/youtube/queue/add", 400, {"error": result["error"]}, time.time() - start_time)


            raise HTTPException(status_code=400, detail=result["error"])

    except HTTPException:
        raise
    except Exception as e:


        logger.error(f"Error adding video to queue via API: {e}")


        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РґРѕР±Р°РІР»РµРЅРёСЏ РІРёРґРµРѕ")





@youtube_router.get("/queue")


async def get_queue(


    user: dict = Depends(get_current_user_optional),


    db: Session = Depends(get_db)


):


    """РџРѕР»СѓС‡РµРЅРёРµ РѕС‡РµСЂРµРґРё РІРёРґРµРѕ СЃ С‚РµРєСѓС‰РёРј РІРѕСЃРїСЂРѕРёР·РІРѕРґСЏС‰РёРјСЃСЏ РІРёРґРµРѕ (С‚РѕР»СЊРєРѕ РґР»СЏ Р°РІС‚РѕСЂРёР·РѕРІР°РЅРЅС‹С…)"""


    try:


        if not user:


            raise HTTPException(status_code=401, detail="Authentication required")


        user_id = user.get('id')


        if not user_id or user_id <= 0:


            raise HTTPException(status_code=401, detail="Authentication required")





        queue_items = queue_service.get_queue(user_id=user_id, session_id=None, db=db)





        # РўРµРєСѓС‰РµРµ РІРёРґРµРѕ - РїРµСЂРІРѕРµ РІ РѕС‡РµСЂРµРґРё (РІСЃРµ СѓР¶Рµ РѕС‚С„РёР»СЊС‚СЂРѕРІР°РЅС‹ РїРѕ status='pending')


        current_video = queue_items[0] if queue_items and len(queue_items) > 0 else None





        logger.debug(f"[QUEUE] User {user_id}: {len(queue_items)} videos, current: {current_video['title'] if current_video else 'None'}")





        skip_votes_required = 1
        try:
            cmd_repo = CommandRepository(db)
            override = cmd_repo.get_override_by_name('skip', user_id)
            if override and override.extra_settings:
                skip_votes_required = override.extra_settings.get('skip_votes_required', 1)
        except Exception as e:
            logger.debug(f"[QUEUE] Skip votes override lookup failed: {e}")

        skip_votes = None
        if current_video:
            video_id = current_video.get('id') or current_video.get('video_id')
            votes_map = SkipHandler._skip_votes.get(user_id, {})
            current_votes = len(votes_map.get(video_id, set())) if video_id in votes_map else 0
            skip_votes = {
                "current": current_votes,
                "required": skip_votes_required,
                "video_id": video_id
            }

        return {
            "queue": queue_items,
            "current_video": current_video,
            "is_playing": current_video is not None,
            "skip_votes": skip_votes
        }





    except HTTPException:


        raise


    except Exception as e:


        logger.error(f"Error getting queue via API: {e}")


        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РѕС‡РµСЂРµРґРё")





@youtube_router.get("/queue/next")


async def get_next_video(


    user: dict = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """РџРѕР»СѓС‡РµРЅРёРµ СЃР»РµРґСѓСЋС‰РµРіРѕ РІРёРґРµРѕ РІ РѕС‡РµСЂРµРґРё"""


    try:


        next_video = queue_service.get_next_video(user["id"], db)





        if next_video:


            return {


                "success": True,


                "video": next_video


            }


        else:


            return {


                "success": False,


                "message": "РћС‡РµСЂРµРґСЊ РїСѓСЃС‚Р°"


            }





    except Exception as e:


        logger.error(f"Error getting next video via API: {e}")


        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ СЃР»РµРґСѓСЋС‰РµРіРѕ РІРёРґРµРѕ")





@youtube_router.post("/player/next")


async def skip_to_next_video(


    user: dict = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """РџСЂРѕРїСѓСЃС‚РёС‚СЊ С‚РµРєСѓС‰РµРµ РІРёРґРµРѕ Рё РїРµСЂРµР№С‚Рё Рє СЃР»РµРґСѓСЋС‰РµРјСѓ"""


    try:


        # РџРѕР»СѓС‡Р°РµРј С‚РµРєСѓС‰СѓСЋ РѕС‡РµСЂРµРґСЊ


        queue_items = queue_service.get_queue(user_id=user["id"], db=db)





        if not queue_items or len(queue_items) == 0:


            return {


                "success": False,


                "message": "РћС‡РµСЂРµРґСЊ РїСѓСЃС‚Р°",


                "current_video": None


            }





        # РџРµСЂРІРѕРµ РІРёРґРµРѕ РІ РѕС‡РµСЂРµРґРё - СЌС‚Рѕ С‚РµРєСѓС‰РµРµ, РѕС‚РјРµС‡Р°РµРј РµРіРѕ РєР°Рє РїСЂРѕРёРіСЂР°РЅРЅРѕРµ


        current_video_id = queue_items[0]['id']


        success = queue_service.mark_as_played(user["id"], current_video_id, db)





        if not success:


            raise HTTPException(status_code=404, detail="РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РјРµС‚РёС‚СЊ РІРёРґРµРѕ РєР°Рє РїСЂРѕРёРіСЂР°РЅРЅРѕРµ")





        # РџРѕР»СѓС‡Р°РµРј СЃР»РµРґСѓСЋС‰РµРµ РІРёРґРµРѕ (С‚РµРїРµСЂСЊ РѕРЅРѕ РїРµСЂРІРѕРµ РІ РѕС‡РµСЂРµРґРё)


        updated_queue = queue_service.get_queue(user_id=user["id"], db=db)


        current_video = updated_queue[0] if updated_queue and len(updated_queue) > 0 else None





        # РћС‚РїСЂР°РІР»СЏРµРј WebSocket СѓРІРµРґРѕРјР»РµРЅРёРµ РѕР± РѕР±РЅРѕРІР»РµРЅРёРё РѕС‡РµСЂРµРґРё


        await notify_queue_update(user["id"], db=db)





        return {


            "success": True,


            "message": "РџРµСЂРµС…РѕРґ Рє СЃР»РµРґСѓСЋС‰РµРјСѓ РІРёРґРµРѕ",


            "current_video": current_video


        }





    except HTTPException:


        raise


    except Exception as e:


        logger.error(f"Error skipping to next video via API: {e}")


        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РїРµСЂРµС…РѕРґР° Рє СЃР»РµРґСѓСЋС‰РµРјСѓ РІРёРґРµРѕ")







@youtube_router.post("/queue/play/{queue_id}")

async def play_queue_item(

    queue_id: int,

    user: dict = Depends(get_current_user),

    db: Session = Depends(get_db)

):

    """Skip ahead to selected queue item and start playing it."""

    try:

        success = queue_service.cut_to_item(user["id"], queue_id, db)

        if not success:

            raise HTTPException(status_code=404, detail="Video not found in queue")



        updated_queue = queue_service.get_queue(user_id=user["id"], db=db)

        current_video = updated_queue[0] if updated_queue and len(updated_queue) > 0 else None

        await notify_queue_update(user["id"], db=db)



        return {

            "success": True,

            "current_video": current_video

        }

    except HTTPException:

        raise

    except Exception as e:

        logger.error(f"Error moving queue item to top via API: {e}")

        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РїСЂРё РїРµСЂРµРєР»СЋС‡РµРЅРёРё РІРёРґРµРѕ")

@youtube_router.post("/queue/ban/{queue_id}")
async def ban_queue_item(
    queue_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ban a video and remove it from the queue."""
    try:
        result = queue_service.ban_video(user["id"], queue_id, db)
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error", "Video not found in queue"))

        await notify_queue_update(user["id"], db=db)

        return {
            "success": True,
            "message": "Video banned",
            "video_id": result.get("video_id"),
            "banned_count": result.get("banned_count", 0)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error banning video: {e}")
        raise HTTPException(status_code=500, detail="Failed to ban video")

@youtube_router.delete("/queue/remove/{queue_id}")


async def remove_from_queue(


    queue_id: int,


    user: dict = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """РЈРґР°Р»РµРЅРёРµ РІРёРґРµРѕ РёР· РѕС‡РµСЂРµРґРё"""


    try:


        success = queue_service.remove_from_queue(user["id"], queue_id, db)





        if success:


            # РћС‚РїСЂР°РІР»СЏРµРј WebSocket СѓРІРµРґРѕРјР»РµРЅРёРµ РѕР± РѕР±РЅРѕРІР»РµРЅРёРё РѕС‡РµСЂРµРґРё


            await notify_queue_update(user["id"], db)





            return {


                "success": True,


                "message": "Р’РёРґРµРѕ СѓРґР°Р»РµРЅРѕ РёР· РѕС‡РµСЂРµРґРё"


            }


        else:


            raise HTTPException(status_code=404, detail="Р’РёРґРµРѕ РЅРµ РЅР°Р№РґРµРЅРѕ РІ РѕС‡РµСЂРµРґРё")





    except Exception as e:


        logger.error(f"Error removing video from queue via API: {e}")


        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ РІРёРґРµРѕ")





@youtube_router.delete("/queue/clear")


@youtube_router.post("/clear")  # Alias РґР»СЏ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё СЃ frontend


async def clear_queue(


    user: dict = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """РћС‡РёСЃС‚РєР° РІСЃРµР№ РѕС‡РµСЂРµРґРё"""


    try:


        cleared_count = queue_service.clear_queue(user["id"], db)





        # РћС‚РїСЂР°РІР»СЏРµРј WebSocket СѓРІРµРґРѕРјР»РµРЅРёРµ РѕР± РѕР±РЅРѕРІР»РµРЅРёРё РѕС‡РµСЂРµРґРё


        await notify_queue_update(user["id"], db)





        return {


            "success": True,


            "message": f"РћС‡РµСЂРµРґСЊ РѕС‡РёС‰РµРЅР° ({cleared_count} РІРёРґРµРѕ СѓРґР°Р»РµРЅРѕ)"


        }





    except Exception as e:


        logger.error(f"Error clearing queue via API: {e}")


        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РѕС‡РёСЃС‚РєРё РѕС‡РµСЂРµРґРё")





@youtube_router.post("/queue/mark-played/{queue_id}")


async def mark_as_played(


    queue_id: int,


    user: dict = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """РћС‚РјРµС‚РёС‚СЊ РІРёРґРµРѕ РєР°Рє РїСЂРѕРёРіСЂР°РЅРЅРѕРµ"""


    try:


        success = queue_service.mark_as_played(user["id"], queue_id, db)





        if success:


            # РћС‚РїСЂР°РІР»СЏРµРј WebSocket СѓРІРµРґРѕРјР»РµРЅРёРµ РѕР± РѕР±РЅРѕРІР»РµРЅРёРё РѕС‡РµСЂРµРґРё


            await notify_queue_update(user["id"], db)





            return {


                "success": True,


                "message": "Р’РёРґРµРѕ РѕС‚РјРµС‡РµРЅРѕ РєР°Рє РїСЂРѕРёРіСЂР°РЅРЅРѕРµ"


            }


        else:


            raise HTTPException(status_code=404, detail="Р’РёРґРµРѕ РЅРµ РЅР°Р№РґРµРЅРѕ РІ РѕС‡РµСЂРµРґРё")





    except Exception as e:


        logger.error(f"Error marking video as played via API: {e}")


        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ СЃС‚Р°С‚СѓСЃР° РІРёРґРµРѕ")





@youtube_router.get("/video-info")


async def get_video_info(video_url: str):


    """РџРѕР»СѓС‡РµРЅРёРµ РёРЅС„РѕСЂРјР°С†РёРё Рѕ YouTube РІРёРґРµРѕ"""


    try:


        if not youtube_service.is_valid_youtube_url(video_url):


            raise HTTPException(status_code=400, detail="РќРµРІРµСЂРЅС‹Р№ YouTube URL")





        video_info = await youtube_service.get_video_info(video_url)





        if video_info:


            return {


                "success": True,


                "video_info": video_info


            }


        else:


            raise HTTPException(status_code=404, detail="РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ РІРёРґРµРѕ")





    except HTTPException:


        raise


    except Exception as e:


        logger.error(f"Error getting video info via API: {e}")


        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РёРЅС„РѕСЂРјР°С†РёРё Рѕ РІРёРґРµРѕ")





@youtube_router.get("/search")


async def search_youtube_videos(


    query: str = None,


    platform: str = "youtube",


    user: dict = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """РџРѕРёСЃРє YouTube РІРёРґРµРѕ РїРѕ РЅР°Р·РІР°РЅРёСЋ РёР»Рё РїРѕРїСѓР»СЏСЂРЅС‹Рј РІРёРґРµРѕ"""


    log_request("/youtube/search", "GET", {"query": query}, user.get('id'))


    start_time = time.time()





    try:


        if not query or len(query.strip()) < 2:


            # Р’РѕР·РІСЂР°С‰Р°РµРј СЃРїРёСЃРѕРє РїРѕРїСѓР»СЏСЂРЅС‹С… РІРёРґРµРѕ РµСЃР»Рё РЅРµС‚ РїРѕРёСЃРєР°


            response = {


                "success": True,


                "results": [


                    {


                        "video_id": "dQw4w9WgXcQ",


                        "title": "Rick Astley - Never Gonna Give You Up (Video)",


                        "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",


                        "channel": "Rick Astley Official",


                        "duration": "3:33",


                        "views": "1.2B"


                    },


                    {


                        "video_id": "jNQXAC9IVRw",


                        "title": "Me at the zoo",


                        "thumbnail": "https://img.youtube.com/vi/jNQXAC9IVRw/mqdefault.jpg",


                        "channel": "jawed",


                        "duration": "0:18",


                        "views": "300M"


                    }


                ],


                "count": 2


            }


            log_response("/youtube/search", 200, response, time.time() - start_time)


            return response





        # РСЃРїРѕР»СЊР·СѓРµРј yt-dlp РґР»СЏ РїРѕРёСЃРєР° (Р±РµР· СЃРєР°С‡РёРІР°РЅРёСЏ)


        import yt_dlp





        ydl_opts = {


            'quiet': True,


            'no_warnings': True,


            'default_search': 'ytsearch5',  # РС‰РµРј 5 СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ


            'extract_flat': True,


            'skip_download': True,


        }





        search_results = []


        try:


            with yt_dlp.YoutubeDL(ydl_opts) as ydl:


                info = ydl.extract_info(query, download=False)





                if 'entries' in info:


                    for entry in info['entries'][:5]:


                        if entry.get('id'):


                            search_results.append({


                                "video_id": entry.get('id'),


                                "title": entry.get('title', 'Unknown'),


                                "thumbnail": entry.get('thumbnail', f"https://img.youtube.com/vi/{entry.get('id')}/mqdefault.jpg"),


                                "channel": entry.get('uploader', 'Unknown'),


                                "duration": entry.get('duration', 'Unknown'),


                                "url": f"https://www.youtube.com/watch?v={entry.get('id')}"


                            })


        except Exception as yt_error:


            logger.warning(f"yt-dlp search failed: {yt_error}, using fallback")


            # Fallback: РІРѕР·РІСЂР°С‰Р°РµРј РїСѓСЃС‚РѕР№ СЂРµР·СѓР»СЊС‚Р°С‚


            search_results = []





        response = {


            "success": True,


            "results": search_results,


            "count": len(search_results),


            "query": query


        }





        log_response("/youtube/search", 200, response, time.time() - start_time)


        return response





    except Exception as e:


        logger.error(f"Error searching YouTube: {e}")


        log_response("/youtube/search", 500, {"error": "Internal server error"}, time.time() - start_time)


        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РїРѕРёСЃРєР° РІРёРґРµРѕ YouTube")





