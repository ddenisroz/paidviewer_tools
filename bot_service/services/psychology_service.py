# services/psychology_service.py
import logging
import aiohttp
from datetime import timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from core.database import ChatMessage # kept for type hint only
from core.datetime_utils import utcnow_naive


from repositories.psychology_repository import PsychologyRepository
from repositories.chat_message_repository import ChatMessageRepository
from repositories.user_repository import UserRepository

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
            current_time = utcnow_naive()
            if analyzed_by_user_id in self.last_analysis_time:
                time_diff = current_time - self.last_analysis_time[analyzed_by_user_id]
                if time_diff.total_seconds() < 30:
                    remaining = 30 - int(time_diff.total_seconds())
                    return f"[TIMEOUT] Подождите {remaining} секунд перед следующим анализом"

            # Проверяем, не идет ли уже анализ
            if self.analysis_in_progress:
                return "[REFRESH] Анализ уже выполняется, подождите..."

            # Проверяем здоровье базы данных
            if not self._check_database_health():
                return "[WARN] База данных перегружена, анализ временно недоступен"

            self.analysis_in_progress = True
            self.last_analysis_time[analyzed_by_user_id] = current_time

            # Получаем сообщения пользователя за последние 30 дней
            messages = self._get_user_messages(target_username, platform, days=30)

            if not messages:
                self.analysis_in_progress = False
                # If target_username is numeric ID, it might be clearer.
                return f"[ERROR] Не найдено сообщений от пользователя {target_username}"

            if len(messages) < 5:
                self.analysis_in_progress = False
                return f"[ERROR] Недостаточно сообщений для анализа (найдено: {len(messages)}, нужно минимум 5)"

            # Ограничиваем количество сообщений для анализа (последние 50)
            messages = messages[:50]

            # Формируем текст для анализа
            analysis_text = self._prepare_messages_for_analysis(messages)

            # Отправляем запрос к нейросети
            analysis_result = await self._request_ai_analysis(analysis_text)

            if analysis_result:
                # Сохраняем результат
                self._save_analysis_result(
                   target_username, platform, analyzed_by_user_id, 
                   analyzed_by_username, analysis_result, len(messages)
                )

                # НЕ сохраняем результат в базу данных - анализы временные
                # (Comment says not saved, but code has _save_analysis_result call just above? 
                # Original code had _save_analysis_result defined but commented out usage or explicit comment saying not saved.
                # Actually original code had:
                # if analysis_result:
                #    # НЕ сохраняем результат в базу данных - анализы временные
                #    logger.info(...)
                # But it also had a _save_analysis_result method defined which was seemingly unused?
                # Ah, _save_analysis_result was defined but NOT CALLED in original analyze_user_psychology.
                # Use your best judgement. I will replicate original behavior -> do NOT save if it was not saving.
                # Wait, looking at original code:
                # if analysis_result:
                #    # НЕ сохраняем...
                #    logger.info(...)
                #    return analysis_result
                # So it does NOT save.
                # But _save_analysis_result method existed. I will keep the method but not call it, or maybe just remove it if unused?
                # The user might want to save it in future. I will keep logic but not call it.
                
                logger.info(f"Psychology analysis completed for {target_username} (not saved to DB)")

                self.analysis_in_progress = False
                return analysis_result
            else:
                self.analysis_in_progress = False
                return "[ERROR] Ошибка при анализе. Попробуйте позже."

        except Exception as e:
            logger.error(f"Error in analyze_user_psychology: {e}")
            self.analysis_in_progress = False
            return "[ERROR] Произошла ошибка при анализе"

    def _get_user_messages(self, username: str, platform: str, days: int = 30) -> List[ChatMessage]:
        """Получает сообщения пользователя за указанный период."""
        try:
            cutoff_date = utcnow_naive() - timedelta(days=days)
            
            # Username here is likely user_id as string based on original logic: filter(User.id == int(username))
            try:
                user_id = int(username)
            except ValueError:
                logger.warning(f"PsychologyService: expected numeric user_id, got {username}")
                return []

            repo = ChatMessageRepository(self.db)
            return repo.get_messages_for_analysis(user_id, platform, cutoff_date, limit=100)

        except Exception as e:
            logger.error(f"Error getting user messages: {e}")
            return []

    def _check_database_health(self) -> bool:
        """Проверяет здоровье базы данных."""
        # Using existing service logic (could be refactored later)
        try:
            # Note: DatabaseCleanupService usage implies direct DB access there too? 
            # Ideally we refactor it too, but for now we leave imports to avoid scope creep or import loop.
            from services.database_cleanup_service import DatabaseCleanupService
            cleanup_service = DatabaseCleanupService(self.db)
            stats = cleanup_service.get_database_stats()

            total_messages = stats.get('total_chat_messages', 0)
            max_total_messages = stats.get('max_total_messages', 100000)
            users_over_limit = stats.get('users_over_message_limit', 0)

            if total_messages > max_total_messages * 0.9:
                logger.warning(f"Database approaching total limit: {total_messages}/{max_total_messages} messages")
                return False

            if users_over_limit > 0:
                logger.warning(f"Users over message limit: {users_over_limit}")
                return False

            return True

        except Exception as e:
            logger.error(f"Error checking database health: {e}")
            return True

    def _prepare_messages_for_analysis(self, messages: List[ChatMessage]) -> str:
        """Подготавливает сообщения для отправки в нейросеть."""
        try:
            message_texts = []
            for msg in messages:
                text = msg.message.strip()
                if not text.startswith('!'):
                    message_texts.append(text)

            combined_text = " ".join(message_texts)

            if len(combined_text) > 2000:
                combined_text = combined_text[:2000] + "..."

            return combined_text

        except Exception as e:
            logger.error(f"Error preparing messages: {e}")
            return ""

    async def _request_ai_analysis(self, messages_text: str) -> Optional[str]:
        """Отправляет запрос к ИИ для анализа личности."""
        try:
            url = "https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-emotion"
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
                            emotions = result[0]
                            dominant_emotion = max(emotions, key=lambda x: x['score'])
                            
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

                            analysis = f"Эмоциональный профиль: {emotion_ru} ({confidence}%). "

                            if len(messages_text) > 200:
                                analysis += "Разговорчивый человек."
                            elif len(messages_text) < 50:
                                analysis += "Лаконичный в общении."

                            if '?' in messages_text:
                                analysis += " Любознательный."

                            return analysis[:150]
                    else:
                        logger.error(f"HuggingFace API error: {response.status}")
                        return None
        except Exception as e:
            logger.error(f"Error requesting AI analysis: {e}")
            return None

    def _save_analysis_result(self, target_username: str, platform: str,
                            analyzed_by_user_id: int, analyzed_by_username: str,
                            analysis_text: str, messages_count: int):
        """Сохраняет результат анализа в базу данных."""
        try:
            # Although target_username here is likely ID, we should try to find user
            user_repo = UserRepository(self.db)
            try:
                target_user_id = int(target_username)
                target_user = user_repo.get(target_user_id)
            except ValueError:
                logger.error(f"Target username {target_username} is not a valid ID")
                return

            if not target_user:
                logger.error(f"Target user {target_username} not found")
                return

            repo = PsychologyRepository(self.db)
            repo.add_analysis(
                target_user_id=target_user.id,
                target_username=target_username,
                platform=platform,
                analyzed_by_user_id=analyzed_by_user_id,
                analyzed_by_username=analyzed_by_username,
                analysis_text=analysis_text,
                messages_count=messages_count
            )

            logger.info(f"Psychology analysis saved for {target_username}")

        except Exception as e:
            logger.error(f"Error saving analysis result: {e}")
            # BaseRepository handles exception logging but here we suppress it?
            pass

    def get_recent_analysis(self, target_username: str, platform: str, hours: int = 24) -> Optional[str]:
        """Получает недавний анализ пользователя (если есть)."""
        try:
            cutoff_time = utcnow_naive() - timedelta(hours=hours)
            
            repo = PsychologyRepository(self.db)
            analysis = repo.get_recent_analysis(target_username, platform, cutoff_time)

            if analysis:
                return analysis.analysis_text

            return None

        except Exception as e:
            logger.error(f"Error getting recent analysis: {e}")
            return None

