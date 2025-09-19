# -*- coding: utf-8 -*-
"""
TTS Microservice
Отдельный сервис для генерации речи
"""
import asyncio
import logging
import os
import sys
import io
import locale
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

# --- Force UTF-8 environment early (must be set before heavy libs import) ---
os.environ.setdefault("PYTHONUTF8", "1")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

# --- Force stdout/stderr to UTF-8 at runtime ---
try:
    # Python 3.7+: TextIOWrapper has reconfigure
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    # fallback: wrap the buffer
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer)
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.buffer)

# --- Reconfigure root logger to explicitly use sys.stdout (now UTF-8) ---
root_logger = logging.getLogger()
# remove existing handlers to avoid duplicate/foreign handlers (uvicorn etc.)
for h in list(root_logger.handlers):
    root_logger.removeHandler(h)

handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
root_logger.setLevel(logging.INFO)
root_logger.addHandler(handler)

# --- DEBUG: print encodings so we can verify at startup ---
print("DEBUG: sys.getdefaultencoding():", sys.getdefaultencoding())
print("DEBUG: sys.stdout.encoding:", getattr(sys.stdout, "encoding", None))
print("DEBUG: locale.getpreferredencoding():", locale.getpreferredencoding())
print("DEBUG: PYTHONIOENCODING:", os.environ.get("PYTHONIOENCODING"))
print("DEBUG: PYTHONUTF8:", os.environ.get("PYTHONUTF8"))

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn
from pydub import AudioSegment
import shutil
import uuid
import json
import datetime
import jwt
import os
 

# Импорты TTS
# Добавляем абсолютный путь к папке TTS_rus_engine, чтобы импорт работал из любого CWD
try:
    base_dir = Path(__file__).resolve().parent
    tts_engine_dir = str(base_dir / 'TTS_rus_engine')
    if tts_engine_dir not in sys.path:
        sys.path.insert(0, tts_engine_dir)
except Exception:
    pass

from russian_tts import RussianTTS
from yoficator_module import Yoficator

logger = logging.getLogger(__name__)

# Глобальные переменные для TTS
tts_engine: Optional[RussianTTS] = None
yoficator: Optional[Yoficator] = None

# Адаптивная система TTS (оптимизированная для одного пользователя)
import threading
from concurrent.futures import ThreadPoolExecutor
import queue
import time

# Система очереди задач с общим GPU
import queue
import threading
from dataclasses import dataclass
from typing import Optional, Callable, Any
import time

@dataclass
class TTSWorkerTask:
    """Задача для TTS синтеза"""
    request_id: str
    text: str
    voice_path: str
    ref_text: str
    settings: dict
    callback: Callable[[str, Optional[str]], None]  # (result_path, error)
    timestamp: float

# Глобальная очередь задач
task_queue = queue.Queue()
tts_workers = []
shutdown_event = threading.Event()
active_users = set()

def tts_worker(worker_id: int):
    """Воркер для обработки TTS задач"""
    logger.info(f"TTS Worker {worker_id} запущен")
    
    while not shutdown_event.is_set():
        try:
            # Получаем задачу из очереди (с таймаутом)
            task = task_queue.get(timeout=1.0)
            if task is None:  # Сигнал завершения
                break
                
            logger.info(f"Worker {worker_id} обрабатывает задачу {task.request_id}")
            
            try:
                # Выполняем синтез через TTS движок напрямую
                temp_dir = str(base_dir / "temp_audio")
                os.makedirs(temp_dir, exist_ok=True)
                temp_path = f"{temp_dir}/tts_{task.request_id}.wav"
                
                result_path = tts_engine.synthesize_speech(
                    text=task.text,
                    ref_audio_path=task.voice_path,
                    ref_text=task.ref_text,
                    cross_fade_duration=task.settings.get('cross_fade', 0.15),
                    speed=task.settings.get('speed'),
                    silence_duration_ms=task.settings.get('silence_duration', 100),
                    target_rms=task.settings.get('target_rms', 0.4),
                    sway_sampling_coef=task.settings.get('sway_sampling_coef', -1.0),
                    cfg_strength=task.settings.get('cfg_strength', 2.0),
                    nfe_step=task.settings.get('nfe_step'),
                    fix_duration=task.settings.get('fix_duration'),
                    remove_silence=task.settings.get('remove_silence', False),
                    seed=task.settings.get('seed')
                )
                
                # Если результат получен, копируем в нужное место
                if result_path and os.path.exists(result_path):
                    shutil.copy2(result_path, temp_path)
                    result_path = temp_path
                
                # Вызываем callback с результатом
                task.callback(result_path, None)
                logger.info(f"Worker {worker_id} завершил задачу {task.request_id}")
                
            except Exception as e:
                logger.error(f"Worker {worker_id} ошибка в задаче {task.request_id}: {e}")
                task.callback(None, str(e))
            
            finally:
                task_queue.task_done()
                
        except queue.Empty:
            continue
        except Exception as e:
            logger.error(f"Worker {worker_id} ошибка: {e}")
    
    logger.info(f"TTS Worker {worker_id} остановлен")

def start_tts_workers(num_workers: int = 1):
    """Запуск воркеров для обработки TTS"""
    global tts_workers, shutdown_event
    
    # Останавливаем существующих воркеров
    stop_tts_workers()
    
    shutdown_event.clear()
    tts_workers = []
    
    for i in range(num_workers):
        worker = threading.Thread(target=tts_worker, args=(i+1,), daemon=True)
        worker.start()
        tts_workers.append(worker)
        logger.info(f"Запущен TTS Worker {i+1}")
    
    logger.info(f"Запущено {num_workers} TTS воркеров")

def stop_tts_workers():
    """Остановка всех TTS воркеров"""
    global tts_workers, shutdown_event
    
    if tts_workers:
        logger.info("Остановка TTS воркеров...")
        shutdown_event.set()
        
        # Отправляем сигналы завершения
        for _ in tts_workers:
            task_queue.put(None)
        
        # Ждем завершения
        for worker in tts_workers:
            worker.join(timeout=5.0)
        
        tts_workers = []
        logger.info("TTS воркеры остановлены")

def update_workers_count():
    """Обновить количество воркеров в зависимости от нагрузки"""
    current_workers = len(tts_workers)
    needed_workers = 1 if len(active_users) <= 1 else min(4, len(active_users))
    
    if current_workers != needed_workers:
        logger.info(f"Обновляем воркеров: {current_workers} -> {needed_workers} (активных пользователей: {len(active_users)})")
        start_tts_workers(needed_workers)

def process_tts_synthesis_direct(text, voice_path, ref_text, cross_fade, speed, silence_duration, 
                                target_rms, sway_sampling_coef, cfg_strength, nfe_step, 
                                fix_duration, remove_silence, seed, output_path):
    """Прямой синтез речи (оптимизированный для одного пользователя)"""
    try:
        logger.info(f"Начинаем синтез: '{text[:50]}...'")
        
        # Синтезируем речь напрямую
        logger.info(f"Вызываем synthesize_speech с параметрами:")
        logger.info(f"  text: '{text}'")
        logger.info(f"  ref_audio_path: '{voice_path}'")
        logger.info(f"  ref_text: '{ref_text}'")
        logger.info(f"  output_path: '{output_path}'")
        
        result_path = tts_engine.synthesize_speech(
            text=text,
            ref_audio_path=voice_path,
            ref_text=ref_text,
            cross_fade_duration=cross_fade,
            speed=speed,
            silence_duration_ms=silence_duration,
            target_rms=target_rms,
            sway_sampling_coef=sway_sampling_coef,
            cfg_strength=cfg_strength,
            nfe_step=nfe_step,
            fix_duration=fix_duration,
            remove_silence=remove_silence,
            seed=seed
        )
        
        logger.info(f"Синтез завершен: {result_path}")
        
        # Проверяем, что файл создался и не пустой
        if result_path and os.path.exists(result_path):
            file_size = os.path.getsize(result_path)
            logger.info(f"Файл создан: {result_path}, размер: {file_size} байт")
            if file_size == 0:
                logger.error(f"Файл пустой: {result_path}")
                return None
                
            # Копируем файл в нужное место
            import shutil
            shutil.copy2(result_path, output_path)
            logger.info(f"Файл скопирован: {result_path} -> {output_path}")
            
        else:
            logger.error(f"Файл не создан: {result_path}")
            return None
            
        return output_path
        
    except Exception as e:
        logger.error(f"Ошибка синтеза: {e}")
        return None

async def cleanup_inactive_users(user_id: str):
    """Очистка неактивных пользователей"""
    await asyncio.sleep(300)  # Ждем 5 минут
    if user_id in active_users:
        active_users.discard(user_id)
        logger.info(f"Пользователь {user_id} удален из активных")
        update_workers_count()

# Настройки безопасности
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Проверка JWT токена"""
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Требуется авторизация",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Неверный токен")
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Неверный токен")

def verify_guest_or_auth(request: Request):
    """Проверка гостевого режима или авторизации"""
    # Проверяем куки для гостевого режима
    if request.cookies.get("guest_mode") == "true":
        return "guest"
    
    # Проверяем Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: str = payload.get("user_id")
            if user_id:
                return user_id
        except jwt.PyJWTError:
            pass
    
    raise HTTPException(status_code=401, detail="Требуется авторизация или гостевой режим")

 

class TTSRequest(BaseModel):
    text: str
    voice_name: str
    channel_name: str
    settings: dict = {}

class TTSSettings(BaseModel):
    """Настройки TTS движка"""
    cross_fade: float = 0.15
    speed: Optional[float] = None  # Auto-detect если None
    silence_duration: int = 100
    target_rms: float = 0.4
    sway_sampling_coef: float = -1.0
    cfg_strength: float = 2.0
    nfe_step: Optional[int] = None  # Auto-detect если None
    fix_duration: Optional[float] = None
    remove_silence: bool = False
    seed: Optional[int] = None

class AdminVoiceUpload(BaseModel):
    """Загрузка голоса админом"""
    voice_name: str
    ref_text: str = ""
    settings: TTSSettings = TTSSettings()

class TTSResponse(BaseModel):
    success: bool
    audio_url: Optional[str] = None
    error: Optional[str] = None
    duration_ms: Optional[int] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Инициализация и очистка ресурсов"""
    global tts_engine, yoficator
    
    # Инициализация
    logger.info("Инициализация TTS сервиса...")
    try:
        tts_engine = RussianTTS()
        yoficator = Yoficator()
        
        # Запускаем 1 воркер по умолчанию (использует 100% GPU)
        start_tts_workers(1)
        
        logger.info("TTS сервис готов к работе")
    except Exception as e:
        logger.error(f"Ошибка инициализации TTS: {e}")
        raise
    
    yield
    
    # Очистка
    logger.info("Завершение работы TTS сервиса...")
    stop_tts_workers()

app = FastAPI(
    title="TTS Microservice",
    description="Сервис генерации речи для Twitch бота",
    version="1.0.0",
    lifespan=lifespan
)

# Подключаем админ панель
try:
    from api_admin import admin_router
    app.include_router(admin_router)
    logger.info("Админ панель подключена")
except ImportError as e:
    logger.warning(f"Не удалось подключить админ панель: {e}")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:3000",
        "http://localhost:3001",  # Для админ панели
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Устанавливаем кодировку UTF-8 для всех ответов
@app.middleware("http")
async def add_utf8_encoding(request, call_next):
    response = await call_next(request)
    response.headers["Content-Type"] = "application/json; charset=utf-8"
    return response

@app.get("/health")
async def health_check():
    """Проверка состояния сервиса"""
    # Получаем список голосов
    voices = []
    voices_dir = base_dir / "voices"
    if voices_dir.exists():
        for file_path in voices_dir.glob("*.wav"):
            voices.append({
                "name": file_path.stem,
                "filename": file_path.name,
                "path": str(file_path)
            })
    
    # Статистика производительности
    worker_info = {
        "active_workers": len(tts_workers),
        "queue_size": task_queue.qsize(),
        "active_users": len(active_users)
    }
    
    return {
        "status": "healthy",
        "tts_ready": tts_engine is not None,
        "yoficator_ready": yoficator is not None,
        "engine_type": "russian_tts" if tts_engine is not None else "none",
        "ready": tts_engine is not None and yoficator is not None,
        "voices": voices,
        "performance": {
            "active_users": len(active_users),
            "mode": "single_user" if len(active_users) <= 1 else "multi_user",
            "workers": worker_info
        }
    }

@app.post("/api/tts/synthesize", response_model=TTSResponse)
async def synthesize_speech(request: TTSRequest, background_tasks: BackgroundTasks, auth_request: Request = None):
    """Синтез речи"""
    global tts_engine, yoficator
    
    if not tts_engine or not yoficator:
        raise HTTPException(status_code=503, detail="TTS сервис не готов")
    
    try:
        # Обработка текста
        processed_text = request.text.strip()
        if not processed_text:
            return TTSResponse(success=False, error="Пустой текст")
        
        # Предобработку (ёфикация, ударения, нормализация) выполняем внутри движка,
        # чтобы избежать дублирования и нежелательных артефактов.
        
        # Путь к голосу (используем конвертированный файл 24000 Hz)
        voice_path = str((base_dir / "voices" / f"{request.voice_name}_24000.wav"))
        if not os.path.exists(voice_path):
            # Пробуем обычную версию без _24000
            voice_path = str(base_dir / "voices" / f"{request.voice_name}.wav")
        if not os.path.exists(voice_path):
            # Fallback на speaker1_24000
            voice_path = str(base_dir / "voices" / "speaker1_24000.wav")
            logger.info(f"Используем fallback голос: {voice_path}")

        # Читаем референсный текст из sidecar файла
        ref_text_value = ""
        voice_name_base = Path(voice_path).stem  # Получаем имя файла без расширения
        ref_text_path = base_dir / "voices" / f"{voice_name_base}.txt"
        
        if ref_text_path.exists():
            try:
                with open(ref_text_path, 'r', encoding='utf-8') as f:
                    ref_text_value = f.read().strip()
                logger.info(f"Загружен референсный текст из {ref_text_path}: '{ref_text_value[:100]}...'")
            except Exception as e:
                logger.warning(f"Ошибка чтения референсного текста из {ref_text_path}: {e}")
                ref_text_value = ""
        else:
            logger.info(f"Файл референсного текста {ref_text_path} не найден, будет использован дефолтный")

        # Диагностика параметров референсного аудио
        try:
            import wave as _wave
            with _wave.open(voice_path, 'rb') as wf:
                sr = wf.getframerate()
                ch = wf.getnchannels()
                sw = wf.getsampwidth()
                frames = wf.getnframes()
                dur = (frames / float(sr)) if sr else 0
                logger.info(f"Референсный WAV: sr={sr}Hz ch={ch} sw={sw*8}bit dur={dur:.2f}s path={voice_path}")
        except Exception as e:
            logger.warning(f"Не удалось прочитать WAV параметры: {e}")
        
        # Создание временного файла в локальной директории
        import uuid
        temp_dir = str(base_dir / "temp_audio")
        os.makedirs(temp_dir, exist_ok=True)
        temp_filename = f"tts_{uuid.uuid4().hex}.wav"
        temp_path = os.path.join(temp_dir, temp_filename)
        
        # Добавляем задачу удаления файла после воспроизведения
        async def cleanup_temp_file(file_path):
            """Удаляет временный файл после воспроизведения"""
            await asyncio.sleep(30)  # Ждем 30 секунд для воспроизведения
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"Временный файл удален: {file_path}")
            except Exception as e:
                logger.warning(f"Не удалось удалить временный файл {file_path}: {e}")
        
        # Планируем удаление файла через 30 секунд (время на воспроизведение)
        background_tasks.add_task(cleanup_temp_file, temp_path)
        
        # Синтез речи
        logger.info(f"Синтезируем: '{processed_text}' используя голос '{voice_path}'")
        
        # Параметры из настроек
        settings = request.settings or {}
        cross_fade = settings.get('cross_fade', settings.get('cross_fade_duration', 0.15))
        speed = settings.get('speed', None)
        silence_duration = settings.get('silence_duration', 100)
        target_rms = settings.get('target_rms', 0.4)
        sway_sampling_coef = settings.get('sway_sampling_coef', -1.0)
        cfg_strength = settings.get('cfg_strength', 2.0)
        nfe_step = settings.get('nfe_step', None)
        fix_duration = settings.get('fix_duration')
        remove_silence = settings.get('remove_silence', False)
        seed = settings.get('seed')
        
        # Получаем user_id из авторизации
        user_id = 'guest'
        if auth_request:
            try:
                user_id = verify_guest_or_auth(auth_request)
            except:
                user_id = 'guest'
        
        # Отслеживаем активных пользователей и обновляем воркеры
        active_users.add(user_id)
        update_workers_count()
        
        # Создаем задачу для очереди
        result_future = asyncio.Future()
        
        # Генерируем уникальный ID для запроса
        request_id = f"tts_{int(time.time() * 1000)}_{user_id}"
        
        def tts_callback(result_path, error):
            """Callback для результата TTS"""
            if error:
                result_future.set_exception(Exception(error))
            else:
                result_future.set_result(result_path)
        
        # Создаем задачу
        tts_task = TTSWorkerTask(
            request_id=request_id,
            text=processed_text,
            voice_path=voice_path,
            ref_text=ref_text_value,
            settings=settings,
            callback=tts_callback,
            timestamp=time.time()
        )
        
        # Добавляем задачу в очередь
        task_queue.put(tts_task)
        logger.info(f"Задача {request_id} добавлена в очередь (позиция: {task_queue.qsize()})")
        
        # Ждем результат
        result_path = await result_future
        logger.info(f"Получен результат: {result_path}")
        
        if result_path and os.path.exists(result_path):
            logger.info(f"Файл существует: {result_path}")
            # Простая конвертация аудио без изменения громкости
            converted_path = await convert_audio_format(result_path)
            
            # Удаление временного файла
            background_tasks.add_task(cleanup_temp_file, result_path)
            
            # Получение длительности
            duration_ms = get_audio_duration(converted_path)
            
            # Возвращаем URL для скачивания
            audio_url = f"/audio_cache/{os.path.basename(converted_path)}"
            
            logger.info(f"TTS синтез завершен: {audio_url} (длительность: {duration_ms}ms)")
            return TTSResponse(
                success=True,
                audio_url=audio_url,
                duration_ms=duration_ms
            )
        else:
            return TTSResponse(success=False, error="Ошибка синтеза аудио")
            
    except Exception as e:
        logger.error(f"Ошибка синтеза: {e}", exc_info=True)
        return TTSResponse(success=False, error=str(e))
    finally:
        # Очищаем неактивных пользователей через 5 минут
        background_tasks.add_task(cleanup_inactive_users, user_id)

@app.post("/synthesize", response_model=TTSResponse)
async def synthesize_speech_legacy(request: TTSRequest, background_tasks: BackgroundTasks):
    """Синтез речи (legacy endpoint)"""
    return await synthesize_speech(request, background_tasks)

async def convert_audio_format(input_path: str) -> str:
    """Конвертация аудио в нужный формат"""
    try:
        from pydub import AudioSegment
        
        # Проверяем исходный файл
        if not os.path.exists(input_path):
            logger.error(f"Исходный файл не найден: {input_path}")
            return input_path
            
        input_size = os.path.getsize(input_path)
        logger.info(f"Исходный файл: {input_path}, размер: {input_size} байт")
        
        if input_size == 0:
            logger.error(f"Исходный файл пустой: {input_path}")
            return input_path
        
        # Загружаем аудио
        audio = AudioSegment.from_file(input_path)
        
        # Проверяем, что аудио загрузилось
        if len(audio) == 0:
            logger.error(f"Загруженное аудио пустое: {input_path}")
            return input_path
        
        logger.info(f"Загружено аудио: длительность {len(audio)}ms, каналы {audio.channels}, частота {audio.frame_rate}Hz")
        
        # Конвертируем в нужный формат: 24000Hz, mono, 16-bit (как у F5-TTS)
        audio = audio.set_frame_rate(24000)
        audio = audio.set_channels(1)
        audio = audio.set_sample_width(2)  # 16-bit
        
        # Сохраняем в папку audio_cache
        output_dir = base_dir / "audio_cache"
        output_dir.mkdir(exist_ok=True)
        
        output_filename = f"tts_{os.path.basename(input_path)}"
        output_path = output_dir / output_filename
        
        audio.export(str(output_path), format="wav")
        
        # Проверяем результат
        if os.path.exists(str(output_path)):
            output_size = os.path.getsize(str(output_path))
            logger.info(f"Аудио конвертировано: {input_path} -> {output_path}")
            logger.info(f"Размер после конвертации: {output_size} байт")
            
            if output_size == 0:
                logger.error(f"Конвертированный файл пустой: {output_path}")
                return input_path
        else:
            logger.error(f"Конвертированный файл не создан: {output_path}")
            return input_path
        
        return str(output_path)
        
    except Exception as e:
        logger.error(f"Ошибка конвертации аудио: {e}")
        return input_path

def get_audio_duration(audio_path: str) -> int:
    """Получение длительности аудио в миллисекундах"""
    try:
        from pydub import AudioSegment
        audio = AudioSegment.from_file(audio_path)
        return len(audio)
    except Exception as e:
        logger.error(f"Ошибка получения длительности: {e}")
        return 0

async def cleanup_temp_file(file_path: str):
    """Удаление временного файла"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.debug(f"Удален временный файл: {file_path}")
    except Exception as e:
        logger.error(f"Ошибка удаления временного файла {file_path}: {e}")

@app.get("/audio/{filename}")
async def get_audio_file(filename: str):
    """Получение аудио файла"""
    file_path = base_dir / "audio_cache" / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    from fastapi.responses import FileResponse
    return FileResponse(
        path=str(file_path),
        media_type="audio/wav",
        filename=filename
    )

@app.get("/voices")
async def list_voices():
    """Список доступных голосов"""
    voices_dir = base_dir / "voices"
    if not voices_dir.exists():
        return {"voices": []}
    
    voices = []
    for file_path in voices_dir.glob("*.wav"):
        voices.append({
            "name": file_path.stem,
            "filename": file_path.name,
            "path": str(file_path)
        })
    
    return {"voices": voices}

@app.get("/api/voices")
async def list_voices_api():
    """Список доступных голосов (API версия)"""
    return await list_voices()

@app.get("/api/tts/status")
async def get_tts_status():
    """Получение статуса TTS сервиса"""
    worker_info = {
        "active_workers": len(tts_workers),
        "queue_size": task_queue.qsize(),
        "active_users": len(active_users),
        "mode": "single_user" if len(active_users) <= 1 else "multi_user",
        "performance": {
            "total_processed": getattr(get_tts_status, '_total_processed', 0),
            "avg_processing_time": getattr(get_tts_status, '_avg_time', 0),
            "success_rate": getattr(get_tts_status, '_success_rate', 100.0)
        }
    }
    
    return {
        "enabled": True,
        "ready": tts_engine is not None and yoficator is not None,
        "loaded": tts_engine is not None,
        "engine_type": "russian_tts" if tts_engine is not None else "none",
        "status": "ready" if tts_engine is not None else "loading",
        "workers": worker_info,
        "settings": {
            "default_target_rms": 0.4,
            "default_cfg_strength": 2.0,
            "default_speed": "auto",
            "default_nfe_steps": "auto",
            "max_text_length": 500,
            "supported_languages": ["russian"]
        }
    }

@app.get("/api/tts/guest-channels")
async def get_guest_channels():
    """Получение списка разрешенных каналов для гостей"""
    # Возвращаем пустой список, так как это гостевой режим
    return {
        "twitch": [],
        "vk": []
    }

# ========================================
# АДМИН API ДЛЯ УПРАВЛЕНИЯ ГОЛОСАМИ
# ========================================

@app.get("/api/admin/voices")
async def get_all_voices():
    """Получение всех голосов (общие + пользовательские)"""
    voices_dir = base_dir / "voices"
    user_voices_dir = base_dir / "user_voices"
    
    voices = []
    
    # Общие голоса
    if voices_dir.exists():
        for file_path in voices_dir.glob("*.wav"):
            ref_text = ""
            ref_text_path = voices_dir / f"{file_path.stem}.txt"
            if ref_text_path.exists():
                try:
                    with open(ref_text_path, 'r', encoding='utf-8') as f:
                        ref_text = f.read().strip()
                except:
                    pass
            
            voices.append({
                "name": file_path.stem,
                "filename": file_path.name,
                "path": str(file_path),
                "type": "global",
                "ref_text": ref_text,
                "size": file_path.stat().st_size,
                "created": file_path.stat().st_ctime
            })
    
    # Пользовательские голоса
    if user_voices_dir.exists():
        for file_path in user_voices_dir.glob("*.wav"):
            ref_text = ""
            ref_text_path = user_voices_dir / f"{file_path.stem}.txt"
            if ref_text_path.exists():
                try:
                    with open(ref_text_path, 'r', encoding='utf-8') as f:
                        ref_text = f.read().strip()
                except:
                    pass
            
            voices.append({
                "name": file_path.stem,
                "filename": file_path.name,
                "path": str(file_path),
                "type": "user",
                "ref_text": ref_text,
                "size": file_path.stat().st_size,
                "created": file_path.stat().st_ctime
            })
    
    return {"voices": voices}

@app.post("/api/admin/voices/upload")
async def upload_voice(
    file: UploadFile = File(...),
    voice_name: str = Form(...),
    voice_type: str = Form("global"),  # "global" или "user"
    ref_text: str = Form("")
):
    """Загрузка нового голоса"""
    
    # Проверяем тип файла
    if not file.filename.lower().endswith(('.wav', '.mp3', '.m4a', '.ogg')):
        raise HTTPException(status_code=400, detail="Поддерживаются только аудио файлы (.wav, .mp3, .m4a, .ogg)")
    
    # Определяем папку назначения
    if voice_type == "global":
        target_dir = base_dir / "voices"
    else:
        target_dir = base_dir / "user_voices"
    
    target_dir.mkdir(exist_ok=True)
    
    # Генерируем уникальное имя файла
    file_extension = Path(file.filename).suffix
    safe_voice_name = "".join(c for c in voice_name if c.isalnum() or c in (' ', '-', '_')).strip()
    if not safe_voice_name:
        safe_voice_name = f"voice_{uuid.uuid4().hex[:8]}"
    
    wav_filename = f"{safe_voice_name}.wav"
    txt_filename = f"{safe_voice_name}.txt"
    
    wav_path = target_dir / wav_filename
    txt_path = target_dir / txt_filename
    
    # Проверяем что файл с таким именем не существует
    if wav_path.exists():
        raise HTTPException(status_code=400, detail=f"Голос с именем '{safe_voice_name}' уже существует")
    
    try:
        # Читаем файл
        file_content = await file.read()
        
        # Конвертируем в WAV если нужно
        if file_extension.lower() != '.wav':
            # Создаем временный файл
            temp_path = target_dir / f"temp_{uuid.uuid4().hex}.{file_extension}"
            with open(temp_path, 'wb') as f:
                f.write(file_content)
            
            # Конвертируем в WAV
            audio = AudioSegment.from_file(str(temp_path))
            audio = audio.set_frame_rate(22050).set_channels(1)  # Стандартные параметры для TTS
            audio.export(str(wav_path), format="wav")
            
            # Удаляем временный файл
            temp_path.unlink()
        else:
            # Если уже WAV, просто сохраняем
            with open(wav_path, 'wb') as f:
                f.write(file_content)
        
        # Сохраняем референсный текст
        if ref_text.strip():
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(ref_text.strip())
        
        return {
            "success": True,
            "message": f"Голос '{safe_voice_name}' успешно загружен",
            "voice": {
                "name": safe_voice_name,
                "filename": wav_filename,
                "type": voice_type,
                "ref_text": ref_text.strip()
            }
        }
        
    except Exception as e:
        # Удаляем файлы в случае ошибки
        if wav_path.exists():
            wav_path.unlink()
        if txt_path.exists():
            txt_path.unlink()
        
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки голоса: {str(e)}")

@app.put("/api/admin/voices/{voice_name}/rename")
async def rename_voice(
    voice_name: str,
    new_name: str = Form(...),
    voice_type: str = Form("global")
):
    """Переименование голоса"""
    
    # Определяем папку
    if voice_type == "global":
        source_dir = base_dir / "voices"
    else:
        source_dir = base_dir / "user_voices"
    
    old_wav_path = source_dir / f"{voice_name}.wav"
    old_txt_path = source_dir / f"{voice_name}.txt"
    
    if not old_wav_path.exists():
        raise HTTPException(status_code=404, detail="Голос не найден")
    
    # Проверяем новое имя
    safe_new_name = "".join(c for c in new_name if c.isalnum() or c in (' ', '-', '_')).strip()
    if not safe_new_name:
        raise HTTPException(status_code=400, detail="Недопустимое имя голоса")
    
    new_wav_path = source_dir / f"{safe_new_name}.wav"
    new_txt_path = source_dir / f"{safe_new_name}.txt"
    
    if new_wav_path.exists():
        raise HTTPException(status_code=400, detail=f"Голос с именем '{safe_new_name}' уже существует")
    
    try:
        # Переименовываем WAV файл
        old_wav_path.rename(new_wav_path)
        
        # Переименовываем TXT файл если существует
        if old_txt_path.exists():
            old_txt_path.rename(new_txt_path)
        
        return {
            "success": True,
            "message": f"Голос переименован с '{voice_name}' на '{safe_new_name}'",
            "old_name": voice_name,
            "new_name": safe_new_name
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка переименования: {str(e)}")

@app.put("/api/admin/voices/{voice_name}/ref-text")
async def update_ref_text(
    voice_name: str,
    ref_text: str = Form(...),
    voice_type: str = Form("global")
):
    """Обновление референсного текста голоса"""
    
    # Определяем папку
    if voice_type == "global":
        target_dir = base_dir / "voices"
    else:
        target_dir = base_dir / "user_voices"
    
    wav_path = target_dir / f"{voice_name}.wav"
    txt_path = target_dir / f"{voice_name}.txt"
    
    if not wav_path.exists():
        raise HTTPException(status_code=404, detail="Голос не найден")
    
    try:
        # Сохраняем референсный текст
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(ref_text.strip())
        
        return {
            "success": True,
            "message": f"Референсный текст для голоса '{voice_name}' обновлен",
            "ref_text": ref_text.strip()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка обновления текста: {str(e)}")

@app.delete("/api/admin/voices/{voice_name}")
async def delete_voice(
    voice_name: str,
    voice_type: str = "global"
):
    """Удаление голоса"""
    
    # Определяем папку
    if voice_type == "global":
        target_dir = base_dir / "voices"
    else:
        target_dir = base_dir / "user_voices"
    
    wav_path = target_dir / f"{voice_name}.wav"
    txt_path = target_dir / f"{voice_name}.txt"
    
    if not wav_path.exists():
        raise HTTPException(status_code=404, detail="Голос не найден")
    
    try:
        # Удаляем WAV файл
        wav_path.unlink()
        
        # Удаляем TXT файл если существует
        if txt_path.exists():
            txt_path.unlink()
        
        return {
            "success": True,
            "message": f"Голос '{voice_name}' удален"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка удаления: {str(e)}")

@app.post("/api/admin/voices/{voice_name}/extract-text")
async def extract_ref_text(voice_name: str, voice_type: str = "global"):
    """Извлечение референсного текста из аудио (заглушка)"""
    # В реальной реализации здесь был бы Whisper или другой ASR
    return {
        "success": True,
        "message": "Извлечение текста не реализовано",
        "ref_text": ""
    }

# ========================================
# ПОЛЬЗОВАТЕЛЬСКИЕ API ДЛЯ УПРАВЛЕНИЯ ГОЛОСАМИ
# ========================================

@app.get("/api/user/voices")
async def get_user_voices(request: Request, user_id: str = None):
    """Получение голосов для пользователя (стандартные + личные)"""
    # Проверяем авторизацию
    auth_user_id = verify_guest_or_auth(request)
    
    # Если передан user_id, проверяем что он совпадает с авторизованным пользователем
    if user_id and auth_user_id != "guest" and auth_user_id != user_id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    # Используем user_id из авторизации если не передан
    if not user_id and auth_user_id != "guest":
        user_id = auth_user_id
    
    voices_dir = base_dir / "voices"
    user_voices_dir = base_dir / "user_voices"
    
    voices = {
        "standard": [],
        "vip": []
    }
    
    # Стандартные голоса (доступны всем)
    if voices_dir.exists():
        for file_path in voices_dir.glob("*.wav"):
            ref_text = ""
            ref_text_path = voices_dir / f"{file_path.stem}.txt"
            if ref_text_path.exists():
                try:
                    with open(ref_text_path, 'r', encoding='utf-8') as f:
                        ref_text = f.read().strip()
                except:
                    pass
            
            voices["standard"].append({
                "name": file_path.stem,
                "filename": file_path.name,
                "path": str(file_path),
                "ref_text": ref_text,
                "size": file_path.stat().st_size,
                "created": file_path.stat().st_ctime
            })
    
    # VIP голоса (только для авторизованных пользователей)
    if user_id and auth_user_id != "guest" and user_voices_dir.exists():
        for file_path in user_voices_dir.glob("*.wav"):
            ref_text = ""
            ref_text_path = user_voices_dir / f"{file_path.stem}.txt"
            if ref_text_path.exists():
                try:
                    with open(ref_text_path, 'r', encoding='utf-8') as f:
                        ref_text = f.read().strip()
                except:
                    pass
            
            voices["vip"].append({
                "name": file_path.stem,
                "filename": file_path.name,
                "path": str(file_path),
                "ref_text": ref_text,
                "size": file_path.stat().st_size,
                "created": file_path.stat().st_ctime
            })
    
    return voices

@app.get("/api/user/voices/selected")
async def get_selected_voices(request: Request, user_id: str):
    """Получение выбранных голосов для пользователя"""
    # Проверяем авторизацию
    auth_user_id = verify_guest_or_auth(request)
    
    # Проверяем что user_id совпадает с авторизованным пользователем
    if auth_user_id != "guest" and auth_user_id != user_id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    user_config_dir = base_dir / "user_configs"
    user_config_dir.mkdir(exist_ok=True)
    
    config_file = user_config_dir / f"{user_id}_voices.json"
    
    if config_file.exists():
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    
    return {"selected_voices": [], "voice_settings": {}}

@app.post("/api/user/voices/selected")
async def save_selected_voices(request: Request, user_id: str, data: dict):
    """Сохранение выбранных голосов для пользователя"""
    # Проверяем авторизацию
    auth_user_id = verify_guest_or_auth(request)
    
    # Проверяем что user_id совпадает с авторизованным пользователем
    if auth_user_id != "guest" and auth_user_id != user_id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    user_config_dir = base_dir / "user_configs"
    user_config_dir.mkdir(exist_ok=True)
    
    config_file = user_config_dir / f"{user_id}_voices.json"
    
    try:
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return {"success": True, "message": "Настройки голосов сохранены"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения: {str(e)}")

@app.post("/api/user/voices/upload")
async def upload_user_voice(
    request: Request,
    user_id: str,
    file: UploadFile = File(...),
    voice_name: str = Form(...),
    ref_text: str = Form(""),
    sway_sampling_coef: float = Form(1.0),
    cfg_strength: float = Form(1.0),
    volume: float = Form(1.0)
):
    """Загрузка личного голоса пользователя"""
    
    # Проверяем авторизацию
    auth_user_id = verify_guest_or_auth(request)
    
    # Проверяем что user_id совпадает с авторизованным пользователем
    if auth_user_id != "guest" and auth_user_id != user_id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    # Гости не могут загружать голоса
    if auth_user_id == "guest":
        raise HTTPException(status_code=403, detail="Для загрузки голосов необходимо авторизоваться")
    
    # Проверяем тип файла
    if not file.filename.lower().endswith(('.wav', '.mp3', '.m4a', '.ogg')):
        raise HTTPException(status_code=400, detail="Поддерживаются только аудио файлы (.wav, .mp3, .m4a, .ogg)")
    
    # Создаем папку для пользователя
    user_voices_dir = base_dir / "user_voices" / user_id
    user_voices_dir.mkdir(parents=True, exist_ok=True)
    
    # Генерируем уникальное имя файла
    file_extension = Path(file.filename).suffix
    safe_voice_name = "".join(c for c in voice_name if c.isalnum() or c in (' ', '-', '_')).strip()
    if not safe_voice_name:
        safe_voice_name = f"voice_{uuid.uuid4().hex[:8]}"
    
    wav_filename = f"{safe_voice_name}.wav"
    txt_filename = f"{safe_voice_name}.txt"
    settings_filename = f"{safe_voice_name}.json"
    
    wav_path = user_voices_dir / wav_filename
    txt_path = user_voices_dir / txt_filename
    settings_path = user_voices_dir / settings_filename
    
    # Проверяем что файл с таким именем не существует
    if wav_path.exists():
        raise HTTPException(status_code=400, detail=f"Голос с именем '{safe_voice_name}' уже существует")
    
    try:
        # Читаем файл
        file_content = await file.read()
        
        # Конвертируем в WAV если нужно
        if file_extension.lower() != '.wav':
            # Создаем временный файл
            temp_path = user_voices_dir / f"temp_{uuid.uuid4().hex}.{file_extension}"
            with open(temp_path, 'wb') as f:
                f.write(file_content)
            
            # Конвертируем в WAV
            audio = AudioSegment.from_file(str(temp_path))
            audio = audio.set_frame_rate(22050).set_channels(1)  # Стандартные параметры для TTS
            audio.export(str(wav_path), format="wav")
            
            # Удаляем временный файл
            temp_path.unlink()
        else:
            # Если уже WAV, просто сохраняем
            with open(wav_path, 'wb') as f:
                f.write(file_content)
        
        # Сохраняем референсный текст
        if ref_text.strip():
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(ref_text.strip())
        
        # Сохраняем настройки голоса
        voice_settings = {
            "sway_sampling_coef": sway_sampling_coef,
            "cfg_strength": cfg_strength,
            "volume": volume,
            "created": datetime.datetime.now().isoformat()
        }
        
        with open(settings_path, 'w', encoding='utf-8') as f:
            json.dump(voice_settings, f, ensure_ascii=False, indent=2)
        
        return {
            "success": True,
            "message": f"Голос '{safe_voice_name}' успешно загружен",
            "voice": {
                "name": safe_voice_name,
                "filename": wav_filename,
                "ref_text": ref_text.strip(),
                "settings": voice_settings
            }
        }
        
    except Exception as e:
        # Удаляем файлы в случае ошибки
        if wav_path.exists():
            wav_path.unlink()
        if txt_path.exists():
            txt_path.unlink()
        if settings_path.exists():
            settings_path.unlink()
        
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки голоса: {str(e)}")

@app.post("/api/user/voices/{voice_name}/test")
async def test_user_voice(
    request: Request,
    user_id: str,
    voice_name: str,
    test_text: str = Form("Привет, это тестовое воспроизведение голоса"),
    sway_sampling_coef: float = Form(1.0),
    cfg_strength: float = Form(1.0),
    volume: float = Form(1.0)
):
    """Тестовое воспроизведение голоса пользователя"""
    
    # Проверяем авторизацию
    auth_user_id = verify_guest_or_auth(request)
    
    # Проверяем что user_id совпадает с авторизованным пользователем
    if auth_user_id != "guest" and auth_user_id != user_id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    # Ищем голос в стандартных или пользовательских
    voice_path = None
    ref_text = ""
    
    # Сначала ищем в стандартных
    standard_voice_path = base_dir / "voices" / f"{voice_name}.wav"
    if standard_voice_path.exists():
        voice_path = standard_voice_path
        ref_text_path = base_dir / "voices" / f"{voice_name}.txt"
        if ref_text_path.exists():
            try:
                with open(ref_text_path, 'r', encoding='utf-8') as f:
                    ref_text = f.read().strip()
            except:
                pass
    else:
        # Ищем в пользовательских
        user_voice_path = base_dir / "user_voices" / user_id / f"{voice_name}.wav"
        if user_voice_path.exists():
            voice_path = user_voice_path
            ref_text_path = base_dir / "user_voices" / user_id / f"{voice_name}.txt"
            if ref_text_path.exists():
                try:
                    with open(ref_text_path, 'r', encoding='utf-8') as f:
                        ref_text = f.read().strip()
                except:
                    pass
    
    if not voice_path:
        raise HTTPException(status_code=404, detail="Голос не найден")
    
    try:
        # Создаем временный файл для теста
        temp_dir = str(base_dir / "temp_audio")
        os.makedirs(temp_dir, exist_ok=True)
        temp_filename = f"test_{uuid.uuid4().hex}.wav"
        temp_path = os.path.join(temp_dir, temp_filename)
        
        # Синтезируем тестовый голос
        if tts_engine and yoficator:
            # Используем параметры пользователя
            processed_text = yoficator.yoficate_text(test_text)
            
            # Синтез с пользовательскими параметрами
            audio_data = tts_engine.synthesize_speech(
                text=processed_text,
                ref_audio_path=str(voice_path),
                ref_text=ref_text,
                speed=0.8,  # Фиксированная скорость для теста
                sway_sampling_coef=sway_sampling_coef,
                cfg_strength=cfg_strength
            )
            
            # Применяем громкость
            if volume != 1.0:
                audio_segment = AudioSegment.from_wav(io.BytesIO(audio_data))
                audio_segment = audio_segment + (20 * math.log10(volume))  # Конвертируем в дБ
                audio_data = audio_segment.export(format="wav").read()
            
            # Сохраняем временный файл
            with open(temp_path, 'wb') as f:
                f.write(audio_data)
            
            return {
                "success": True,
                "message": "Тестовый голос создан",
                "audio_url": f"/audio/{temp_filename}"
            }
        else:
            raise HTTPException(status_code=503, detail="TTS сервис не готов")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка создания тестового голоса: {str(e)}")

@app.delete("/api/user/voices/{voice_name}")
async def delete_user_voice(request: Request, user_id: str, voice_name: str):
    """Удаление личного голоса пользователя"""
    
    # Проверяем авторизацию
    auth_user_id = verify_guest_or_auth(request)
    
    # Проверяем что user_id совпадает с авторизованным пользователем
    if auth_user_id != "guest" and auth_user_id != user_id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    # Гости не могут удалять голоса
    if auth_user_id == "guest":
        raise HTTPException(status_code=403, detail="Для удаления голосов необходимо авторизоваться")
    
    user_voices_dir = base_dir / "user_voices" / user_id
    wav_path = user_voices_dir / f"{voice_name}.wav"
    txt_path = user_voices_dir / f"{voice_name}.txt"
    settings_path = user_voices_dir / f"{voice_name}.json"
    
    if not wav_path.exists():
        raise HTTPException(status_code=404, detail="Голос не найден")
    
    try:
        # Удаляем все файлы голоса
        if wav_path.exists():
            wav_path.unlink()
        if txt_path.exists():
            txt_path.unlink()
        if settings_path.exists():
            settings_path.unlink()
        
        return {
            "success": True,
            "message": f"Голос '{voice_name}' удален"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка удаления: {str(e)}")

@app.post("/api/tts/connect-guest")
async def connect_guest_channel(request: dict):
    """Подключение гостевого канала (заглушка)"""
    return {
        "success": True,
        "message": f"Подключен к каналу {request.get('channel')} на {request.get('platform')}"
    }

@app.post("/api/tts/enable")
async def enable_tts():
    """Включение TTS"""
    return {"success": True, "message": "TTS включен"}

@app.post("/api/tts/disable") 
async def disable_tts():
    """Отключение TTS"""
    return {"success": True, "message": "TTS отключен"}

@app.post("/api/auth/logout")
async def logout():
    """Выход из системы"""
    return {"success": True, "message": "Вы успешно вышли из системы"}

if __name__ == "__main__":
    # Создаем необходимые папки
    os.makedirs(base_dir / "audio_cache", exist_ok=True)
    os.makedirs(base_dir / "voices", exist_ok=True)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=False,
        log_level="info"
    )
