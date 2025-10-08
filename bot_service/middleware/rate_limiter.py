"""
🔒 БЕЗОПАСНОСТЬ: Rate Limiting Middleware
Простая реализация rate limiting без внешних зависимостей
"""
import time
import logging
from collections import defaultdict, deque
from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class SimpleRateLimiter(BaseHTTPMiddleware):
    """
    Простой Rate Limiter на основе скользящего окна
    Хранит время запросов в памяти (для production лучше использовать Redis)
    """
    
    def __init__(self, app, requests_per_minute: int = 60, burst_requests: int = 10):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst_requests = burst_requests  # Максимум запросов за 1 секунду
        
        # Хранилище времени запросов {identifier: deque([timestamp, ...])}
        self.requests = defaultdict(lambda: deque(maxlen=requests_per_minute))
        self.burst_counter = defaultdict(lambda: deque(maxlen=burst_requests))
        
        # Endpoints которые нужно ограничивать
        self.rate_limited_paths = {
            '/api/tts/filtered-words': 20,  # 20 запросов в минуту
            '/api/points/add': 10,           # 10 запросов в минуту
            '/api/points/deduct': 10,
            '/api/lootbox/open': 20,
            '/api/database/cleanup': 2,      # 2 запроса в минуту (критичная операция)
            '/api/database/optimize': 2,
        }
    
    async def dispatch(self, request: Request, call_next):
        # Пропускаем GET запросы (только ограничиваем POST/PUT/DELETE)
        if request.method in ['GET', 'OPTIONS']:
            return await call_next(request)
        
        # Определяем идентификатор клиента
        client_ip = request.client.host
        user_id = None
        
        # Пытаемся получить user_id из сессии
        session_id = request.cookies.get("session_id")
        if session_id:
            # Простая идентификация по сессии
            identifier = f"session_{session_id}"
        else:
            identifier = f"ip_{client_ip}"
        
        # Проверяем, нужно ли ограничивать этот путь
        path = request.url.path
        rate_limit = None
        
        for limited_path, limit in self.rate_limited_paths.items():
            if path.startswith(limited_path):
                rate_limit = limit
                break
        
        if rate_limit is None:
            # Путь не ограничен, пропускаем
            return await call_next(request)
        
        current_time = time.time()
        
        # 1. Проверка burst (защита от спама за 1 секунду)
        burst_queue = self.burst_counter[identifier]
        
        # Удаляем старые записи (старше 1 секунды)
        while burst_queue and current_time - burst_queue[0] > 1:
            burst_queue.popleft()
        
        if len(burst_queue) >= self.burst_requests:
            logger.warning(f"Burst rate limit exceeded for {identifier} on {path}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please slow down."
            )
        
        burst_queue.append(current_time)
        
        # 2. Проверка rate limit (за минуту)
        request_queue = self.requests[identifier]
        
        # Удаляем старые записи (старше 60 секунд)
        while request_queue and current_time - request_queue[0] > 60:
            request_queue.popleft()
        
        if len(request_queue) >= rate_limit:
            logger.warning(f"Rate limit exceeded for {identifier} on {path}: {len(request_queue)}/{rate_limit}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {rate_limit} requests per minute."
            )
        
        # Добавляем текущий запрос
        request_queue.append(current_time)
        
        # Логируем для мониторинга
        if len(request_queue) > rate_limit * 0.8:  # Предупреждение при 80% лимита
            logger.info(f"Rate limit warning for {identifier} on {path}: {len(request_queue)}/{rate_limit}")
        
        return await call_next(request)


class AdvancedRateLimiter:
    """
    Продвинутый Rate Limiter с поддержкой разных лимитов для разных ролей
    Можно использовать вместо SimpleRateLimiter
    """
    
    def __init__(self):
        self.requests = defaultdict(lambda: deque())
        
        # Лимиты для разных ролей
        self.role_limits = {
            'admin': 1000,      # Админы - 1000 запросов/минуту
            'user': 60,         # Обычные пользователи - 60
            'guest': 20,        # Гости - 20
            'anonymous': 10     # Анонимные - 10
        }
    
    def check_rate_limit(self, identifier: str, role: str = 'anonymous') -> bool:
        """
        Проверка rate limit
        
        Args:
            identifier: Идентификатор клиента (IP, user_id, etc)
            role: Роль пользователя
            
        Returns:
            True если запрос разрешен, False если превышен лимит
        """
        current_time = time.time()
        request_queue = self.requests[identifier]
        
        # Получаем лимит для роли
        limit = self.role_limits.get(role, self.role_limits['anonymous'])
        
        # Удаляем старые записи
        while request_queue and current_time - request_queue[0] > 60:
            request_queue.popleft()
        
        # Проверяем лимит
        if len(request_queue) >= limit:
            logger.warning(f"Rate limit exceeded for {identifier} (role: {role}): {len(request_queue)}/{limit}")
            return False
        
        # Добавляем текущий запрос
        request_queue.append(current_time)
        return True
    
    def get_remaining(self, identifier: str, role: str = 'anonymous') -> int:
        """Получить количество оставшихся запросов"""
        request_queue = self.requests[identifier]
        limit = self.role_limits.get(role, self.role_limits['anonymous'])
        return max(0, limit - len(request_queue))


# Глобальный экземпляр для использования в endpoints
rate_limiter = AdvancedRateLimiter()

