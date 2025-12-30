# bot_service/services/admin/logs_service.py
"""
Сервис работы с логами.
"""

import os
import glob
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from core.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)


class LogsService:
    """Сервис для работы с системными логами."""

    def __init__(self):
        self._log_dirs = self._get_log_directories()

    def _get_log_directories(self) -> List[str]:
        """Получить список директорий с логами."""
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        dirs = []

        # bot_service/logs
        log_dir = os.path.join(base_dir, 'logs')
        if os.path.exists(log_dir):
            dirs.append(log_dir)

        # root/logs
        root_log_dir = os.path.join(os.path.dirname(base_dir), 'logs')
        if os.path.exists(root_log_dir):
            dirs.append(root_log_dir)

        return dirs

    def _parse_log_line(self, line: str) -> Optional[Dict[str, Any]]:
        """Парсит строку лога."""
        line = line.strip()
        if not line:
            return None

        # Формат: TIMESTAMP LEVEL MODULE: MESSAGE
        parts = line.split(' ', 3)
        if len(parts) >= 4:
            timestamp_str = f"{parts[0]} {parts[1]}"
            log_level = parts[2]
            message_part = parts[3]

            # Извлекаем модуль
            module = "system"
            message = message_part
            if ':' in message_part:
                module_part, msg = message_part.split(':', 1)
                module = module_part.strip()
                message = msg.strip()

            # Парсим timestamp
            try:
                timestamp = datetime.fromisoformat(
                    timestamp_str.replace('Z', '+00:00')
                )
            except ValueError:
                try:
                    timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    timestamp = utcnow_naive()

            return {
                "timestamp": timestamp.isoformat(),
                "level": log_level.upper(),
                "module": module,
                "message": message
            }

        # Fallback: не удалось распарсить
        return {
            "timestamp": utcnow_naive().isoformat(),
            "level": "INFO",
            "module": "system",
            "message": line
        }

    async def get_system_logs(
        self,
        level: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100
    ) -> dict:
        """Получить системные логи с фильтрацией."""
        logs: List[Dict[str, Any]] = []

        try:
            # Собираем все .log файлы
            log_files = []
            for log_dir in self._log_dirs:
                log_files.extend(glob.glob(os.path.join(log_dir, '*.log')))

            # Читаем логи
            for log_file in log_files:
                try:
                    with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                        for line in f:
                            parsed = self._parse_log_line(line)
                            if parsed:
                                logs.append(parsed)
                except Exception as e:
                    logger.error(f"Error reading log file {log_file}: {e}")

            # Сортируем по времени (новые сверху)
            logs.sort(key=lambda x: x["timestamp"], reverse=True)

        except Exception as e:
            logger.error(f"Error reading system logs: {e}")
            logs = []

        # Фильтрация по уровню
        if level:
            logs = [log for log in logs if log["level"] == level.upper()]

        # Фильтрация по поиску
        if search:
            search_lower = search.lower()
            logs = [log for log in logs if search_lower in log["message"].lower()]

        # Ограничение количества
        logs = logs[:limit]

        return {
            "logs": logs,
            "total": len(logs),
            "filters": {
                "level": level,
                "search": search,
                "limit": limit
            }
        }

    async def get_bots_logs(self) -> dict:
        """
        Получить логи ботов из файлов.
        
        Note: В будущем можно реализовать чтение из отдельных файлов логов ботов.
        Сейчас возвращаем пустой список, так как логи доступны через основной лог-файл.
        """
        # Логи ботов доступны через основной лог-файл (logs/bot_service.log)
        # Если нужны отдельные файлы логов для каждого бота, можно настроить
        # отдельные handlers в logging_config.py
        return {
            "logs": [],
            "message": "Bot logs are available in the main log file (logs/bot_service.log)"
        }

    async def export_system_logs(
        self,
        level: Optional[str] = None,
        search: Optional[str] = None
    ) -> dict:
        """Экспортировать системные логи в CSV."""
        logs_data = await self.get_system_logs(level, search, limit=1000)

        # Генерируем CSV
        csv_lines = ["timestamp,level,module,message"]
        for log in logs_data["logs"]:
            # Экранируем кавычки в сообщении
            message = log['message'].replace('"', '""')
            csv_lines.append(
                f"{log['timestamp']},{log['level']},{log['module']},\"{message}\""
            )

        csv_content = "\n".join(csv_lines)

        return {
            "content": csv_content,
            "filename": f"system_logs_{utcnow_naive().strftime('%Y%m%d_%H%M%S')}.csv",
            "mime_type": "text/csv"
        }


# Singleton instance
logs_service = LogsService()
