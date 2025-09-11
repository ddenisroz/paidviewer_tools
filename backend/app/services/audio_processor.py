"""
Сервис для обработки аудио файлов:
- Конвертация в WAV
- Обрезка до максимальной длительности
- Валидация размера файла
"""

import os
import tempfile
from pathlib import Path
from typing import Tuple, Optional
import logging

from pydub import AudioSegment
from pydub.exceptions import CouldntDecodeError
import io

logger = logging.getLogger(__name__)

class AudioProcessor:
    MAX_FILE_SIZE_MB = 10
    MAX_DURATION_SECONDS = 60
    TARGET_SAMPLE_RATE = 22050  # Стандарт для chatterbox-tts
    
    SUPPORTED_FORMATS = {
        '.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', 
        '.wma', '.opus', '.mp4', '.webm'
    }
    
    @classmethod
    def validate_file_size(cls, file_content: bytes) -> bool:
        """Проверка размера файла"""
        size_mb = len(file_content) / (1024 * 1024)
        return size_mb <= cls.MAX_FILE_SIZE_MB
    
    @classmethod
    def get_file_extension(cls, filename: str) -> str:
        """Получение расширения файла"""
        return Path(filename).suffix.lower()
    
    @classmethod
    def is_supported_format(cls, filename: str) -> bool:
        """Проверка поддерживаемого формата"""
        ext = cls.get_file_extension(filename)
        return ext in cls.SUPPORTED_FORMATS
    
    @classmethod
    def process_audio_file(cls, file_content: bytes, original_filename: str) -> Tuple[bytes, dict]:
        """
        Основная функция обработки аудио файла
        
        Returns:
            Tuple[bytes, dict]: (WAV данные, информация о файле)
        """
        # Валидация размера
        if not cls.validate_file_size(file_content):
            raise ValueError(f"Файл слишком большой. Максимальный размер: {cls.MAX_FILE_SIZE_MB}МБ")
        
        # Валидация формата
        if not cls.is_supported_format(original_filename):
            supported = ", ".join(cls.SUPPORTED_FORMATS)
            raise ValueError(f"Неподдерживаемый формат файла. Поддерживаемые: {supported}")
        
        try:
            # Загружаем аудио из bytes
            audio_file = io.BytesIO(file_content)
            audio = AudioSegment.from_file(audio_file)
            
            # Информация об оригинальном файле
            original_duration = len(audio) / 1000.0  # в секундах
            original_sample_rate = audio.frame_rate
            
            logger.info(f"Оригинальный файл: {original_duration:.1f}с, {original_sample_rate}Hz")
            
            # Обрезаем до максимальной длительности
            if original_duration > cls.MAX_DURATION_SECONDS:
                audio = audio[:cls.MAX_DURATION_SECONDS * 1000]  # pydub работает в миллисекундах
                logger.info(f"Файл обрезан до {cls.MAX_DURATION_SECONDS} секунд")
            
            # Конвертируем в нужный формат для chatterbox
            # Mono, 22050Hz, 16-bit
            audio = audio.set_frame_rate(cls.TARGET_SAMPLE_RATE)
            audio = audio.set_channels(1)  # mono
            audio = audio.set_sample_width(2)  # 16-bit
            
            # Нормализация громкости (пиковая нормализация до -3дБ)
            audio = audio.normalize().apply_gain(-3.0)
            
            # Экспортируем в WAV
            output_buffer = io.BytesIO()
            audio.export(output_buffer, format="wav")
            wav_data = output_buffer.getvalue()
            
            # Информация о результате
            final_duration = len(audio) / 1000.0
            info = {
                "original_filename": original_filename,
                "original_duration": round(original_duration, 2),
                "original_sample_rate": original_sample_rate,
                "final_duration": round(final_duration, 2),
                "final_sample_rate": cls.TARGET_SAMPLE_RATE,
                "file_size_kb": round(len(wav_data) / 1024, 1),
                "was_trimmed": original_duration > cls.MAX_DURATION_SECONDS
            }
            
            logger.info(f"Обработка завершена: {info}")
            return wav_data, info
            
        except CouldntDecodeError as e:
            raise ValueError(f"Не удалось декодировать аудио файл. Убедитесь, что файл не поврежден: {str(e)}")
        except Exception as e:
            logger.error(f"Ошибка обработки аудио: {str(e)}")
            raise ValueError(f"Ошибка обработки аудио файла: {str(e)}")
    
    @classmethod
    def get_audio_info(cls, file_content: bytes, filename: str) -> Optional[dict]:
        """Получение информации об аудио файле без обработки"""
        try:
            audio_file = io.BytesIO(file_content)
            audio = AudioSegment.from_file(audio_file)
            
            return {
                "duration": round(len(audio) / 1000.0, 2),
                "sample_rate": audio.frame_rate,
                "channels": audio.channels,
                "sample_width": audio.sample_width,
                "file_size_mb": round(len(file_content) / (1024 * 1024), 2)
            }
        except Exception as e:
            logger.error(f"Ошибка получения информации об аудио: {str(e)}")
            return None

