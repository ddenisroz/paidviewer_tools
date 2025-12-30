"""
Утилиты для работы с БД - централизованные функции для предотвращения дублирования кода
PostgreSQL only
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)


class DatabaseUtils:
    """Утилиты для безопасной работы с PostgreSQL"""

    @staticmethod
    def get_param_placeholder(index: int = None) -> str:
        """
        Возвращает placeholder для параметров PostgreSQL
        PostgreSQL: :param или $1, $2, ...
        """
        if index is not None:
            return f"${index + 1}"
        return ":param"

    @staticmethod
    def build_where_clause(filters: Dict[str, Any]) -> Tuple[str, List[Any]]:
        """
        Строит WHERE условие с PostgreSQL placeholders ($1, $2, ...)
        """
        conditions = []
        params = []

        for key, value in filters.items():
            conditions.append(f"{key} = ${len(params) + 1}")
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
        Безопасное выполнение SQL запроса с параметрами (PostgreSQL)
        
        Args:
            db: Сессия БД
            query_str: SQL запрос (использует $1, $2, ... или :param)
            params: Параметры запроса
            fetch_one: Получить один результат или все
        
        Returns:
            Результат запроса или None
        """
        try:
            if params is None:
                params = []

            result = db.execute(text(query_str), params)

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
        Получает запись с пессимистической блокировкой (FOR UPDATE) - PostgreSQL
        """
        query = db.query(model_class)

        for key, value in filters.items():
            query = query.filter(getattr(model_class, key) == value)

        return query.with_for_update().first()

    @staticmethod
    def json_extract_query(json_column: str, json_path: str, alias: str = None) -> str:
        """
        Возвращает PostgreSQL синтаксис для извлечения значения из JSON
        PostgreSQL: column->>'path'
        """
        # PostgreSQL: device_info->>'monitored_channel'
        if json_path.startswith('$.'):
            json_path = json_path[2:]  # Убираем $.
        return f"{json_column}->>'{json_path}'"
