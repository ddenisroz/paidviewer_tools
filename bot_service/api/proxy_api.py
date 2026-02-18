# bot_service/api/proxy_api.py
"""Proxy endpoints for external resources (7TV emotes, etc.)."""

import logging
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/proxy", tags=["proxy"])

ALLOWED_DOMAINS = [
    "cdn.7tv.app",
    "emotes.7tv.app",
    "media.7tv.app",
]

CACHE_CONTROL = "public, max-age=86400"  # 24 hours


@router.get("/7tv/{path:path}")
async def proxy_7tv(path: str):
    """
    Proxy requests to 7TV CDN.

    Path format: cdn.7tv.app/emotes/...
    """
    try:
        normalized_path = path.lstrip("/")
        if not normalized_path or "/" not in normalized_path:
            raise HTTPException(status_code=400, detail="Invalid proxy path format")

        host, resource_path = normalized_path.split("/", 1)
        if host not in ALLOWED_DOMAINS:
            raise HTTPException(status_code=403, detail="Domain not allowed")

        if not resource_path:
            raise HTTPException(status_code=400, detail="Invalid resource path")
        if len(resource_path) > 2048:
            raise HTTPException(status_code=400, detail="Resource path is too long")

        safe_resource_path = quote(resource_path, safe="/._-~")
        url = f"https://{host}/{safe_resource_path}"

        logger.debug("[PROXY] Proxying 7TV request: %s", url)

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
                follow_redirects=False,
            )

        # Security: avoid SSRF via redirect chains to non-allowlisted hosts.
        if 300 <= response.status_code < 400:
            raise HTTPException(status_code=502, detail="Upstream redirect is not allowed")

        response.raise_for_status()

        content_type = response.headers.get("Content-Type", "image/webp")
        if not content_type.lower().startswith("image/"):
            raise HTTPException(status_code=502, detail="Unexpected upstream content type")

        async def generate_content():
            yield response.content

        return StreamingResponse(
            generate_content(),
            media_type=content_type,
            headers={
                "Cache-Control": CACHE_CONTROL,
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "*",
            },
        )

    except httpx.TimeoutException:
        logger.error("[PROXY] Timeout proxying 7TV request: %s", path)
        raise HTTPException(status_code=504, detail="Request timeout")
    except httpx.RequestError:
        logger.exception("[PROXY] Error proxying 7TV request: %s", path)
        raise HTTPException(status_code=502, detail="Proxy upstream request failed")
    except HTTPException:
        raise
    except Exception:
        logger.exception("[PROXY] Unexpected error proxying 7TV request: %s", path)
        raise HTTPException(status_code=500, detail="Internal proxy error")
