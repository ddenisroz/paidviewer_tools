# tts_service/gpu_monitor.py
import asyncio
import logging
import time
import json
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime
import psutil
import redis

logger = logging.getLogger(__name__)

@dataclass
class GPUHealthMetrics:
    """Метрики здоровья GPU"""
    timestamp: float
    memory_usage_percent: float
    gpu_utilization: float
    temperature: Optional[float]
    power_usage: Optional[float]
    memory_allocated: int
    memory_reserved: int
    memory_total: int
    active_tasks: int
    concurrent_workers: int
    avg_processing_time: float
    error_rate: float
    health_score: float  # 0-100, где 100 = отлично

class GPUHealthMonitor:
    """
    Расширенный мониторинг здоровья GPU с интеграцией в систему мониторинга
    """
    
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        monitoring_interval: float = 10.0,
        health_history_size: int = 100,
        alert_thresholds: Optional[Dict[str, float]] = None
    ):
        self.redis_url = redis_url
        self.monitoring_interval = monitoring_interval
        self.health_history_size = health_history_size
        self.redis_client = None
        
        # Пороги для алертов
        self.alert_thresholds = alert_thresholds or {
            'memory_usage_critical': 0.9,
            'memory_usage_warning': 0.8,
            'temperature_critical': 85.0,
            'temperature_warning': 80.0,
            'error_rate_critical': 0.1,
            'error_rate_warning': 0.05,
            'health_score_critical': 30.0,
            'health_score_warning': 50.0
        }
        
        # История метрик
        self.health_history: List[GPUHealthMetrics] = []
        self.running = False
        self._monitoring_task = None
        
        # Статистика
        self.stats = {
            'total_checks': 0,
            'alerts_sent': 0,
            'last_health_score': 100.0,
            'avg_health_score': 100.0,
            'uptime': 0.0
        }
        
        self.start_time = time.time()

    async def initialize(self):
        """Инициализация монитора"""
        try:
            # Подключение к Redis
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            await asyncio.get_event_loop().run_in_executor(None, self.redis_client.ping)
            
            # Запуск мониторинга
            await self.start_monitoring()
            
            logger.info("GPU Health Monitor initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize GPU Health Monitor: {e}")
            raise

    async def start_monitoring(self):
        """Запуск мониторинга здоровья GPU"""
        if self.running:
            return
            
        self.running = True
        self._monitoring_task = asyncio.create_task(self._monitor_loop())
        logger.info("GPU health monitoring started")

    async def stop_monitoring(self):
        """Остановка мониторинга"""
        if not self.running:
            return
            
        self.running = False
        
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
        
        logger.info("GPU health monitoring stopped")

    async def _monitor_loop(self):
        """Основной цикл мониторинга"""
        while self.running:
            try:
                # Получаем метрики от GPU Worker Pool
                gpu_metrics = await self._get_gpu_worker_metrics()
                
                if gpu_metrics:
                    # Вычисляем метрики здоровья
                    health_metrics = await self._calculate_health_metrics(gpu_metrics)
                    
                    # Сохраняем в историю
                    self._add_to_history(health_metrics)
                    
                    # Проверяем алерты
                    await self._check_alerts(health_metrics)
                    
                    # Отправляем метрики в систему мониторинга
                    await self._send_metrics_to_monitoring(health_metrics)
                    
                    # Обновляем статистику
                    self._update_stats(health_metrics)
                
                await asyncio.sleep(self.monitoring_interval)
                
            except Exception as e:
                logger.error(f"Error in GPU health monitoring: {e}")
                await asyncio.sleep(self.monitoring_interval)

    async def _get_gpu_worker_metrics(self) -> Optional[Dict[str, Any]]:
        """Получение метрик от GPU Worker Pool"""
        try:
            # Получаем статистику от GPU Worker Pool
            from gpu_worker_pool import gpu_worker_pool
            
            if hasattr(gpu_worker_pool, 'get_stats'):
                stats = gpu_worker_pool.get_stats()
                gpu_metrics = gpu_worker_pool.get_gpu_metrics()
                
                if gpu_metrics:
                    return {
                        'stats': stats,
                        'gpu_metrics': gpu_metrics.__dict__
                    }
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting GPU worker metrics: {e}")
            return None

    async def _calculate_health_metrics(self, gpu_data: Dict[str, Any]) -> GPUHealthMetrics:
        """Вычисление метрик здоровья GPU"""
        try:
            stats = gpu_data.get('stats', {})
            gpu_metrics = gpu_data.get('gpu_metrics', {})
            
            # Базовые метрики
            memory_usage_percent = gpu_metrics.get('memory_usage_percent', 0.0)
            gpu_utilization = gpu_metrics.get('gpu_utilization', 0.0)
            temperature = gpu_metrics.get('temperature')
            power_usage = gpu_metrics.get('power_usage')
            memory_allocated = gpu_metrics.get('memory_allocated', 0)
            memory_reserved = gpu_metrics.get('memory_reserved', 0)
            memory_total = gpu_metrics.get('memory_total', 1)
            
            # Метрики производительности
            active_tasks = stats.get('active_tasks', 0)
            concurrent_workers = stats.get('current_concurrent', 0)
            avg_processing_time = stats.get('avg_processing_time', 0.0)
            
            # Вычисляем error rate
            total_tasks = stats.get('total_tasks', 1)
            failed_tasks = stats.get('failed_tasks', 0)
            error_rate = failed_tasks / total_tasks if total_tasks > 0 else 0.0
            
            # Вычисляем health score (0-100)
            health_score = self._calculate_health_score(
                memory_usage_percent,
                gpu_utilization,
                temperature,
                error_rate,
                avg_processing_time
            )
            
            return GPUHealthMetrics(
                timestamp=time.time(),
                memory_usage_percent=memory_usage_percent,
                gpu_utilization=gpu_utilization,
                temperature=temperature,
                power_usage=power_usage,
                memory_allocated=memory_allocated,
                memory_reserved=memory_reserved,
                memory_total=memory_total,
                active_tasks=active_tasks,
                concurrent_workers=concurrent_workers,
                avg_processing_time=avg_processing_time,
                error_rate=error_rate,
                health_score=health_score
            )
            
        except Exception as e:
            logger.error(f"Error calculating health metrics: {e}")
            # Возвращаем дефолтные метрики при ошибке
            return GPUHealthMetrics(
                timestamp=time.time(),
                memory_usage_percent=0.0,
                gpu_utilization=0.0,
                temperature=None,
                power_usage=None,
                memory_allocated=0,
                memory_reserved=0,
                memory_total=0,
                active_tasks=0,
                concurrent_workers=0,
                avg_processing_time=0.0,
                error_rate=0.0,
                health_score=0.0
            )

    def _calculate_health_score(
        self,
        memory_usage: float,
        gpu_utilization: float,
        temperature: Optional[float],
        error_rate: float,
        avg_processing_time: float
    ) -> float:
        """Вычисление общего health score (0-100)"""
        try:
            score = 100.0
            
            # Штрафы за использование памяти
            if memory_usage > 0.9:
                score -= 40
            elif memory_usage > 0.8:
                score -= 20
            elif memory_usage > 0.7:
                score -= 10
            
            # Штрафы за температуру
            if temperature is not None:
                if temperature > 85:
                    score -= 30
                elif temperature > 80:
                    score -= 15
                elif temperature > 75:
                    score -= 5
            
            # Штрафы за error rate
            if error_rate > 0.1:
                score -= 25
            elif error_rate > 0.05:
                score -= 10
            elif error_rate > 0.01:
                score -= 5
            
            # Штрафы за время обработки (если слишком долго)
            if avg_processing_time > 60:  # Более минуты
                score -= 15
            elif avg_processing_time > 30:  # Более 30 секунд
                score -= 5
            
            # Бонусы за оптимальную утилизацию
            if 0.3 <= gpu_utilization <= 0.8:
                score += 5
            
            return max(0.0, min(100.0, score))
            
        except Exception as e:
            logger.error(f"Error calculating health score: {e}")
            return 0.0

    def _add_to_history(self, metrics: GPUHealthMetrics):
        """Добавление метрик в историю"""
        self.health_history.append(metrics)
        
        # Ограничиваем размер истории
        if len(self.health_history) > self.health_history_size:
            self.health_history.pop(0)

    async def _check_alerts(self, metrics: GPUHealthMetrics):
        """Проверка условий для алертов"""
        try:
            alerts = []
            
            # Проверка использования памяти
            if metrics.memory_usage_percent >= self.alert_thresholds['memory_usage_critical']:
                alerts.append({
                    'level': 'critical',
                    'type': 'memory_usage',
                    'message': f'GPU memory usage critical: {metrics.memory_usage_percent:.1%}',
                    'value': metrics.memory_usage_percent,
                    'threshold': self.alert_thresholds['memory_usage_critical']
                })
            elif metrics.memory_usage_percent >= self.alert_thresholds['memory_usage_warning']:
                alerts.append({
                    'level': 'warning',
                    'type': 'memory_usage',
                    'message': f'GPU memory usage high: {metrics.memory_usage_percent:.1%}',
                    'value': metrics.memory_usage_percent,
                    'threshold': self.alert_thresholds['memory_usage_warning']
                })
            
            # Проверка температуры
            if metrics.temperature is not None:
                if metrics.temperature >= self.alert_thresholds['temperature_critical']:
                    alerts.append({
                        'level': 'critical',
                        'type': 'temperature',
                        'message': f'GPU temperature critical: {metrics.temperature}°C',
                        'value': metrics.temperature,
                        'threshold': self.alert_thresholds['temperature_critical']
                    })
                elif metrics.temperature >= self.alert_thresholds['temperature_warning']:
                    alerts.append({
                        'level': 'warning',
                        'type': 'temperature',
                        'message': f'GPU temperature high: {metrics.temperature}°C',
                        'value': metrics.temperature,
                        'threshold': self.alert_thresholds['temperature_warning']
                    })
            
            # Проверка error rate
            if metrics.error_rate >= self.alert_thresholds['error_rate_critical']:
                alerts.append({
                    'level': 'critical',
                    'type': 'error_rate',
                    'message': f'GPU error rate critical: {metrics.error_rate:.1%}',
                    'value': metrics.error_rate,
                    'threshold': self.alert_thresholds['error_rate_critical']
                })
            elif metrics.error_rate >= self.alert_thresholds['error_rate_warning']:
                alerts.append({
                    'level': 'warning',
                    'type': 'error_rate',
                    'message': f'GPU error rate high: {metrics.error_rate:.1%}',
                    'value': metrics.error_rate,
                    'threshold': self.alert_thresholds['error_rate_warning']
                })
            
            # Проверка health score
            if metrics.health_score <= self.alert_thresholds['health_score_critical']:
                alerts.append({
                    'level': 'critical',
                    'type': 'health_score',
                    'message': f'GPU health score critical: {metrics.health_score:.1f}',
                    'value': metrics.health_score,
                    'threshold': self.alert_thresholds['health_score_critical']
                })
            elif metrics.health_score <= self.alert_thresholds['health_score_warning']:
                alerts.append({
                    'level': 'warning',
                    'type': 'health_score',
                    'message': f'GPU health score low: {metrics.health_score:.1f}',
                    'value': metrics.health_score,
                    'threshold': self.alert_thresholds['health_score_warning']
                })
            
            # Отправляем алерты
            for alert in alerts:
                await self._send_alert(alert)
                
        except Exception as e:
            logger.error(f"Error checking alerts: {e}")

    async def _send_alert(self, alert: Dict[str, Any]):
        """Отправка алерта в систему мониторинга"""
        try:
            alert_data = {
                'timestamp': time.time(),
                'service': 'gpu_worker_pool',
                'component': 'gpu_health',
                **alert
            }
            
            # Отправляем в Redis для системы мониторинга
            if self.redis_client:
                self.redis_client.xadd('monitoring_alerts', alert_data)
            
            # Логируем алерт
            logger.warning(f"GPU Alert [{alert['level'].upper()}]: {alert['message']}")
            
            self.stats['alerts_sent'] += 1
            
        except Exception as e:
            logger.error(f"Error sending alert: {e}")

    async def _send_metrics_to_monitoring(self, metrics: GPUHealthMetrics):
        """Отправка метрик в систему мониторинга"""
        try:
            if not self.redis_client:
                return
            
            # Подготавливаем метрики для отправки
            monitoring_data = {
                'timestamp': metrics.timestamp,
                'service': 'gpu_worker_pool',
                'component': 'gpu_health',
                'metrics': asdict(metrics)
            }
            
            # Отправляем в Redis stream для мониторинга
            self.redis_client.xadd('monitoring_metrics', monitoring_data)
            
        except Exception as e:
            logger.error(f"Error sending metrics to monitoring: {e}")

    def _update_stats(self, metrics: GPUHealthMetrics):
        """Обновление статистики монитора"""
        self.stats['total_checks'] += 1
        self.stats['last_health_score'] = metrics.health_score
        self.stats['uptime'] = time.time() - self.start_time
        
        # Вычисляем средний health score
        if self.health_history:
            avg_score = sum(m.health_score for m in self.health_history) / len(self.health_history)
            self.stats['avg_health_score'] = avg_score

    def get_health_summary(self) -> Dict[str, Any]:
        """Получение сводки здоровья GPU"""
        if not self.health_history:
            return {
                'status': 'no_data',
                'message': 'No health data available',
                'health_score': 0.0
            }
        
        latest = self.health_history[-1]
        
        # Определяем общий статус
        if latest.health_score >= 80:
            status = 'healthy'
        elif latest.health_score >= 50:
            status = 'warning'
        else:
            status = 'critical'
        
        return {
            'status': status,
            'health_score': latest.health_score,
            'memory_usage_percent': latest.memory_usage_percent,
            'temperature': latest.temperature,
            'active_tasks': latest.active_tasks,
            'concurrent_workers': latest.concurrent_workers,
            'error_rate': latest.error_rate,
            'avg_processing_time': latest.avg_processing_time,
            'last_check': latest.timestamp,
            'uptime': self.stats['uptime'],
            'total_checks': self.stats['total_checks'],
            'alerts_sent': self.stats['alerts_sent']
        }

    def get_health_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Получение истории здоровья GPU"""
        history = self.health_history[-limit:] if limit > 0 else self.health_history
        return [asdict(metrics) for metrics in history]

    def get_stats(self) -> Dict[str, Any]:
        """Получение статистики монитора"""
        return {
            **self.stats,
            'health_history_size': len(self.health_history),
            'monitoring_interval': self.monitoring_interval,
            'alert_thresholds': self.alert_thresholds
        }

# Глобальный экземпляр
gpu_health_monitor = GPUHealthMonitor()
