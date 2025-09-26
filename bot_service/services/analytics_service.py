# bot_service/services/analytics_service.py
import logging
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, asc, func, text
from core.database import StreamData, StreamPeak, get_db
from datetime import datetime, timedelta
import uuid

logger = logging.getLogger('bot_service')

class AnalyticsService:
    """
    Сервис для аналитики стримов и пиков онлайна
    """
    
    def __init__(self):
        pass
    
    def record_stream_data(
        self, 
        user_id: int, 
        platform: str, 
        viewer_count: int, 
        stream_id: str = None,
        category_name: str = None,
        title: str = None,
        is_live: bool = True,
        db: Session = None
    ) -> bool:
        """Записать данные о стриме и проверить на пики"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            # Записываем данные
            stream_data = StreamData(
                user_id=user_id,
                platform=platform,
                stream_id=stream_id,
                viewer_count=viewer_count,
                category_name=category_name,
                title=title,
                is_live=is_live
            )
            
            db.add(stream_data)
            
            # Проверяем и обновляем пики
            self._check_and_update_peaks(
                user_id, platform, viewer_count, stream_id, 
                category_name, title, db
            )
            
            db.commit()
            
            logger.debug(f"Recorded stream data: {platform} - {viewer_count} viewers")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error recording stream data: {e}")
            return False
        finally:
            if should_close:
                db.close()
    
    def _check_and_update_peaks(
        self, 
        user_id: int, 
        platform: str, 
        viewer_count: int, 
        stream_id: str,
        category_name: str,
        title: str,
        db: Session
    ):
        """Проверить и обновить пики онлайна"""
        
        now = datetime.utcnow()
        channel_name = f"user_{user_id}"  # Можно улучшить позже
        
        # Генерируем ключи для группировки
        today_key = now.strftime('%Y-%m-%d')
        week_key = now.strftime('%Y-W%U')  # Год-неделя
        month_key = now.strftime('%Y-%m')
        year_key = now.strftime('%Y')
        
        # Типы пиков для проверки
        peak_checks = [
            ('stream', stream_id or f"session_{today_key}"),
            ('daily', today_key),
            ('weekly', week_key),
            ('monthly', month_key),
            ('all_time', 'all')
        ]
        
        for peak_type, date_key in peak_checks:
            # Ищем существующий пик для этого периода
            existing_peak = db.query(StreamPeak).filter(
                and_(
                    StreamPeak.user_id == user_id,
                    StreamPeak.platform == platform,
                    StreamPeak.peak_type == peak_type,
                    StreamPeak.date_key == date_key
                )
            ).first()
            
            # Если пик не существует или текущий онлайн больше
            if not existing_peak or viewer_count > existing_peak.peak_viewers:
                
                if existing_peak:
                    # Обновляем существующий пик
                    existing_peak.peak_viewers = viewer_count
                    existing_peak.peak_time = now
                    existing_peak.category_name = category_name
                    existing_peak.title = title
                else:
                    # Создаем новый пик
                    new_peak = StreamPeak(
                        user_id=user_id,
                        platform=platform,
                        channel_name=channel_name,
                        peak_viewers=viewer_count,
                        peak_time=now,
                        stream_session_id=stream_id,
                        category_name=category_name,
                        title=title,
                        peak_type=peak_type,
                        date_key=date_key
                    )
                    db.add(new_peak)
                
                logger.info(f"New {peak_type} peak for {platform}: {viewer_count} viewers")
    
    def get_peak_stats(self, user_id: int, platform: str = None, db: Session = None) -> Dict[str, Any]:
        """Получить статистику пиков для пользователя"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            now = datetime.utcnow()
            today_key = now.strftime('%Y-%m-%d')
            week_key = now.strftime('%Y-W%U')
            month_key = now.strftime('%Y-%m')
            
            # Базовый запрос
            query = db.query(StreamPeak).filter(StreamPeak.user_id == user_id)
            if platform:
                query = query.filter(StreamPeak.platform == platform)
            
            # Получаем пики по типам
            peaks = {
                'stream': None,  # Текущий стрим
                'daily': None,   # Сегодня
                'weekly': None,  # Эта неделя
                'monthly': None, # Этот месяц
                'all_time': None # Всё время
            }
            
            # Ищем пики для каждого типа
            for peak_type in peaks.keys():
                if peak_type == 'stream':
                    # Для текущего стрима берем самый свежий stream пик
                    peak = query.filter(
                        and_(
                            StreamPeak.peak_type == 'stream',
                            StreamPeak.date_key.like(f"{today_key}%")
                        )
                    ).order_by(desc(StreamPeak.peak_time)).first()
                elif peak_type == 'daily':
                    peak = query.filter(
                        and_(
                            StreamPeak.peak_type == 'daily',
                            StreamPeak.date_key == today_key
                        )
                    ).first()
                elif peak_type == 'weekly':
                    peak = query.filter(
                        and_(
                            StreamPeak.peak_type == 'weekly',
                            StreamPeak.date_key == week_key
                        )
                    ).first()
                elif peak_type == 'monthly':
                    peak = query.filter(
                        and_(
                            StreamPeak.peak_type == 'monthly',
                            StreamPeak.date_key == month_key
                        )
                    ).first()
                else:  # all_time
                    peak = query.filter(
                        StreamPeak.peak_type == 'all_time'
                    ).order_by(desc(StreamPeak.peak_viewers)).first()
                
                if peak:
                    peaks[peak_type] = {
                        'viewers': peak.peak_viewers,
                        'time': peak.peak_time.isoformat(),
                        'category': peak.category_name,
                        'title': peak.title,
                        'platform': peak.platform,
                        'days_ago': (now - peak.peak_time).days
                    }
            
            return peaks
            
        except Exception as e:
            logger.error(f"Error getting peak stats: {e}")
            return {}
        finally:
            if should_close:
                db.close()
    
    def get_analytics_message(self, user_id: int, platform: str = None, db: Session = None) -> Dict[str, Any]:
        """Получить сообщение о пиках с эмоциями"""
        
        peaks = self.get_peak_stats(user_id, platform, db)
        
        now = datetime.utcnow()
        
        # Определяем самый высокий недавний пик
        recent_peaks = []
        
        if peaks.get('stream'):
            recent_peaks.append(('stream', peaks['stream']))
        if peaks.get('daily'):
            recent_peaks.append(('daily', peaks['daily']))
        if peaks.get('weekly'):
            recent_peaks.append(('weekly', peaks['weekly']))
        
        # Ищем самый высокий пик и когда он был
        highest_peak = None
        peak_period = None
        
        if recent_peaks:
            # Сортируем по количеству зрителей
            recent_peaks.sort(key=lambda x: x[1]['viewers'], reverse=True)
            peak_period, highest_peak = recent_peaks[0]
        
        # Определяем сообщение и эмоцию
        message = ""
        emoji = ""
        status = "unknown"
        
        if not highest_peak:
            message = "Пока нет данных о пиках"
            emoji = "📊"
            status = "no_data"
        else:
            days_ago = highest_peak['days_ago']
            peak_viewers = highest_peak['viewers']
            
            if peak_period == 'stream' or days_ago == 0:
                message = "Сегодня ваш прайм"
                emoji = "😄"
                status = "prime_today"
            elif days_ago <= 7:
                message = "Недавно был ваш прайм"
                emoji = "😊"
                status = "prime_recent"
            else:
                message = "Вас давно не было в прайме"
                emoji = "😢"
                status = "prime_old"
        
        return {
            'message': message,
            'emoji': emoji,
            'status': status,
            'peaks': peaks,
            'highest_recent': highest_peak
        }
    
    def get_stream_analytics(self, user_id: int, hours_back: int = 24, db: Session = None) -> Dict[str, Any]:
        """Получить аналитику стрима за период"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours_back)
            
            # Получаем данные за период
            stream_data = db.query(StreamData).filter(
                and_(
                    StreamData.user_id == user_id,
                    StreamData.timestamp >= cutoff_time
                )
            ).order_by(asc(StreamData.timestamp)).all()
            
            if not stream_data:
                return {
                    'data': [],
                    'twitch_data': [],
                    'vk_data': [],
                    'peak_viewers': 0,
                    'avg_viewers': 0,
                    'categories': []
                }
            
            # Разделяем по платформам
            twitch_data = []
            vk_data = []
            all_data = []
            categories = set()
            
            for entry in stream_data:
                time_str = entry.timestamp.strftime('%H:%M')
                
                data_point = {
                    'time': time_str,
                    'timestamp': entry.timestamp.isoformat(),
                    'viewers': entry.viewer_count,
                    'category': entry.category_name or 'Без категории',
                    'title': entry.title or '',
                    'platform': entry.platform
                }
                
                all_data.append(data_point)
                
                if entry.platform == 'twitch':
                    twitch_data.append({
                        **data_point,
                        'twitchViewers': entry.viewer_count,
                        'vkViewers': 0
                    })
                elif entry.platform == 'vk':
                    vk_data.append({
                        **data_point,
                        'twitchViewers': 0,
                        'vkViewers': entry.viewer_count
                    })
                
                if entry.category_name:
                    categories.add(entry.category_name)
            
            # Объединяем данные по времени для общего графика
            combined_data = {}
            
            for entry in stream_data:
                time_str = entry.timestamp.strftime('%H:%M')
                
                if time_str not in combined_data:
                    combined_data[time_str] = {
                        'time': time_str,
                        'twitchViewers': 0,
                        'vkViewers': 0,
                        'timestamp': entry.timestamp.isoformat(),
                        'category': entry.category_name or 'Без категории'
                    }
                
                if entry.platform == 'twitch':
                    combined_data[time_str]['twitchViewers'] = entry.viewer_count
                elif entry.platform == 'vk':
                    combined_data[time_str]['vkViewers'] = entry.viewer_count
            
            # Сортируем по времени
            sorted_combined = sorted(combined_data.values(), key=lambda x: x['timestamp'])
            
            # Считаем статистику
            all_viewers = [entry.viewer_count for entry in stream_data]
            peak_viewers = max(all_viewers) if all_viewers else 0
            avg_viewers = sum(all_viewers) // len(all_viewers) if all_viewers else 0
            
            return {
                'data': sorted_combined,
                'twitch_data': twitch_data,
                'vk_data': vk_data,
                'all_data': all_data,
                'peak_viewers': peak_viewers,
                'avg_viewers': avg_viewers,
                'categories': list(categories),
                'total_entries': len(stream_data)
            }
            
        except Exception as e:
            logger.error(f"Error getting stream analytics: {e}")
            return {
                'data': [],
                'twitch_data': [],
                'vk_data': [],
                'peak_viewers': 0,
                'avg_viewers': 0,
                'categories': []
            }
        finally:
            if should_close:
                db.close()
    
    def get_category_analytics(self, user_id: int, platform: str = None, days_back: int = 30, db: Session = None) -> List[Dict[str, Any]]:
        """Получить аналитику по категориям"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            cutoff_time = datetime.utcnow() - timedelta(days=days_back)
            
            query = db.query(
                StreamData.category_name,
                func.avg(StreamData.viewer_count).label('avg_viewers'),
                func.max(StreamData.viewer_count).label('max_viewers'),
                func.count(StreamData.id).label('stream_count')
            ).filter(
                and_(
                    StreamData.user_id == user_id,
                    StreamData.timestamp >= cutoff_time,
                    StreamData.category_name.isnot(None)
                )
            )
            
            if platform:
                query = query.filter(StreamData.platform == platform)
            
            results = query.group_by(StreamData.category_name).order_by(
                desc('avg_viewers')
            ).all()
            
            categories = []
            for result in results:
                categories.append({
                    'category': result.category_name,
                    'avg_viewers': round(result.avg_viewers, 1),
                    'max_viewers': result.max_viewers,
                    'stream_count': result.stream_count
                })
            
            return categories
            
        except Exception as e:
            logger.error(f"Error getting category analytics: {e}")
            return []
        finally:
            if should_close:
                db.close()
