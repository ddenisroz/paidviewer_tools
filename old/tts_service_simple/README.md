# 🎙️ TTS F5 Simple - Локальный TTS микросервис

**Упрощенный локальный TTS сервис для бота** с автоматической настройкой и оптимизацией под вашу GPU.

---

## 📋 Что это?

Это **автономный микросервис** для генерации голосовых озвучек с использованием F5-TTS. Он запускается на вашем компьютере и предоставляет API для бота.

### ✅ Преимущества:
- 🚀 **Автоматическая настройка** - определяет GPU и оптимизирует параметры
- 🔒 **Приватность** - работает локально, данные не уходят в облако
- ⚡ **Быстрая генерация** - использует GPU для ускорения
- 🎤 **Автоконвертация** - любой формат → WAV 48kHz Mono 16-bit
- 🎙️ **Автотранскрибация** - Whisper извлекает текст из аудио
- 🎯 **Простая установка** - 3 команды и готово!

---

## 💻 Системные требования

### Минимальные требования:
- **OS**: Windows 10/11, Linux (Ubuntu 20.04+)
- **Python**: 3.8 или выше
- **RAM**: 8 GB
- **Disk**: 5 GB свободного места

### Рекомендуемые требования:
- **GPU**: NVIDIA с VRAM ≥ 6 GB (RTX 2060/3060 или выше)
- **CUDA**: 11.8 или 12.x
- **RAM**: 16 GB

---

## 🚀 Быстрая установка

### Шаг 1: Клонируйте репозиторий (если ещё не сделали)
```bash
# Если у вас уже есть проект, перейдите в папку tts_service_simple
cd tts_service_simple
```

### Шаг 2: Установите зависимости
```bash
# Windows
python install.py

# Linux/Mac
python3 install.py
```

**💡 Скрипт install.py автоматически:**
- Установит PyTorch 2.4.0 с CUDA 12.4 (если доступна GPU)
- Установит F5-TTS и все необходимые библиотеки
- Создаст необходимые директории
- Сгенерирует конфигурацию

**⚠️ CUDA 12.4 требуется!** Если у вас другая версия CUDA:
```bash
# Для CUDA 11.8:
pip install torch==2.4.0+cu118 torchaudio==2.4.0+cu118 torchvision==0.19.0+cu118 --extra-index-url https://download.pytorch.org/whl/cu118

# Для CPU (без GPU):
pip install torch==2.4.0 torchaudio==2.4.0 torchvision==0.19.0
```

### Шаг 3: Запустите сервис
```bash
# Windows
start.bat

# Linux/Mac
./start.sh

# Или напрямую
python main.py
```

---

## ⚙️ Конфигурация

Сервис **автоматически создаёт конфигурацию** при первом запуске:
- Определяет вашу GPU
- Выбирает оптимальные параметры
- Находит свободный порт
- Генерирует API ключ

### Ручная настройка (опционально)

Создайте файл `.env` для кастомизации:

```env
# Ограничить использование VRAM (в ГБ, 0 = использовать всю)
GPU_MAX_VRAM_GB=8

# Режим работы
# performance - быстрее, больше нагрузка на GPU
# quality - медленнее, меньше нагрузка, лучше качество
GPU_PRIORITY=performance
```

### Автоматическая оптимизация:

| VRAM GPU | Режим Performance | Режим Quality |
|----------|-------------------|---------------|
| ≥ 12 GB  | 4 workers, batch 4 | 2 workers, batch 2 |
| 8-12 GB  | 3 workers, batch 3 | 1 worker, batch 1 |
| 6-8 GB   | 2 workers, batch 2 | 1 worker, batch 1 |
| < 6 GB   | 1 worker, batch 1 | 1 worker, batch 1 |

---

## 🔗 Подключение к боту

После запуска сервис доступен по адресу:
```
http://localhost:8001
```

### Получение настроек:

1. **Откройте файл `config.json`** в папке `tts_service_simple`
2. Найдите значения:
   - `port` - порт сервиса (обычно 8001)
   - `api_key` - ваш API ключ

### Подключение через UI бота:

1. Перейдите в бот: **Dashboard → TTS → Локальный TTS**
2. Введите URL: `http://localhost:8001`
3. Введите API Key из `config.json`
4. Нажмите **"Тест соединения"**
5. Нажмите **"Сохранить"**

---

## 📊 Мониторинг

### Веб-интерфейс:
- **Главная**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs
- **Health Check**: http://localhost:8001/health
- **Статус**: http://localhost:8001/api/status

### Проверка здоровья:
```bash
curl http://localhost:8001/health
```

Ответ:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "gpu_info": {
    "name": "NVIDIA GeForce RTX 3060",
    "memory_total": 12288,
    "memory_free": 10240
  },
  "uptime": 3600.5
}
```

---

## 🛠️ API Endpoints

### POST `/api/tts/synthesize`
Синтез речи

**Request:**
```json
{
  "text": "Привет, мир!",
  "voice": "female_1",
  "user_id": 123
}
```

**Response:**
```json
{
  "success": true,
  "audio_url": "/api/audio/generated_1234567890.wav",
  "processing_time": 1.5
}
```

### GET `/api/voices`
Получить список доступных голосов

**Response:**
```json
{
  "voices": ["female_1", "male_1", "female_2", "male_2"]
}
```

### GET `/api/status`
Получить статус системы

**Response:**
```json
{
  "tts_engine": {
    "status": "ready",
    "model_loaded": true
  },
  "config": {
    "version": "1.0.0",
    "port": 8001,
    "max_workers": 3,
    "priority": "performance"
  },
  "stats": {
    "total_requests": 150,
    "successful_requests": 148,
    "failed_requests": 2,
    "average_processing_time": 1.8
  },
  "queue_size": 0
}
```

---

## 🔧 Управление сервисом

### Windows:

**Запуск:**
```batch
start.bat
```

**Остановка:**
```batch
Ctrl+C в окне терминала
```

**Перезапуск:**
```batch
stop.bat
start.bat
```

### Linux/Mac:

**Запуск:**
```bash
./start.sh
```

**Остановка:**
```bash
Ctrl+C в терминале
```

**Запуск в фоне:**
```bash
nohup python3 main.py > tts_service.log 2>&1 &
```

---

## 📝 Логи

Логи сохраняются в `logs/tts_simple.log`:

```bash
# Просмотр последних логов
tail -f logs/tts_simple.log  # Linux/Mac
type logs\tts_simple.log     # Windows
```

---

## ❓ FAQ

### 1. Сервис не запускается
- Проверьте, что порт 8001 свободен
- Проверьте логи в `logs/tts_simple.log`
- Убедитесь что установлены все зависимости

### 2. GPU не определяется
- Установите драйверы NVIDIA
- Проверьте CUDA: `nvidia-smi`
- Сервис работает и без GPU (медленнее)

### 3. Ошибка подключения из бота
- Убедитесь что сервис запущен: `http://localhost:8001/health`
- Проверьте API ключ в `config.json`
- Проверьте firewall (должен разрешать localhost)

### 4. Высокое использование VRAM
- Установите `GPU_MAX_VRAM_GB` в `.env`
- Переключитесь на режим `quality`: `GPU_PRIORITY=quality`

---

## 📞 Поддержка

- **GitHub Issues**: [Создать issue](https://github.com/your-repo/issues)
- **Документация**: http://localhost:8001/docs
- **Логи**: `logs/tts_simple.log`

---

## 📄 Лицензия

MIT License - см. файл LICENSE

---

## 🚀 Что дальше?

После успешного запуска:
1. ✅ Откройте http://localhost:8001/docs
2. ✅ Подключите в боте: **Dashboard → TTS → Локальный TTS**
3. ✅ Протестируйте генерацию голоса
4. ✅ Настройте под свои нужды

**Готово! Теперь бот использует ваш локальный TTS! 🎉**

