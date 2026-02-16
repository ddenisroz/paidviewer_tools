"""
Lightweight error reporting endpoint for frontend error boundaries.
"""
import logging
from typing import Any, Dict

from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/api/errors/report")
async def report_frontend_error(request: Request) -> Dict[str, Any]:
    try:
        payload = await request.json()
    except Exception:
        payload = {"raw": await request.body()}

    logger.error("[FRONTEND ERROR] %s", payload)
    return {"success": True}
