"""Shared state builder for the public YouTube OBS overlay."""

from __future__ import annotations

import time
from typing import Any

from sqlalchemy.orm import Session

from repositories.tts_settings_repository import TTSSettingsRepository
from services.youtube.queue_service import QueueService
from services.youtube.reward_settings import build_youtube_settings_response


def build_youtube_obs_state(user_id: int, db: Session) -> dict[str, Any]:
    """Return queue and settings state consumed by OBS overlay clients."""

    queue_items = QueueService().get_user_queue(user_id=user_id, db=db)
    current_video = queue_items[0] if queue_items else None
    tts_settings = TTSSettingsRepository(db).get_or_create(user_id=user_id)
    settings = build_youtube_settings_response(getattr(tts_settings, "youtube_settings", None) or {})

    return {
        "queue": queue_items,
        "current_video": current_video,
        "is_playing": current_video is not None,
        "settings": settings,
        "timestamp": time.time(),
    }
