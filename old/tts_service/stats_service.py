# tts_service/stats_service.py
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

class StatsService:
    """
    Централизованный сервис для сбора статистики всех компонентов TTS
    """
    
    def __init__(self):
        self.components = {}
    
    def register_component(self, name: str, component):
        """Регистрация компонента для сбора статистики"""
        self.components[name] = component
        logger.info(f"Registered stats component: {name}")
    
    def get_component_stats(self, component_name: str) -> Dict[str, Any]:
        """Получить статистику конкретного компонента"""
        if component_name not in self.components:
            return {"error": f"Component {component_name} not found"}
        
        try:
            component = self.components[component_name]
            if hasattr(component, 'get_stats'):
                return component.get_stats()
            else:
                return {"error": f"Component {component_name} has no get_stats method"}
        except Exception as e:
            logger.error(f"Error getting stats for {component_name}: {e}")
            return {"error": str(e)}
    
    def get_all_stats(self) -> Dict[str, Any]:
        """Получить статистику всех зарегистрированных компонентов"""
        stats = {}
        
        for name, component in self.components.items():
            try:
                if hasattr(component, 'get_stats'):
                    stats[name] = component.get_stats()
                else:
                    stats[name] = {"error": "No get_stats method"}
            except Exception as e:
                logger.error(f"Error getting stats for {name}: {e}")
                stats[name] = {"error": str(e)}
        
        return stats
    
    def get_system_overview(self) -> Dict[str, Any]:
        """Получить общий обзор системы"""
        try:
            # Собираем статистику всех компонентов
            all_stats = self.get_all_stats()
            
            # Анализируем состояние системы
            overview = {
                "timestamp": datetime.now().isoformat(),
                "components": {},
                "system_status": "unknown",
                "active_components": 0,
                "total_requests": 0,
                "gpu_available": False,
                "errors": []
            }
            
            for name, stats in all_stats.items():
                if isinstance(stats, dict) and "error" not in stats:
                    overview["components"][name] = {
                        "status": stats.get("status", "unknown"),
                        "running": stats.get("running", False),
                        "requests_processed": stats.get("requests_processed", 0),
                        "errors": stats.get("errors", 0)
                    }
                    
                    if stats.get("running", False):
                        overview["active_components"] += 1
                    
                    overview["total_requests"] += stats.get("requests_processed", 0)
                    
                    if "gpu_available" in stats:
                        overview["gpu_available"] = stats["gpu_available"]
                    
                    if stats.get("errors", 0) > 0:
                        overview["errors"].append(f"{name}: {stats['errors']} errors")
                else:
                    overview["errors"].append(f"{name}: {stats.get('error', 'Unknown error')}")
            
            # Определяем общий статус системы
            if overview["active_components"] == 0:
                overview["system_status"] = "stopped"
            elif len(overview["errors"]) == 0:
                overview["system_status"] = "healthy"
            elif len(overview["errors"]) < len(overview["components"]):
                overview["system_status"] = "degraded"
            else:
                overview["system_status"] = "error"
            
            return overview
            
        except Exception as e:
            logger.error(f"Error getting system overview: {e}")
            return {
                "timestamp": datetime.now().isoformat(),
                "system_status": "error",
                "error": str(e)
            }
    
    def get_health_summary(self) -> Dict[str, Any]:
        """Получить сводку здоровья системы"""
        try:
            overview = self.get_system_overview()
            
            health_summary = {
                "status": overview["system_status"],
                "timestamp": overview["timestamp"],
                "active_components": overview["active_components"],
                "total_components": len(self.components),
                "gpu_available": overview["gpu_available"],
                "total_requests": overview["total_requests"],
                "issues": overview["errors"]
            }
            
            return health_summary
            
        except Exception as e:
            logger.error(f"Error getting health summary: {e}")
            return {
                "status": "error",
                "timestamp": datetime.now().isoformat(),
                "error": str(e)
            }

# Глобальный экземпляр
stats_service = StatsService()
