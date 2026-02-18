import logging
import soundfile as sf
import librosa
import numpy as np

logger = logging.getLogger('tts_simple.audio')

def convert_audio_to_wav_48khz(input_path: str, output_path: str) -> bool:
    """
    Конвертировать аудио в WAV 48kHz Mono 16-bit для F5-TTS
    """
    try:
        logger.info(f"[REFRESH] Converting audio: {input_path} -> {output_path}")
        
        # Загружаем аудио с ресемплингом до 48kHz и конвертацией в моно
        audio, sr = librosa.load(input_path, sr=48000, mono=True)
        
        # Нормализуем громкость
        audio = librosa.util.normalize(audio)
        
        # Убедимся что в int16 диапазоне
        audio = np.clip(audio, -1.0, 1.0)
        
        # Сохраняем как WAV 16-bit PCM
        sf.write(output_path, audio, 48000, subtype='PCM_16')
        
        logger.info(f"[OK] Audio converted successfully to WAV 48kHz Mono 16-bit")
        return True
        
    except Exception:
        logger.exception("[ERROR] Audio conversion failed")
        return False

def transcribe_audio(audio_path: str) -> str:
    """
    Транскрибировать аудио используя Whisper
    """
    try:
        # Пробуем faster-whisper (быстрее)
        try:
            from faster_whisper import WhisperModel
            model = WhisperModel("base", device="auto", compute_type="auto")
            segments, info = model.transcribe(audio_path, language="ru")
            text = " ".join([segment.text for segment in segments])
            logger.info(f"[OK] Transcribed with faster-whisper: '{text[:50]}...'")
            return text.strip()
        except ImportError:
            logger.warning("faster-whisper not available, trying whisper")
        
        # Fallback на обычный whisper
        try:
            import whisper
            model = whisper.load_model("base")
            result = model.transcribe(audio_path, language="ru")
            text = result.get("text", "").strip()
            logger.info(f"[OK] Transcribed with whisper: '{text[:50]}...'")
            return text
        except ImportError:
            logger.warning("whisper not available, skipping transcription")
            return ""
            
    except Exception:
        logger.exception("[ERROR] Transcription failed")
        return ""

