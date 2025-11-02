"""
Утилиты для работы с БД - централизованные функции для предотвращения дублирования кода
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, asc, func, text
from datetime import datetime, timedelta
from contextlib import contextmanager

logger = logging.getLogger(__name__)


class DatabaseUtils:
    """Утилиты для безопасной работы с БД"""
    
    @staticmethod
    def execute_safe_query(
        db: Session,
        query_str: str,
        params: List[Any] = None,
        fetch_one: bool = False
    ) -> Any:
        """
        Безопасное выполнение SQL запроса с параметрами
        
        Args:
            db: Сессия БД
            query_str: SQL запрос
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
        Получить запись с pessimistic lock для предотвращения race condition
        
        Args:
            db: Сессия БД
            model_class: Класс модели
            filters: Словарь фильтров {column_name: value}
        
        Returns:
            Найденная запись или None
        """
        try:
            query = db.query(model_class)
            
            for key, value in filters.items():
                if hasattr(model_class, key):
                    query = query.filter(getattr(model_class, key) == value)
            
            # Используем pessimistic lock
            record = query.with_for_update().first()
            return record
            
        except Exception as e:
            logger.error(f"Error getting record with lock: {e}")
            raise
    
    @staticmethod
    def create_transaction_record(
        db: Session,
        model_class: type,
        data: Dict[str, Any],
        auto_commit: bool = True
    ) -> Optional[Any]:
        """
        Создать запись с автоматическим коммитом
        
        Args:
            db: Сессия БД
            model_class: Класс модели
            data: Данные для создания
            auto_commit: Автоматический commit
        
        Returns:
            Созданная запись
        """
        try:
            record = model_class(**data)
            db.add(record)
            
            if auto_commit:
                db.commit()
                db.refresh(record)
            
            return record
            
        except Exception as e:
            logger.error(f"Error creating transaction record: {e}")
            db.rollback()
            raise
    
    @staticmethod
    def batch_insert(
        db: Session,
        model_class: type,
        data_list: List[Dict[str, Any]],
        batch_size: int = 100
    ) -> int:
        """
        Batch-insert множество записей для оптимизации
        
        Args:
            db: Сессия БД
            model_class: Класс модели
            data_list: Список данных
            batch_size: Размер батча
        
        Returns:
            Количество вставленных записей
        """
        try:
            inserted = 0
            
            for i in range(0, len(data_list), batch_size):
                batch = data_list[i:i + batch_size]
                records = [model_class(**data) for data in batch]
                
                db.bulk_insert_mappings(model_class, [r.__dict__ for r in records])
                db.commit()
                
                inserted += len(batch)
                logger.debug(f"Inserted batch of {len(batch)} records")
            
            return inserted
            
        except Exception as e:
            logger.error(f"Error batch inserting: {e}")
            db.rollback()
            raise
    
    @staticmethod
    def paginate_query(
        query,
        page: int = 1,
        limit: int = 20,
        max_limit: int = 100
    ) -> Tuple[Any, int, int]:
        """
        Применить пагинацию к запросу
        
        Args:
            query: SQLAlchemy query object
            page: Номер страницы (с 1)
            limit: Лимит записей
            max_limit: Максимальный лимит
        
        Returns:
            Кортеж (результаты, total_count, total_pages)
        """
        try:
            # Валидируем параметры
            if page < 1:
                page = 1
            if limit < 1:
                limit = 20
            if limit > max_limit:
                limit = max_limit
            
            total_count = query.count()
            total_pages = (total_count + limit - 1) // limit
            
            offset = (page - 1) * limit
            results = query.offset(offset).limit(limit).all()
            
            return results, total_count, total_pages
            
        except Exception as e:
            logger.error(f"Error paginating query: {e}")
            raise
    
    @staticmethod
    def check_duplicate(
        db: Session,
        model_class: type,
        filters: Dict[str, Any]
    ) -> bool:
        """
        Проверить существование записи
        
        Args:
            db: Сессия БД
            model_class: Класс модели
            filters: Словарь фильтров
        
        Returns:
            True если запись существует
        """
        try:
            query = db.query(model_class)
            
            for key, value in filters.items():
                if hasattr(model_class, key):
                    query = query.filter(getattr(model_class, key) == value)
            
            return query.first() is not None
            
        except Exception as e:
            logger.error(f"Error checking duplicate: {e}")
            raise
    
    @staticmethod
    def update_record(
        db: Session,
        model_class: type,
        filters: Dict[str, Any],
        update_data: Dict[str, Any],
        auto_commit: bool = True
    ) -> Optional[Any]:
        """
        Обновить запись
        
        Args:
            db: Сессия БД
            model_class: Класс модели
            filters: Фильтры для поиска
            update_data: Данные для обновления
            auto_commit: Автоматический commit
        
        Returns:
            Обновленная запись
        """
        try:
            query = db.query(model_class)
            
            for key, value in filters.items():
                if hasattr(model_class, key):
                    query = query.filter(getattr(model_class, key) == value)
            
            record = query.with_for_update().first()
            
            if not record:
                return None
            
            for key, value in update_data.items():
                if hasattr(record, key):
                    setattr(record, key, value)
            
            if auto_commit:
                db.commit()
                db.refresh(record)
            
            return record
            
        except Exception as e:
            logger.error(f"Error updating record: {e}")
            db.rollback()
            raise
    
    @staticmethod
    def delete_record(
        db: Session,
        model_class: type,
        filters: Dict[str, Any],
        auto_commit: bool = True
    ) -> bool:
        """
        Удалить запись
        
        Args:
            db: Сессия БД
            model_class: Класс модели
            filters: Фильтры для поиска
            auto_commit: Автоматический commit
        
        Returns:
            True если удалено успешно
        """
        try:
            query = db.query(model_class)
            
            for key, value in filters.items():
                if hasattr(model_class, key):
                    query = query.filter(getattr(model_class, key) == value)
            
            deleted_count = query.delete()
            
            if auto_commit:
                db.commit()
            
            return deleted_count > 0
            
        except Exception as e:
            logger.error(f"Error deleting record: {e}")
            db.rollback()
            raise


# Экспортируем основные функции для удобства
get_with_lock = DatabaseUtils.get_with_pessimistic_lock
create_transaction = DatabaseUtils.create_transaction_record
batch_insert_records = DatabaseUtils.batch_insert
execute_query = DatabaseUtils.execute_safe_query
