import logging
import asyncio
import psutil
import GPUtil
from typing import Dict, Any

logger = logging.getLogger('tts_simple.monitor')

async def monitor_system():
    """Мониторинг системы"""
    while True:
        try:
            # Проверяем использование памяти
            # memory = psutil.virtual_memory() # Unused variable
            
            # Проверяем GPU
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]
                if gpu.memoryUsed / gpu.memoryTotal > 0.9:
                    logger.warning("[WARN] Высокое использование GPU памяти!")
            
            # Ждем 30 секунд
            await asyncio.sleep(30)
            
        except Exception:
            logger.exception("Ошибка мониторинга")
            await asyncio.sleep(60)

def get_system_stats() -> Dict[str, Any]:
    """Получить текущую статистику системы"""
    memory = psutil.virtual_memory()
    memory_usage = {
        "total": memory.total,
        "available": memory.available,
        "used": memory.used,
        "percentage": memory.percent
    }
    
    gpu_info = {}
    try:
        gpus = GPUtil.getGPUs()
        if gpus:
            gpu = gpus[0]
            gpu_info = {
                "name": gpu.name,
                "memory_total": gpu.memoryTotal,
                "memory_free": gpu.memoryFree,
                "memory_used": gpu.memoryUsed,
                "temperature": gpu.temperature,
                "load": gpu.load * 100
            }
    except Exception:
        logger.exception("Failed to read GPU stats")
        
    return {
        "memory_usage": memory_usage,
        "gpu_info": gpu_info
    }

