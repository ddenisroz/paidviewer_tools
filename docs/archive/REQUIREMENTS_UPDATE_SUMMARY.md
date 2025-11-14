# Сводка обновления requirements.txt

**Дата:** 15 ноября 2025  
**Статус:** ✅ Завершено

---

## Что изменилось

### ✅ Обновлён `bot_service/requirements.txt`

**Было:** Версии не указаны (плохо для production)
```python
fastapi
uvicorn
sqlalchemy
...
```

**Стало:** Точные версии всех пакетов (version pinning)
```python
fastapi==0.121.2
uvicorn==0.38.0
sqlalchemy==2.0.44
...
```

---

## Структура нового requirements.txt

Файл теперь организован по категориям с указанием дат обновления:

1. **CORE FRAMEWORK** - FastAPI, Pydantic, Starlette
2. **DATABASE** - SQLAlchemy, Alembic, PostgreSQL driver
3. **SECURITY & AUTH** - Cryptography, JWT, OAuth
4. **ASYNC & NETWORKING** - aiohttp, httpx
5. **CONFIGURATION** - python-dotenv
6. **LOGGING & MONITORING** - structlog, sentry-sdk
7. **RATE LIMITING** - slowapi, limits
8. **CHAT BOTS** - TwitchIO
9. **TTS & AUDIO** - gtts, pydub
10. **AI/ML** - PyTorch, Transformers, Whisper
11. **F5-TTS DEPENDENCIES** - f5-tts, gradio, vocos
12. **GOOGLE CLOUD** - Google Cloud APIs
13. **UTILITIES** - requests, click, typer
14. **TESTING** - pytest, coverage
15. **DEVELOPMENT** - ruff

---

## Ключевые обновлённые версии

| Пакет | Старая | Новая | Категория |
|-------|--------|-------|-----------|
| fastapi | не указана | 0.121.2 | Framework |
| uvicorn | не указана | 0.38.0 | Framework |
| sqlalchemy | не указана | 2.0.44 | Database |
| alembic | не указана | 1.17.1 | Database |
| cryptography | >=43.0.1 | 46.0.3 | Security |
| aiohttp | не указана | 3.13.2 | Async |
| structlog | не указана | 25.5.0 | Logging |
| sentry-sdk | не указана | 2.44.0 | Monitoring |
| transformers | не указана | 4.57.1 | AI/ML |
| accelerate | не указана | 1.11.0 | AI/ML |
| faster-whisper | не указана | 1.2.1 | AI/ML |
| pytest-asyncio | не указана | 1.3.0 | Testing |
| coverage | не указана | 7.11.3 | Testing |
| ruff | не указана | 0.14.5 | Development |

---

## Зафиксированные версии (не обновлялись)

Эти пакеты остались на текущих версиях из-за конфликтов зависимостей:

| Пакет | Версия | Причина |
|-------|--------|---------|
| pydantic | 2.10.6 | F5-TTS требует <= 2.10.6 |
| aiofiles | 24.1.0 | Gradio требует < 25.0 |
| click | 8.1.8 | gtts требует < 8.2 |
| gradio | 5.49.0 | Зависимость F5-TTS |
| f5-tts | 1.1.9 | Текущая стабильная версия |

---

## Проверка целостности

```bash
pip check
```

**Результат:** ✅ No broken requirements found.

---

## Как использовать

### Установка зависимостей с нуля:

```bash
cd bot_service
pip install -r requirements.txt
```

### Проверка установленных версий:

```bash
pip list | findstr "fastapi uvicorn sqlalchemy"
```

### Обновление конкретного пакета:

```bash
pip install --upgrade package_name==version
```

---

## Преимущества нового requirements.txt

1. ✅ **Воспроизводимость** - точные версии гарантируют одинаковое окружение
2. ✅ **Безопасность** - легко отследить устаревшие пакеты
3. ✅ **Документация** - понятно, какие версии используются
4. ✅ **Организация** - пакеты сгруппированы по назначению
5. ✅ **Отслеживание** - даты обновления для каждой категории

---

## Следующие шаги

1. ✅ requirements.txt обновлён с точными версиями
2. ⏳ Протестировать установку в чистом окружении
3. ⏳ Обновить документацию по развёртыванию
4. ⏳ Создать CI/CD проверку версий

---

## Примечания

- **PyTorch:** Используется версия с CUDA 12.4 (`+cu124`)
- **F5-TTS:** Блокирует обновление pydantic до 2.12+
- **Gradio:** Блокирует обновление aiofiles до 25.0+
- **gtts:** Блокирует обновление click до 8.2+

Эти ограничения будут сняты при обновлении соответствующих библиотек.
