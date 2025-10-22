# bot_service/services/memory_tts_queue.py
"""
Простая очередь TTS задач в памяти
Заменяет Redis TTS Queue
"""
import asyncio
import logging
import time
import uuid
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class TaskStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class TTSTask:
    """Задача TTS синтеза"""
    task_id: str
    user_id: int
    text: str
    voice: str
    channel: str
    platform: str
    priority: int
    status: TaskStatus
    created_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class MemoryTTSQueue:
    """
    Простая очередь TTS задач в памяти
    """
    
    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self.tasks: Dict[str, TTSTask] = {}
        self.pending_queue = asyncio.Queue(maxsize=max_size)
        self.completed_tasks: Dict[str, TTSTask] = {}
        self._running = False
        
    async def start(self):
        """Запуск очереди"""
        if self._running:
            return
            
        self._running = True
        logger.info("Memory TTS Queue started")
        
    async def stop(self):
        """Остановка очереди"""
        self._running = False
        logger.info("Memory TTS Queue stopped")
        
    async def add_task(
        self,
        user_id: int,
        text: str,
        voice: str,
        channel: str = None,
        platform: str = "twitch",
        priority: int = 2,
        metadata: Dict[str, Any] = None
    ) -> str:
        """
        Добавить задачу в очередь
        
        Args:
            user_id: ID пользователя
            text: Текст для синтеза
            voice: Голос
            channel: Канал
            platform: Платформа
            priority: Приоритет (1-4)
            metadata: Дополнительные данные
            
        Returns:
            str: ID задачи
        """
        if not self._running:
            raise RuntimeError("Queue is not running")
            
        if self.pending_queue.qsize() >= self.max_size:
            raise RuntimeError("Queue is full")
            
        task_id = str(uuid.uuid4())
        
        if not channel:
            channel = f"user_{user_id}"
            
        task = TTSTask(
            task_id=task_id,
            user_id=user_id,
            text=text,
            voice=voice,
            channel=channel,
            platform=platform,
            priority=priority,
            status=TaskStatus.PENDING,
            created_at=time.time()
        )
        
        # Добавляем метаданные если есть
        if metadata:
            for key, value in metadata.items():
                setattr(task, f"meta_{key}", value)
        
        self.tasks[task_id] = task
        
        # Добавляем в очередь по приоритету
        await self.pending_queue.put(task)
        
        logger.info(f"TTS task added: {task_id} for user {user_id}")
        return task_id
        
    async def get_next_task(self, timeout: float = 1.0) -> Optional[TTSTask]:
        """
        Получить следующую задачу из очереди
        
        Args:
            timeout: Таймаут ожидания в секундах
            
        Returns:
            TTSTask или None если очередь пуста
        """
        if not self._running:
            return None
            
        try:
            task = await asyncio.wait_for(
                self.pending_queue.get(),
                timeout=timeout
            )
            
            # Обновляем статус
            task.status = TaskStatus.PROCESSING
            task.started_at = time.time()
            
            logger.info(f"TTS task started: {task.task_id}")
            return task
            
        except asyncio.TimeoutError:
            return None
        except Exception as e:
            logger.error(f"Error getting next task: {e}")
            return None
            
    async def complete_task(self, task_id: str, result: Dict[str, Any]):
        """
        Отметить задачу как выполненную
        
        Args:
            task_id: ID задачи
            result: Результат выполнения
        """
        if task_id not in self.tasks:
            logger.warning(f"Task not found: {task_id}")
            return
            
        task = self.tasks[task_id]
        task.status = TaskStatus.COMPLETED
        task.completed_at = time.time()
        task.result = result
        
        # Перемещаем в завершенные
        self.completed_tasks[task_id] = task
        
        logger.info(f"TTS task completed: {task_id}")
        
    async def fail_task(self, task_id: str, error: str):
        """
        Отметить задачу как неудачную
        
        Args:
            task_id: ID задачи
            error: Ошибка
        """
        if task_id not in self.tasks:
            logger.warning(f"Task not found: {task_id}")
            return
            
        task = self.tasks[task_id]
        task.status = TaskStatus.FAILED
        task.completed_at = time.time()
        task.error = error
        
        # Перемещаем в завершенные
        self.completed_tasks[task_id] = task
        
        logger.error(f"TTS task failed: {task_id} - {error}")
        
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Получить статус задачи
        
        Args:
            task_id: ID задачи
            
        Returns:
            Dict с информацией о задаче или None
        """
        if task_id in self.tasks:
            task = self.tasks[task_id]
        elif task_id in self.completed_tasks:
            task = self.completed_tasks[task_id]
        else:
            return None
            
        return {
            "task_id": task.task_id,
            "user_id": task.user_id,
            "status": task.status.value,
            "created_at": task.created_at,
            "started_at": task.started_at,
            "completed_at": task.completed_at,
            "result": task.result,
            "error": task.error
        }
        
    def get_queue_stats(self) -> Dict[str, Any]:
        """
        Получить статистику очереди
        
        Returns:
            Dict со статистикой
        """
        pending_count = self.pending_queue.qsize()
        processing_count = sum(1 for task in self.tasks.values() 
                             if task.status == TaskStatus.PROCESSING)
        completed_count = len(self.completed_tasks)
        failed_count = sum(1 for task in self.completed_tasks.values() 
                          if task.status == TaskStatus.FAILED)
        
        return {
            "queue_name": "memory_tts_queue",
            "pending_tasks": pending_count,
            "processing_tasks": processing_count,
            "completed_tasks": completed_count,
            "failed_tasks": failed_count,
            "total_tasks": len(self.tasks) + len(self.completed_tasks),
            "max_size": self.max_size,
            "running": self._running
        }
        
    async def cleanup_old_tasks(self, max_age_hours: int = 24):
        """
        Очистить старые завершенные задачи
        
        Args:
            max_age_hours: Максимальный возраст задач в часах
        """
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600
        
        # Очищаем старые завершенные задачи
        old_tasks = []
        for task_id, task in self.completed_tasks.items():
            if task.completed_at and (current_time - task.completed_at) > max_age_seconds:
                old_tasks.append(task_id)
                
        for task_id in old_tasks:
            del self.completed_tasks[task_id]
            if task_id in self.tasks:
                del self.tasks[task_id]
                
        if old_tasks:
            logger.info(f"Cleaned up {len(old_tasks)} old tasks")

# Глобальный экземпляр
memory_tts_queue = MemoryTTSQueue()
