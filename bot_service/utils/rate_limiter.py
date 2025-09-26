# bot_service/utils/rate_limiter.py
import time
from typing import Dict, Optional
from collections import defaultdict, deque

class RateLimiter:
    """
    Простой rate limiter для предотвращения слишком частых запросов
    """
    
    def __init__(self):
        # Хранилище для отслеживания запросов по IP/пользователю
        self.requests: Dict[str, deque] = defaultdict(deque)
        self.cleanup_interval = 300  # Очистка каждые 5 минут
        self.last_cleanup = time.time()
    
    def is_allowed(self, key: str, max_requests: int = 10, window_seconds: int = 60) -> bool:
        """
        Проверяет, разрешен ли запрос
        
        Args:
            key: Уникальный ключ (IP, user_id, etc.)
            max_requests: Максимальное количество запросов
            window_seconds: Временное окно в секундах
            
        Returns:
            bool: True если запрос разрешен, False если превышен лимит
        """
        current_time = time.time()
        
        # Очищаем старые записи
        self._cleanup_old_requests(current_time)
        
        # Получаем очередь запросов для данного ключа
        request_times = self.requests[key]
        
        # Удаляем запросы старше window_seconds
        cutoff_time = current_time - window_seconds
        while request_times and request_times[0] < cutoff_time:
            request_times.popleft()
        
        # Проверяем лимит
        if len(request_times) >= max_requests:
            return False
        
        # Добавляем текущий запрос
        request_times.append(current_time)
        return True
    
    def _cleanup_old_requests(self, current_time: float):
        """Очистка старых запросов для экономии памяти"""
        if current_time - self.last_cleanup < self.cleanup_interval:
            return
        
        # Удаляем ключи с пустыми очередями
        keys_to_remove = []
        for key, request_times in self.requests.items():
            if not request_times:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.requests[key]
        
        self.last_cleanup = current_time
    
    def get_remaining_requests(self, key: str, max_requests: int = 10, window_seconds: int = 60) -> int:
        """
        Возвращает количество оставшихся запросов
        
        Args:
            key: Уникальный ключ
            max_requests: Максимальное количество запросов
            window_seconds: Временное окно в секундах
            
        Returns:
            int: Количество оставшихся запросов
        """
        current_time = time.time()
        request_times = self.requests[key]
        
        # Удаляем старые запросы
        cutoff_time = current_time - window_seconds
        while request_times and request_times[0] < cutoff_time:
            request_times.popleft()
        
        return max(0, max_requests - len(request_times))
    
    def get_reset_time(self, key: str, window_seconds: int = 60) -> float:
        """
        Возвращает время сброса лимита
        
        Args:
            key: Уникальный ключ
            window_seconds: Временное окно в секундах
            
        Returns:
            float: Время сброса лимита (timestamp)
        """
        request_times = self.requests[key]
        if not request_times:
            return time.time()
        
        # Время сброса = время самого старого запроса + window_seconds
        return request_times[0] + window_seconds

# Глобальный экземпляр rate limiter
rate_limiter = RateLimiter()
