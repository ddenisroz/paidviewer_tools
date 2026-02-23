#!/usr/bin/env python3
"""
Базовая TTS система на основе Google Text-to-Speech (gTTS)
Fallback система для bot_service, когда F5-TTS сервис недоступен
Не требует GPU, работает через API Google, доступна всем пользователям
"""
import logging
import re
from pathlib import Path
from typing import Optional
import time
from gtts import gTTS
from pydub import AudioSegment
logger = logging.getLogger(__name__)

class BasicTTS:
    """
    Базовая TTS система на основе gTTS для bot_service.
    
    Преимущества:
    - Не требует GPU или мощных ресурсов
    - Работает через Google API
    - Поддержка русского и английского языков
    - Доступна всем пользователям без whitelist
    - Быстрая генерация
    - Независима от tts_service
    """

    def __init__(self, temp_dir: Optional[Path]=None):
        """
        Инициализация базовой TTS системы
        
        Args:
            temp_dir: Директория для временных файлов (по умолчанию system temp)
        """
        if temp_dir:
            self.temp_dir = Path(temp_dir)
        else:
            from core.project_paths import TEMP_DIR
            self.temp_dir = TEMP_DIR / 'tts_audio'
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f'[OK] Базовая TTS (gTTS) инициализирована. Temp dir: {self.temp_dir}')

    def is_ready(self) -> bool:
        """Проверка готовности TTS (всегда готова)"""
        return True

    def detect_language(self, text: str) -> str:
        """
        Определяет язык текста.
        
        Returns:
            'ru' для русского, 'en' для английского
        """
        cyrillic_pattern = re.compile('[а-яё]', re.IGNORECASE)
        latin_pattern = re.compile('[a-z]', re.IGNORECASE)
        cyrillic_count = len(cyrillic_pattern.findall(text))
        latin_count = len(latin_pattern.findall(text))
        if cyrillic_count > latin_count:
            return 'ru'
        elif latin_count > cyrillic_count:
            return 'en'
        elif cyrillic_count > 0:
            return 'ru'
        else:
            return 'ru'

    def preprocess_text(self, text: str) -> str:
        """
        Предобработка текста для TTS.
        Применяет базовые конвертации без сложных модулей.
        """
        processed_text = re.sub('\\s+', ' ', text.strip())
        if not processed_text:
            return ''
        url_pattern = '(https?://|www\\.|[a-zA-Z0-9-]+\\.(com|ru|net|org|tv|gg|me|io|co|us|uk|de|fr|cn|jp|br|in|au|ca|eu))'
        if re.search(url_pattern, processed_text, re.IGNORECASE):
            logger.warning(f'[BLOCKED] Текст содержит URL - блокируем: {processed_text[:50]}...')
            return ''
        text_no_spaces = processed_text.replace(' ', '')
        has_letter_or_digit = any((c.isalnum() for c in text_no_spaces))
        if not has_letter_or_digit:
            logger.warning('Текст состоит только из символов - игнорируем')
            return ''
        processed_text = re.sub('(.)\\1{3,}', '\\1\\1\\1', processed_text)
        if not processed_text.strip():
            logger.warning('После удаления длинных последовательностей текст пустой')
            return ''
        if not processed_text.endswith(('.', '!', '?', 'Text cleaned.')):
            processed_text += '.'
        processed_text = re.sub('\\s+', ' ', processed_text).strip()
        return processed_text

    def synthesize_speech(self, text: str, volume_level: float=50.0, speed: float=1.0, voice: str='com', **kwargs) -> Optional[str]:
        """
        Синтезирует речь с использованием gTTS.
        
        Args:
            text: Текст для озвучки
            volume_level: Уровень громкости (0-100)
            speed: Скорость речи (0.5-2.0, по умолчанию 1.0)
            voice: Акцент/голос (tld параметр): 'com', 'co.uk', 'com.au', 'co.in', 'ca', 'ru' и т.д.
            **kwargs: Дополнительные параметры (игнорируются для совместимости)
        
        Returns:
            Путь к сгенерированному аудио файлу или None при ошибке
        """
        try:
            processed_text = self.preprocess_text(text)
            if not processed_text:
                logger.warning('Текст пустой после предобработки')
                return None
            language = self.detect_language(processed_text)
            logger.info(f"[LANG] Базовая TTS: язык={language}, текст='{processed_text[:50]}...'")
            timestamp = int(time.time() * 1000)
            temp_mp3 = self.temp_dir / f'basic_tts_{timestamp}.mp3'
            output_wav = self.temp_dir / f'basic_tts_{timestamp}.wav'
            slow_mode = speed < 0.8
            tld = voice if voice else 'com'
            tts = gTTS(text=processed_text, lang=language, slow=slow_mode, tld=tld)
            tts.save(str(temp_mp3))
            logger.info(f'[MIC] gTTS: язык={language}, акцент={tld}, slow={slow_mode}')
            logger.info(f'[OK] gTTS аудио сгенерировано: {temp_mp3}')
            audio = AudioSegment.from_mp3(str(temp_mp3))
            if not slow_mode and speed != 1.0:
                speed_factor = speed
                audio = audio.speedup(playback_speed=speed_factor)
                logger.info(f'⏩ Применена скорость: {speed}x')
            if volume_level != 50.0:
                db_change = (volume_level - 50) / 50 * 10
                audio = audio + db_change
                logger.info(f'[VOLUME] Применена громкость: {volume_level}% ({db_change:+.1f}dB)')
            silence = AudioSegment.silent(duration=300)
            audio = audio + silence
            audio.export(str(output_wav), format='wav', parameters=['-ar', '24000', '-ac', '1'])
            logger.info(f'[DB] Базовая TTS: сохранено в WAV: {output_wav}')
            try:
                temp_mp3.unlink()
            except Exception:
                logger.exception('Не удалось удалить временный MP3')
            return str(output_wav.resolve())
        except Exception:
            logger.exception('[ERROR] Ошибка при генерации аудио через gTTS')
            return None

    def cleanup_old_files(self, max_age_seconds: int=3600):
        """
        Очистка старых временных файлов
        
        Args:
            max_age_seconds: Максимальный возраст файлов в секундах (по умолчанию 1 час)
        """
        try:
            current_time = time.time()
            deleted_count = 0
            for file_path in self.temp_dir.glob('basic_tts_*'):
                if file_path.is_file():
                    file_age = current_time - file_path.stat().st_mtime
                    if file_age > max_age_seconds:
                        file_path.unlink()
                        deleted_count += 1
            if deleted_count > 0:
                logger.info(f'[DELETE] Очищено {deleted_count} старых файлов базовой TTS')
        except Exception:
            logger.exception('[ERROR] Ошибка при очистке временных файлов')
_basic_tts_instance = None

def get_basic_tts() -> BasicTTS:
    """Получить глобальный экземпляр базовой TTS (singleton)"""
    global _basic_tts_instance
    if _basic_tts_instance is None:
        _basic_tts_instance = BasicTTS()
    return _basic_tts_instance
