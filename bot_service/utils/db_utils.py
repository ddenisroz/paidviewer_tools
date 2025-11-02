"""
Утилиты для работы с БД - централизованные функции для предотвращения дублирования кода
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, asc, func, text
from datetime import datetime, timedelta
from contextlib import contextmanager
from core.database import IS_POSTGRESQL

logger = logging.getLogger(__name__)


class DatabaseUtils:
    """Утилиты для безопасной работы с БД"""
    
    @staticmethod
    def get_param_placeholder(index: int = None) -> str:
        """
        Возвращает правильный placeholder для параметров в зависимости от БД
        PostgreSQL: :param или $1, $2, ...
        SQLite: ?
        """
        if IS_POSTGRESQL:
            if index is not None:
                return f"${index + 1}"
            return ":param"
        return "?"
    
    @staticmethod
    def build_where_clause(filters: Dict[str, Any]) -> Tuple[str, List[Any]]:
        """
        Строит WHERE условие с правильными placeholders
        """
        conditions = []
        params = []
        
        for key, value in filters.items():
            if IS_POSTGRESQL:
                conditions.append(f"{key} = ${len(params) + 1}")
            else:
                conditions.append(f"{key} = ?")
            params.append(value)
        
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        return where_clause, params
    
    @staticmethod
    def execute_safe_query(
        db: Session,
        query_str: str,
        params: List[Any] = None,
        fetch_one: bool = False
    ) -> Any:
        """
        Безопасное выполнение SQL запроса с параметрами
        Автоматически адаптирует запрос для PostgreSQL или SQLite
        
        Args:
            db: Сессия БД
            query_str: SQL запрос (может использовать ? или :param)
            params: Параметры запроса
            fetch_one: Получить один результат или все
        
        Returns:
            Результат запроса или None
        """
        try:
            if params is None:
                params = []
            
            # Преобразуем ? в правильные placeholders для текущей БД
            if IS_POSTGRESQL and "?" in query_str:
                # Заменяем ? на $1, $2, ...
                query_str = query_str.replace("?", f"${{index}}")
                for i in range(len(params)):
                    query_str = query_str.replace("${{index}}", f"${i+1}", 1)
            
            result = db.execute(text(query_str), params if IS_POSTGRESQL else tuple(params))
            
            if fetch_one:
                return result.first()
            return result.fetchall()
            
        except Exception as e:
            logger.error(f"Database query error: {e}")
            raise
    
    @staticmethod
    def get_with_pessimistic_lock(
        db: Session,
        model_class: type,
        filters: Dict[str, Any]
    ) -> Optional[Any]:
        """
        Получает запись с пессимистической блокировкой (FOR UPDATE)
        """
        query = db.query(model_class)
        
        for key, value in filters.items():
            query = query.filter(getattr(model_class, key) == value)
        
        if IS_POSTGRESQL:
            return query.with_for_update().first()
        else:
            return query.first()
    
    @staticmethod
    def json_extract_query(json_column: str, json_path: str, alias: str = None) -> str:
        """
        Возвращает правильный синтаксис для извлечения значения из JSON
        PostgreSQL: column->>'path'
        SQLite: JSON_EXTRACT(column, '$.path')
        """
        if IS_POSTGRESQL:
            # PostgreSQL: device_info->>'monitored_channel'
            if json_path.startswith('$.'):
                json_path = json_path[2:]  # Убираем $.
            return f"{json_column}->>'{json_path}'"
        else:
            # SQLite: JSON_EXTRACT(device_info, '$.monitored_channel')
            return f"JSON_EXTRACT({json_column}, '{json_path}')"
