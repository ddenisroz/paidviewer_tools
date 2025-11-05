# bot_service/api/stream_history_api.py
"""API для истории стримов"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db, ChatMessage
from auth.auth import get_current_user
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stream", tags=["stream"])

@router.get("/history")
async def get_stream_history(
    page: int = 1,
    limit: int = 100,
    channel_name: str = None,
    platform: str = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить историю стримов/сообщений"""
    try:
        offset = (page - 1) * limit
        
        # Базовый запрос
        query = db.query(ChatMessage)
        
        # Фильтры
        if channel_name:
            query = query.filter(ChatMessage.channel_name == channel_name)
        if platform:
            query = query.filter(ChatMessage.platform == platform)
        
        # Сортировка по времени (новые сначала)
        try:
            messages = query.order_by(ChatMessage.timestamp.desc()).offset(offset).limit(limit).all()
            total_messages = query.count()
        except Exception as db_error:
            # Fallback если нет колонки author_username (старая БД)
            logger.warning(f"⚠️ Database schema mismatch: {db_error}")
            logger.info("ℹ️ Falling back to basic query without author_username")
            
            try:
                from sqlalchemy import text
                # RAW SQL для PostgreSQL - используем $1, $2, ... placeholders
                sql_query = "SELECT * FROM chat_messages WHERE 1=1"
                params = []
                param_index = 1
                
                if channel_name:
                    sql_query += f" AND channel_name = ${param_index}"
                    params.append(channel_name)
                    param_index += 1
                if platform:
                    sql_query += f" AND platform = ${param_index}"
                    params.append(platform)
                    param_index += 1
                
                # LIMIT и OFFSET
                sql_query += f" ORDER BY timestamp DESC LIMIT ${param_index} OFFSET ${param_index + 1}"
                params.extend([limit, offset])
                
                result = db.execute(text(sql_query), tuple(params))
                messages = []
                for row in result:
                    messages.append(type('Message', (), {
                        'id': row[0],
                        'user_id': row[1],
                        'channel_name': row[2],
                        'platform': row[3],
                        'message': row[5],
                        'timestamp': row[6],
                        'viewer_name': getattr(row, 'viewer_name', 'unknown'),
                        'is_tts_enabled': False,
                        'tts_processed': False
                    })())
                
                # Подсчитаем total отдельно
                count_sql = "SELECT COUNT(*) FROM chat_messages WHERE 1=1"
                count_params = []
                count_index = 1
                
                if channel_name:
                    count_sql += f" AND channel_name = ${count_index}"
                    count_params.append(channel_name)
                    count_index += 1
                if platform:
                    count_sql += f" AND platform = ${count_index}"
                    count_params.append(platform)
                    count_index += 1
                
                count_result = db.execute(text(count_sql), tuple(count_params))
                total_messages = list(count_result)[0][0]
                
            except Exception as fallback_error:
                logger.error(f"❌ Fallback query also failed: {fallback_error}")
                return {"success": False, "error": "Database schema error"}
        
        messages_data = []
        for msg in messages:
            messages_data.append({
                'id': msg.id,
                'channel_name': msg.channel_name,
                'platform': msg.platform,
                'viewer_name': getattr(msg, 'viewer_name', 'unknown'),
                'message': msg.message,
                'timestamp': msg.timestamp.isoformat() if msg.timestamp else None,
                'is_tts_enabled': getattr(msg, 'is_tts_enabled', False),
                'tts_processed': getattr(msg, 'tts_processed', False)
            })
        
        return {
            "success": True,
            "messages": messages_data,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_messages,
                "pages": (total_messages + limit - 1) // limit
            }
        }
    except Exception as e:
        logger.error(f"Error getting stream history: {e}")
        return {"success": False, "error": str(e)}

@router.get("/stats")
async def get_stream_stats(
    channel_name: str = None,
    platform: str = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статистику стрима"""
    try:
        # Базовый запрос
        query = db.query(ChatMessage)
        
        # Фильтры
        if channel_name:
            query = query.filter(ChatMessage.channel_name == channel_name)
        if platform:
            query = query.filter(ChatMessage.platform == platform)
        
        # Статистика за последние 24 часа
        yesterday = datetime.utcnow() - timedelta(hours=24)
        messages_24h = query.filter(ChatMessage.timestamp >= yesterday).count()
        
        # Общее количество сообщений
        total_messages = query.count()
        
        # Уникальные зрители
        unique_viewers = query.distinct(ChatMessage.viewer_name).count()
        
        return {
            "success": True,
            "stats": {
                "total_messages": total_messages,
                "messages_24h": messages_24h,
                "unique_viewers": unique_viewers
            }
        }
    except Exception as e:
        logger.error(f"Error getting stream stats: {e}")
        return {"success": False, "error": str(e)}
