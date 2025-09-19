# TTS Microservice

Отдельный микросервис для генерации речи.

## 🚀 Запуск

```bash
# Установка зависимостей
pip install -r requirements.txt

# Копирование TTS движка
cp -r ../backend/TTS_rus_engine ./

# Копирование голосов
cp -r ../backend/voices ./

# Запуск сервиса
python main.py
```

## 📡 API Endpoints

- `GET /health` - Проверка состояния
- `POST /synthesize` - Синтез речи
- `GET /audio/{filename}` - Получение аудио файла
- `GET /voices` - Список голосов

## 🔧 Настройка

Сервис работает на порту 8001 и ожидает:
- Папку `TTS_rus_engine/` с движком
- Папку `voices/` с голосовыми файлами
- Папку `audio_cache/` для временных файлов
