import time
import asyncio
import logging
from typing import Dict, Tuple, Optional
from enum import Enum
from dataclasses import dataclass
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class WorkerStatus(Enum):
    IDLE = "idle"
    BUSY = "busy"

@dataclass
class WorkerInfo:
    worker_id: str
    channel_name: str
    status: WorkerStatus
    last_activity: float
    created_at: float

    def update_activity(self):
        self.last_activity = time.time()
        self.status = WorkerStatus.BUSY

    def set_idle(self):
        self.status = WorkerStatus.IDLE

class WorkerManager:
    def __init__(self, max_workers: int = 4, inactivity_timeout: float = 300.0):
        self.workers: Dict[str, WorkerInfo] = {}  # worker_id -> WorkerInfo
        self.channel_to_worker: Dict[str, str] = {} # channel_name -> worker_id
        self.max_workers = max_workers
        self.inactivity_timeout = inactivity_timeout # seconds
        self._monitoring_task = None
        self.worker_counter = 0 # Для уникальных ID воркеров
        logger.info(f"WorkerManager initialized: max_workers={self.max_workers}, inactivity_timeout={self.inactivity_timeout}s")

    def get_or_create_worker(self, channel_name: str) -> Tuple[str, Optional[int]]:
        """
        Возвращает существующий воркер для канала или создает новый.
        Обновляет активность воркера.
        Возвращает worker_id и None для nfe_steps, так как они определяются TTS движком.
        """
        channel_name_lower = channel_name.lower()
        
        # Если воркер уже существует для этого канала
        if channel_name_lower in self.channel_to_worker:
            worker_id = self.channel_to_worker[channel_name_lower]
            worker = self.workers[worker_id]
            worker.update_activity()
            logger.info(f"Reusing worker {worker_id} for channel {channel_name_lower}")
            return worker_id, None # nfe_steps теперь None
        
        # Если есть свободные воркеры, переиспользуем самый старый IDLE воркер
        idle_workers = [w for w in self.workers.values() if w.status == WorkerStatus.IDLE]
        if idle_workers:
            # Сортируем по времени создания, чтобы переиспользовать самый старый
            oldest_worker_info = min(idle_workers, key=lambda w: w.created_at)
            oldest_worker_id = oldest_worker_info.worker_id
            
            # Удаляем старую привязку канала к этому воркеру
            if oldest_worker_info.channel_name in self.channel_to_worker and \
               self.channel_to_worker[oldest_worker_info.channel_name] == oldest_worker_id:
                del self.channel_to_worker[oldest_worker_info.channel_name]
            
            # Обновляем воркер
            oldest_worker_info.channel_name = channel_name_lower
            oldest_worker_info.update_activity()
            
            self.channel_to_worker[channel_name_lower] = oldest_worker_id
            
            logger.info(f"Reused worker {oldest_worker_id} for channel {channel_name_lower}")
            return oldest_worker_id, None
        
        # Если достигнут максимальный лимит воркеров
        if len(self.workers) >= self.max_workers:
            raise HTTPException(status_code=503, detail="Maximum worker limit reached. Please wait.")

        # Создаем новый воркер
        self.worker_counter += 1
        new_worker_id = f"worker_{self.worker_counter}"
        
        new_worker = WorkerInfo(
            worker_id=new_worker_id,
            channel_name=channel_name_lower,
            status=WorkerStatus.BUSY,
            last_activity=time.time(),
            created_at=time.time()
        )
        new_worker.update_activity()
        self.workers[new_worker_id] = new_worker
        self.channel_to_worker[channel_name_lower] = new_worker_id
        
        logger.info(f"Created new worker {new_worker_id} for channel {channel_name_lower}")
        return new_worker_id, None

    def release_worker(self, worker_id: str):
        """
        Отмечает воркер как свободный.
        """
        if worker_id in self.workers:
            self.workers[worker_id].set_idle()
            logger.debug(f"Worker {worker_id} released and set to IDLE.")

    async def _monitor_workers(self):
        """
        Фоновая задача для мониторинга и удаления неактивных воркеров.
        """
        while True:
            await asyncio.sleep(60) # Проверяем каждую минуту
            current_time = time.time()
            workers_to_remove = []
            
            for worker_id, worker_info in list(self.workers.items()):
                if worker_info.status == WorkerStatus.IDLE and \
                   (current_time - worker_info.last_activity) > self.inactivity_timeout:
                    workers_to_remove.append(worker_id)
                    
            for worker_id in workers_to_remove:
                worker_info = self.workers.pop(worker_id)
                if worker_info.channel_name in self.channel_to_worker and \
                   self.channel_to_worker[worker_info.channel_name] == worker_id:
                    del self.channel_to_worker[worker_info.channel_name]
                logger.info(f"Removed inactive worker {worker_id} for channel {worker_info.channel_name}")

    def start_monitoring(self):
        """Запускает фоновую задачу мониторинга воркеров."""
        if not self._monitoring_task:
            self._monitoring_task = asyncio.create_task(self._monitor_workers())
            logger.info("Worker monitoring started")

    def stop_monitoring(self):
        """Останавливает фоновую задачу мониторинга воркеров."""
        if self._monitoring_task:
            self._monitoring_task.cancel()
            self._monitoring_task = None
            logger.info("Worker monitoring stopped")

    def get_all_workers_status(self) -> Dict[str, WorkerInfo]:
        """Возвращает статус всех воркеров."""
        return self.workers

    def get_worker_status(self, worker_id: str) -> Optional[WorkerInfo]:
        """Возвращает статус конкретного воркера."""
        return self.workers.get(worker_id)

    def get_channel_worker(self, channel_name: str) -> Optional[str]:
        """Возвращает ID воркера для данного канала."""
        return self.channel_to_worker.get(channel_name.lower())

    def get_stats(self) -> Dict[str, float]:
        """Возвращает общую статистику по воркерам."""
        total = len(self.workers)
        busy = sum(1 for w in self.workers.values() if w.status == WorkerStatus.BUSY)
        idle = total - busy
        active_channels = len(self.channel_to_worker)
        return {
            "total_workers": total,
            "busy_workers": busy,
            "idle_workers": idle,
            "active_channels": active_channels,
            "max_workers": self.max_workers,
            "inactivity_timeout": self.inactivity_timeout
        }

worker_manager = WorkerManager()
