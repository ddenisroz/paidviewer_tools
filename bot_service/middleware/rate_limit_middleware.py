import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

from services.advanced_rate_limiter import advanced_rate_limiter

logger = logging.getLogger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enforces rate limits on incoming requests
    using the AdvancedRateLimiter service.
    """
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Skip rate limiting for static files and specific paths if needed
        path = request.url.path
        if path.startswith("/static") or path.startswith("/docs") or path.startswith("/openapi.json"):
            return await call_next(request)
            
        # Determine action based on path
        action = "default"
        if path.startswith("/api/auth/login"):
            action = "login"
        elif path.startswith("/api/tts"):
            action = "tts"
        elif path.startswith("/api/upload") or path.startswith("/upload"):
            action = "upload"
        elif path.startswith("/api"):
            action = "api"
            
        # Get identifier (User ID if authenticated, IP otherwise)
        # Note: At this stage in middleware stack, request.user might not be populated yet
        # if AuthMiddleware runs after. Typically Auth runs before logic but after some middlewares.
        # We'll use IP as fallback or try to extract meaningful ID locally.
        
        # Simple extraction - rely on IP for now as robust fallback,
        # or try to look for Authorization header if we want per-token limiting (expensive to validate here)
        # Using built-in logic in AdvancedRateLimiter which handles this
        identifier = advanced_rate_limiter._get_identifier(request=request)
        
        # Check limit
        if not advanced_rate_limiter.check_rate_limit(identifier, action):
            logger.warning(f"Rate limit exceeded for {identifier} on {path} ({action})")
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too Many Requests", 
                    "message": "Вы отправляете слишком много запросов. Пожалуйста, подождите."
                }
            )
            
        return await call_next(request)
