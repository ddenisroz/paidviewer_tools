# bot_service/api/proxy_api.py
"""Прокси-эндпоинты для внешних ресурсов (7TV эмодзи и т.д.)"""
import logging
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/proxy", tags=["proxy"])

# Разрешенные домены для проксирования
ALLOWED_DOMAINS = [
    "cdn.7tv.app",
    "emotes.7tv.app",
    "media.7tv.app"
]

# Кэш для заголовков
CACHE_CONTROL = "public, max-age=86400"  # 24 часа


@router.get("/7tv/{path:path}")
async def proxy_7tv(path: str):
    """
    Проксирует запросы к CDN 7TV для обхода блокировок.
    
    Path должен быть в формате: cdn.7tv.app/emotes/...
    """
    try:
        # Проверяем что путь начинается с разрешенного домена
        if not any(path.startswith(domain) for domain in ALLOWED_DOMAINS):
            raise HTTPException(status_code=403, detail="Domain not allowed")

        # Формируем полный URL
        url = f"https://{path}"

        logger.debug(f"[REFRESH] [PROXY] Proxying 7TV request: {url}")

        # [OK] ОПТИМИЗАЦИЯ: Используем асинхронный httpx вместо синхронного requests
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                },
                follow_redirects=True
            )

        response.raise_for_status()

        # Определяем Content-Type
        content_type = response.headers.get("Content-Type", "image/webp")

        # [OK] ОПТИМИЗАЦИЯ: Возвращаем данные из памяти (httpx уже загрузил ответ)
        async def generate_content():
            yield response.content

        # Возвращаем проксированный ответ с кэшированием
        return StreamingResponse(
            generate_content(),
            media_type=content_type,
            headers={
                "Cache-Control": CACHE_CONTROL,
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "*"
            }
        )

    except httpx.TimeoutException:
        logger.error(f"⏱️ [PROXY] Timeout proxying 7TV request: {path}")
        raise HTTPException(status_code=504, detail="Request timeout")
    except httpx.RequestError as e:
        logger.error(f"[ERROR] [PROXY] Error proxying 7TV request: {path}, error: {e}")
        raise HTTPException(status_code=502, detail=f"Proxy error: {str(e)}")
    except Exception as e:
        logger.error(f"[ERROR] [PROXY] Unexpected error proxying 7TV request: {path}, error: {e}")
        raise HTTPException(status_code=500, detail="Internal proxy error")

