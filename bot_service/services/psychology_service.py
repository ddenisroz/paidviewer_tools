# services/psychology_service.py
import logging
import asyncio
import aiohttp
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func

from core.database import ChatMessage, PsychologyAnalysis, User

logger = logging.getLogger(__name__)

class PsychologyService:
    """Сервис для психологического анализа пользователей на основе их сообщений"""
    
    def __init__(self, db: Session):
        self.db = db
        self.analysis_in_progress = False  # Флаг для предотвращения множественных запросов
        self.last_analysis_time = {}  # Кулдаун по пользователям
        
    async def analyze_user_psychology(self, target_username: str, platform: str, 
                                    analyzed_by_user_id: int, analyzed_by_username: str) -> Optional[str]:
        """
        Анализирует психологический портрет пользователя на основе его сообщений
        
        Args:
            target_username: Ник пользователя для анализа
            platform: Платформа (twitch/vk)
            analyzed_by_user_id: ID пользователя, который запросил анализ
            analyzed_by_username: Ник пользователя, который запросил анализ
            
        Returns:
            Результат анализа или None при ошибке
        """
        try:
            # Проверяем кулдаун (30 секунд между анализами)
            current_time = datetime.utcnow()
            if analyzed_by_user_id in self.last_analysis_time:
                time_diff = current_time - self.last_analysis_time[analyzed_by_user_id]
                if time_diff.total_seconds() < 30:
                    remaining = 30 - int(time_diff.total_seconds())
                    return f"⏰ Подождите {remaining} секунд перед следующим анализом"
            
            # Проверяем, не идет ли уже анализ
            if self.analysis_in_progress:
                return "🔄 Анализ уже выполняется, подождите..."
            
            # Проверяем здоровье базы данных
            if not self._check_database_health():
                return "⚠️ База данных перегружена, анализ временно недоступен"
            
            self.analysis_in_progress = True
            self.last_analysis_time[analyzed_by_user_id] = current_time
            
            # Получаем сообщения пользователя за последние 30 дней
            messages = self._get_user_messages(target_username, platform, days=30)
            
            if not messages:
                self.analysis_in_progress = False
                return f"❌ Не найдено сообщений от пользователя {target_username}"
            
            if len(messages) < 5:
                self.analysis_in_progress = False
                return f"❌ Недостаточно сообщений для анализа (найдено: {len(messages)}, нужно минимум 5)"
            
            # Ограничиваем количество сообщений для анализа (последние 50)
            messages = messages[:50]
            
            # Формируем текст для анализа
            analysis_text = self._prepare_messages_for_analysis(messages)
            
            # Отправляем запрос к нейросети
            analysis_result = await self._request_ai_analysis(analysis_text)
            
            if analysis_result:
                # НЕ сохраняем результат в базу данных - анализы временные
                # Анализ генерируется, отправляется пользователю и удаляется
                logger.info(f"Psychology analysis completed for {target_username} (not saved to DB)")
                
                self.analysis_in_progress = False
                return analysis_result
            else:
                self.analysis_in_progress = False
                return "❌ Ошибка при анализе. Попробуйте позже."
                
        except Exception as e:
            logger.error(f"Error in analyze_user_psychology: {e}")
            self.analysis_in_progress = False
            return "❌ Произошла ошибка при анализе"
    
    def _get_user_messages(self, username: str, platform: str, days: int = 30) -> List[ChatMessage]:
        """Получает сообщения пользователя за указанный период"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            messages = self.db.query(ChatMessage).filter(
                and_(
                    ChatMessage.user_id.in_(
                        self.db.query(User.id).filter(User.id == int(username))
                    ),
                    ChatMessage.platform == platform,
                    ChatMessage.timestamp >= cutoff_date,
                    ChatMessage.is_deleted == False
                )
            ).order_by(desc(ChatMessage.timestamp)).limit(100).all()
            
            return messages
            
        except Exception as e:
            logger.error(f"Error getting user messages: {e}")
            return []
    
    def _check_database_health(self) -> bool:
        """Проверяет здоровье базы данных"""
        try:
            from services.database_cleanup_service import DatabaseCleanupService
            cleanup_service = DatabaseCleanupService(self.db)
            stats = cleanup_service.get_database_stats()
            
            # Проверяем лимиты
            total_messages = stats.get('total_chat_messages', 0)
            max_total_messages = stats.get('max_total_messages', 100000)
            users_over_limit = stats.get('users_over_message_limit', 0)
            
            if total_messages > max_total_messages * 0.9:  # Если больше 90% общего лимита
                logger.warning(f"Database approaching total limit: {total_messages}/{max_total_messages} messages")
                return False
            
            if users_over_limit > 0:  # Если есть пользователи с превышением лимита
                logger.warning(f"Users over message limit: {users_over_limit}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking database health: {e}")
            return True  # В случае ошибки продолжаем работу
    
    def _prepare_messages_for_analysis(self, messages: List[ChatMessage]) -> str:
        """Подготавливает сообщения для отправки в нейросеть"""
        try:
            # Берем только текст сообщений, исключая команды
            message_texts = []
            for msg in messages:
                text = msg.message.strip()
                # Исключаем команды (начинающиеся с !)
                if not text.startswith('!'):
                    message_texts.append(text)
            
            # Объединяем сообщения
            combined_text = " ".join(message_texts)
            
            # Ограничиваем длину (максимум 2000 символов для экономии токенов)
            if len(combined_text) > 2000:
                combined_text = combined_text[:2000] + "..."
            
            return combined_text
            
        except Exception as e:
            logger.error(f"Error preparing messages: {e}")
            return ""
    
    async def _request_ai_analysis(self, messages_text: str) -> Optional[str]:
        """Отправляет запрос к ИИ для анализа личности"""
        try:
            # Используем Hugging Face Inference API для анализа эмоций
            url = "https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-emotion"
            
            # Подготавливаем текст для анализа (первые 500 символов)
            analysis_text = messages_text[:500]
            
            from core.config import settings
            headers = {
                "Authorization": f"Bearer {settings.huggingface_token or 'hf_your_token_here'}",
                "Content-Type": "application/json"
            }
            
            data = {
                "inputs": analysis_text
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=data, timeout=30) as response:
                    if response.status == 200:
                        result = await response.json()
                        if isinstance(result, list) and len(result) > 0:
                            # Получаем эмоции с вероятностями
                            emotions = result[0]
                            
                            # Находим доминирующую эмоцию
                            dominant_emotion = max(emotions, key=lambda x: x['score'])
                            
                            # Переводим эмоции на русский
                            emotion_translation = {
                                'joy': 'радостный',
                                'sadness': 'грустный', 
                                'anger': 'злой',
                                'fear': 'тревожный',
                                'surprise': 'удивленный',
                                'disgust': 'раздраженный'
                            }
                            
                            emotion_ru = emotion_translation.get(dominant_emotion['label'], dominant_emotion['label'])
                            confidence = int(dominant_emotion['score'] * 100)
                            
                            # Формируем анализ
                            analysis = f"Эмоциональный профиль: {emotion_ru} ({confidence}%). "
                            
                            # Добавляем дополнительные характеристики на основе текста
                            if len(messages_text) > 200:
                                analysis += "Разговорчивый человек."
                            elif len(messages_text) < 50:
                                analysis += "Лаконичный в общении."
                            
                            if '?' in messages_text:
                                analysis += " Любознательный."
                            
                            return analysis[:150]  # Ограничиваем длину
                    else:
                        logger.error(f"HuggingFace API error: {response.status}")
                        return None
                        
        except Exception as e:
            logger.error(f"Error requesting AI analysis: {e}")
            return None
    
    def _save_analysis_result(self, target_username: str, platform: str, 
                            analyzed_by_user_id: int, analyzed_by_username: str,
                            analysis_text: str, messages_count: int):
        """Сохраняет результат анализа в базу данных"""
        try:
            # Получаем target_user_id
            target_user = self.db.query(User).filter(User.id == int(target_username)).first()
            if not target_user:
                logger.error(f"Target user {target_username} not found")
                return
            
            analysis = PsychologyAnalysis(
                target_user_id=target_user.id,
                target_username=target_username,
                platform=platform,
                analyzed_by_user_id=analyzed_by_user_id,
                analyzed_by_username=analyzed_by_username,
                analysis_text=analysis_text,
                messages_count=messages_count,
                ai_model_used="HuggingFace DialoGPT"
            )
            
            self.db.add(analysis)
            self.db.commit()
            
            logger.info(f"Psychology analysis saved for {target_username}")
            
        except Exception as e:
            logger.error(f"Error saving analysis result: {e}")
            self.db.rollback()
    
    def get_recent_analysis(self, target_username: str, platform: str, hours: int = 24) -> Optional[str]:
        """Получает недавний анализ пользователя (если есть)"""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)
            
            analysis = self.db.query(PsychologyAnalysis).filter(
                and_(
                    PsychologyAnalysis.target_username == target_username,
                    PsychologyAnalysis.platform == platform,
                    PsychologyAnalysis.analysis_date >= cutoff_time
                )
            ).order_by(desc(PsychologyAnalysis.analysis_date)).first()
            
            if analysis:
                return analysis.analysis_text
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting recent analysis: {e}")
            return None
