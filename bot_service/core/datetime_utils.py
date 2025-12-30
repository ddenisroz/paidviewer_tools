"""
Утилиты для работы с датой и временем
Заменяет deprecated datetime.utcnow() на современные аналоги
"""
from datetime import datetime, timezone, timedelta
from typing import Optional


def utcnow() -> datetime:
    """
    Возвращает текущее время в UTC с timezone aware
    Заменяет deprecated datetime.utcnow()
    
    Returns:
        datetime: Текущее время в UTC
    """
    return datetime.now(timezone.utc)


def utcnow_naive() -> datetime:
    """
    Возвращает текущее время в UTC без timezone (naive)
    Используйте только если необходима обратная совместимость
    
    Returns:
        datetime: Текущее время в UTC (naive)
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_utc(dt: datetime) -> datetime:
    """
    Конвертирует datetime в UTC timezone aware
    
    Args:
        dt: datetime для конвертации
        
    Returns:
        datetime: datetime в UTC
    """
    if dt.tzinfo is None:
        # Если naive, предполагаем что это UTC
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def from_timestamp(timestamp: float) -> datetime:
    """
    Создает timezone aware datetime из Unix timestamp
    
    Args:
        timestamp: Unix timestamp
        
    Returns:
        datetime: timezone aware datetime в UTC
    """
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)


def to_timestamp(dt: datetime) -> float:
    """
    Конвертирует datetime в Unix timestamp
    
    Args:
        dt: datetime для конвертации
        
    Returns:
        float: Unix timestamp
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def add_time(
    dt: Optional[datetime] = None,
    days: int = 0,
    hours: int = 0,
    minutes: int = 0,
    seconds: int = 0
) -> datetime:
    """
    Добавляет время к datetime или к текущему времени
    
    Args:
        dt: datetime для модификации (если None, используется текущее время)
        days: Количество дней для добавления
        hours: Количество часов для добавления
        minutes: Количество минут для добавления
        seconds: Количество секунд для добавления
        
    Returns:
        datetime: Модифицированный datetime
    """
    if dt is None:
        dt = utcnow()

    delta = timedelta(days=days, hours=hours, minutes=minutes, seconds=seconds)
    return dt + delta


def is_expired(dt: datetime) -> bool:
    """
    Проверяет, истек ли срок действия datetime
    
    Args:
        dt: datetime для проверки
        
    Returns:
        bool: True если истек, False иначе
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt < utcnow()


def format_iso(dt: datetime) -> str:
    """
    Форматирует datetime в ISO 8601 формат
    
    Args:
        dt: datetime для форматирования
        
    Returns:
        str: ISO 8601 строка
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def parse_iso(iso_string: str) -> datetime:
    """
    Парсит ISO 8601 строку в datetime
    
    Args:
        iso_string: ISO 8601 строка
        
    Returns:
        datetime: Распарсенный datetime
    """
    dt = datetime.fromisoformat(iso_string.replace('Z', '+00:00'))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def get_date_key(dt: Optional[datetime] = None, format: str = "daily") -> str:
    """
    Возвращает ключ даты для группировки
    
    Args:
        dt: datetime (если None, используется текущее время)
        format: Формат ключа (daily, weekly, monthly, yearly)
        
    Returns:
        str: Ключ даты
    """
    if dt is None:
        dt = utcnow()

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    if format == "daily":
        return dt.strftime("%Y-%m-%d")
    elif format == "weekly":
        # ISO неделя (понедельник - первый день)
        return dt.strftime("%Y-W%V")
    elif format == "monthly":
        return dt.strftime("%Y-%m")
    elif format == "yearly":
        return dt.strftime("%Y")
    else:
        raise ValueError(f"Unknown format: {format}")

