"""
Utility functions for retry logic and exponential backoff
"""
import asyncio
import logging
from typing import Callable, TypeVar, Optional
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar('T')


async def retry_async(
    func: Callable[..., T],
    max_attempts: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 30.0,
    backoff_factor: float = 2.0,
    retry_on: tuple = (Exception,),
    on_failure: Optional[Callable] = None,
    **kwargs
) -> Optional[T]:
    """
    Асинхронный retry с экспоненциальным backoff
    
    Args:
        func: Асинхронная функция для выполнения
        max_attempts: Максимальное количество попыток
        initial_delay: Начальная задержка в секундах
        max_delay: Максимальная задержка в секундах
        backoff_factor: Множитель для экспоненциального backoff
        retry_on: Кортеж исключений для retry
        on_failure: Колбэк при окончательной неудаче
        **kwargs: Аргументы для функции
        
    Returns:
        Результат функции или None при неудаче
    """
    last_error = None
    
    for attempt in range(1, max_attempts + 1):
        try:
            if asyncio.iscoroutinefunction(func):
                return await func(**kwargs)
            else:
                return func(**kwargs)
                
        except retry_on as e:
            last_error = e
            
            if attempt >= max_attempts:
                logger.error(f"❌ Retry failed after {max_attempts} attempts: {e}")
                if on_failure:
                    on_failure(e)
                return None
            
            # Экспоненциальный backoff
            delay = min(initial_delay * (backoff_factor ** (attempt - 1)), max_delay)
            logger.warning(f"⚠️ Attempt {attempt}/{max_attempts} failed: {e}. Retrying in {delay:.1f}s...")
            await asyncio.sleep(delay)
            
        except Exception as e:
            # Неожиданное исключение - не ретраим
            logger.error(f"❌ Unexpected error (not retrying): {e}")
            if on_failure:
                on_failure(e)
            return None
    
    logger.error(f"❌ All {max_attempts} attempts failed")
    if on_failure and last_error:
        on_failure(last_error)
    return None


def retry_sync(
    func: Callable[..., T],
    max_attempts: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 30.0,
    backoff_factor: float = 2.0,
    retry_on: tuple = (Exception,),
    on_failure: Optional[Callable] = None,
    **kwargs
) -> Optional[T]:
    """
    Синхронный retry с экспоненциальным backoff
    
    Args:
        func: Синхронная функция для выполнения
        max_attempts: Максимальное количество попыток
        initial_delay: Начальная задержка в секундах
        max_delay: Максимальная задержка в секундах
        backoff_factor: Множитель для экспоненциального backoff
        retry_on: Кортеж исключений для retry
        on_failure: Колбэк при окончательной неудаче
        **kwargs: Аргументы для функции
        
    Returns:
        Результат функции или None при неудаче
    """
    last_error = None
    
    for attempt in range(1, max_attempts + 1):
        try:
            return func(**kwargs)
                
        except retry_on as e:
            last_error = e
            
            if attempt >= max_attempts:
                logger.error(f"❌ Retry failed after {max_attempts} attempts: {e}")
                if on_failure:
                    on_failure(e)
                return None
            
            # Экспоненциальный backoff
            delay = min(initial_delay * (backoff_factor ** (attempt - 1)), max_delay)
            logger.warning(f"⚠️ Attempt {attempt}/{max_attempts} failed: {e}. Retrying in {delay:.1f}s...")
            import time
            time.sleep(delay)
            
        except Exception as e:
            # Неожиданное исключение - не ретраим
            logger.error(f"❌ Unexpected error (not retrying): {e}")
            if on_failure:
                on_failure(e)
            return None
    
    logger.error(f"❌ All {max_attempts} attempts failed")
    if on_failure and last_error:
        on_failure(last_error)
    return None


def async_retry_decorator(max_attempts: int = 3, initial_delay: float = 1.0, max_delay: float = 30.0):
    """
    Декоратор для автоматического retry асинхронных функций
    
    Usage:
        @async_retry_decorator(max_attempts=3, initial_delay=1.0)
        async def my_function():
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await retry_async(
                func,
                max_attempts=max_attempts,
                initial_delay=initial_delay,
                max_delay=max_delay,
                **kwargs
            )
        return wrapper
    return decorator

