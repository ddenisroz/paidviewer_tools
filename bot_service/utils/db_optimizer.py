# bot_service/utils/db_optimizer.py
"""
⚡ Оптимизатор запросов к базе данных
Кэширование, batch операции и оптимизированные запросы
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import timedelta
from sqlalchemy.orm import Session, joinedload

from core.datetime_utils import utcnow_naive

logger = logging.getLogger('bot_service')

class QueryOptimizer:
    """Класс для оптимизации запросов к БД"""

    # Кэш для часто запрашиваемых данных
    _cache: Dict[str, Dict[str, Any]] = {}
    _cache_ttl: Dict[str, datetime] = {}

    DEFAULT_CACHE_TTL = 300  # 5 минут

    @staticmethod
    def get_cached(key: str) -> Optional[Any]:
        """Получить закэшированные данные"""
        if key in QueryOptimizer._cache:
            # Проверяем TTL
            if key in QueryOptimizer._cache_ttl:
                if utcnow_naive() < QueryOptimizer._cache_ttl[key]:
                    return QueryOptimizer._cache[key]
                else:
                    # Кэш истек
                    del QueryOptimizer._cache[key]
                    del QueryOptimizer._cache_ttl[key]
        return None

    @staticmethod
    def set_cached(key: str, value: Any, ttl: int = DEFAULT_CACHE_TTL):
        """Сохранить данные в кэш"""
        QueryOptimizer._cache[key] = value
        QueryOptimizer._cache_ttl[key] = utcnow_naive() + timedelta(seconds=ttl)

    @staticmethod
    def clear_cache(pattern: Optional[str] = None):
        """Очистить кэш (полностью или по паттерну)"""
        if pattern:
            keys_to_delete = [k for k in QueryOptimizer._cache.keys() if pattern in k]
            for key in keys_to_delete:
                del QueryOptimizer._cache[key]
                if key in QueryOptimizer._cache_ttl:
                    del QueryOptimizer._cache_ttl[key]
        else:
            QueryOptimizer._cache.clear()
            QueryOptimizer._cache_ttl.clear()

    @staticmethod
    def get_user_with_tokens(db: Session, user_id: int):
        """
        Оптимизированный запрос пользователя с токенами
        Использует joinedload для избежания N+1 проблемы
        """
        from core.database import User

        cache_key = f"user_tokens_{user_id}"
        cached = QueryOptimizer.get_cached(cache_key)
        if cached:
            return cached

        # Используем joinedload для загрузки токенов за один запрос
        user = db.query(User).options(
            joinedload(User.tokens)
        ).filter(User.id == user_id).first()

        if user:
            QueryOptimizer.set_cached(cache_key, user, ttl=60)  # 1 минута

        return user

    @staticmethod
    def get_user_commands_batch(db: Session, user_ids: List[int], platform: str = None):
        """
        Batch загрузка команд для нескольких пользователей
        Оптимизировано: один запрос вместо N запросов
        """
        from core.database import BotCommand

        query = db.query(BotCommand).filter(
            BotCommand.user_id.in_(user_ids),
            BotCommand.is_enabled.is_(True)
        )

        if platform:
            # Фильтруем по платформе
            query = query.filter(BotCommand.platforms.contains(platform))

        commands = query.all()

        # Группируем по user_id для удобства
        result = {}
        for cmd in commands:
            if cmd.user_id not in result:
                result[cmd.user_id] = []
            result[cmd.user_id].append(cmd)

        return result

    @staticmethod
    def get_active_channels_optimized(db: Session):
        """
        Оптимизированный запрос активных каналов
        Использует кэширование и оптимизированный запрос
        """
        from core.database import UserSession

        cache_key = "active_channels"
        cached = QueryOptimizer.get_cached(cache_key)
        if cached:
            return cached

        # Получаем активные сессии с пользователями за один запрос
        active_sessions = db.query(UserSession).options(
            joinedload(UserSession.user)
        ).filter(
            UserSession.is_active.is_(True)
        ).all()

        result = []
        for session in active_sessions:
            if session.user:
                result.append({
                    'user_id': session.user.id,
                    'username': session.user.username,
                    'session_id': session.session_id,
                    'channel_name': session.channel_name
                })

        QueryOptimizer.set_cached(cache_key, result, ttl=30)  # 30 секунд
        return result


    @staticmethod
    def get_user_stats_optimized(db: Session, user_id: int):
        """
        Оптимизированный запрос статистики пользователя
        Использует агрегацию на уровне БД
        """
        from core.database import BotCommand
        from sqlalchemy import func

        cache_key = f"user_stats_{user_id}"
        cached = QueryOptimizer.get_cached(cache_key)
        if cached:
            return cached

        # Статистика команд
        command_stats = db.query(
            func.count(BotCommand.id).label('total_commands'),
            func.sum(BotCommand.usage_count).label('total_usage')
        ).filter(
            BotCommand.user_id == user_id,
            BotCommand.is_enabled.is_(True)
        ).first()

        result = {
            'total_commands': command_stats.total_commands or 0,
            'total_command_usage': command_stats.total_usage or 0
        }

        QueryOptimizer.set_cached(cache_key, result, ttl=120)  # 2 минуты
        return result

    @staticmethod
    def cleanup_old_data_batch(db: Session, days_old: int = 90):
        """
        Batch удаление старых данных
        Оптимизировано: удаление большими порциями
        """
        from core.database import ChatMessage

        cutoff_date = utcnow_naive() - timedelta(days=days_old)

        try:
            # Удаляем старые сообщения чата
            deleted_messages = 0
            if hasattr(ChatMessage, '__table__'):  # Проверяем существование таблицы
                while True:
                    result = db.query(ChatMessage).filter(
                        ChatMessage.created_at < cutoff_date
                    ).limit(1000).delete(synchronize_session=False)

                    db.commit()
                    deleted_messages += result

                    if result < 1000:
                        break

            logger.info(f"Cleaned up {deleted_messages} chat messages")
            return {
                'messages': deleted_messages
            }

        except Exception as e:
            logger.error(f"Error in cleanup: {e}")
            db.rollback()
            return {'messages': 0}

    @staticmethod
    def get_voice_list_cached(db: Session, voice_type: Optional[str] = None):
        """
        Кэшированный список голосов
        """
        cache_key = f"voice_list_{voice_type or 'all'}"
        cached = QueryOptimizer.get_cached(cache_key)
        if cached:
            return cached

        # Делаем запрос к TTS сервису
        # Здесь должна быть логика получения голосов
        # Для примера возвращаем пустой список
        voices = []

        QueryOptimizer.set_cached(cache_key, voices, ttl=600)  # 10 минут
        return voices


class IndexOptimizer:
    """Утилиты для работы с индексами БД"""

    @staticmethod
    def analyze_missing_indexes(db: Session):
        """
        Анализ отсутствующих индексов
        Возвращает рекомендации по созданию индексов
        """
        recommendations = []

        # Проверяем наличие индексов на часто используемых полях
        from sqlalchemy import inspect

        # Список таблиц и полей, которые должны иметь индексы
        recommended_indexes = {
            'users': ['username', 'email', 'created_at'],
            'user_tokens': ['user_id', 'platform', 'platform_user_id'],
            'user_sessions': ['user_id', 'session_id', 'is_active'],
            'bot_commands': ['user_id', 'command_name', 'is_enabled'],
            'stream_data': ['user_id', 'platform', 'created_at', 'is_live'],
            'filtered_words': ['user_id', 'word'],
        }

        inspector = inspect(db.bind)

        for table_name, columns in recommended_indexes.items():
            if table_name in inspector.get_table_names():
                existing_indexes = inspector.get_indexes(table_name)
                indexed_columns = set()
                for idx in existing_indexes:
                    indexed_columns.update(idx['column_names'])

                for column in columns:
                    if column not in indexed_columns:
                        recommendations.append({
                            'table': table_name,
                            'column': column,
                            'query': f"CREATE INDEX idx_{table_name}_{column} ON {table_name}({column});"
                        })

        return recommendations

    @staticmethod
    def create_recommended_indexes(db: Session):
        """Создать рекомендуемые индексы"""
        recommendations = IndexOptimizer.analyze_missing_indexes(db)

        created = 0
        for rec in recommendations:
            try:
                db.execute(rec['query'])
                db.commit()
                created += 1
                logger.info(f"Created index: {rec['table']}.{rec['column']}")
            except Exception as e:
                logger.error(f"Error creating index {rec['table']}.{rec['column']}: {e}")
                db.rollback()

        return created


