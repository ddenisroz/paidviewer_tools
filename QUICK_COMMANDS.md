# Быстрые команды - Шпаргалка

**Используй это как справочник во время реализации**

---

## 📦 ДЕНЬ 1: Type Safety & Validation

### Установка зависимостей

```bash
cd frontend
npm install
cd ..
```

### Применение миграции

```bash
cd bot_service
alembic current                    # Проверить текущую версию
alembic upgrade head               # Применить миграцию
alembic current                    # Проверить что применилось
cd ..
```

### Запуск backend

```bash
cd bot_service
python main.py
# Или
uvicorn main:app --reload
```

### Генерация TypeScript типов

```bash
cd frontend
npm run generate-api-types
```

### Проверка TypeScript

```bash
cd frontend
npm run type-check                 # Обычная проверка
npm run type-check:strict          # Строгая проверка
npm run type-check:watch           # С автообновлением
```

### Проверка OpenAPI

```bash
# В браузере
http://localhost:8000/docs         # Swagger UI
http://localhost:8000/openapi.json # JSON схема

# Или через curl
curl http://localhost:8000/openapi.json
curl http://localhost:8000/health
```

### Проверка БД

```bash
cd bot_service
sqlite3 data/bot_service.db

# В sqlite3:
.schema user_tokens                # Посмотреть схему
.indexes user_tokens               # Посмотреть индексы
SELECT * FROM user_tokens LIMIT 5; # Посмотреть данные
.quit                              # Выйти
```

### Тестирование

```bash
cd bot_service
pytest tests/test_constraints.py -v
pytest tests/test_performance.py -v
```

---

## 📦 ДЕНЬ 2: Database Health

### Connection Pooling

```bash
# Проверить статус пула
curl http://localhost:8000/api/admin/db/pool-status
```

### Поиск N+1 queries

```bash
cd bot_service

# Включить SQL логирование
export SQLALCHEMY_ECHO=1
python main.py

# Или в коде:
# logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
```

### Тестирование миграций

```bash
cd bot_service
pytest tests/test_migrations.py -v
```

---

## 📦 ДЕНЬ 3: Error Tracking

### Установка Sentry

```bash
# Backend
cd bot_service
pip install sentry-sdk[fastapi]

# Frontend
cd frontend
npm install @sentry/react @sentry/vite-plugin
```

### Проверка Sentry

```bash
# Вызвать тестовую ошибку
curl http://localhost:8000/api/test-error

# Проверить в Sentry dashboard
# https://sentry.io/organizations/your-org/issues/
```

---

## 📦 ДЕНЬ 4-5: Testing

### Установка тестовых библиотек

```bash
# Backend (уже установлено)
cd bot_service
pip install pytest pytest-asyncio pytest-cov

# Frontend
cd frontend
npm install -D vitest @testing-library/react @testing-library/user-event jsdom

# E2E
npm install -D @playwright/test
npx playwright install
```

### Запуск тестов

```bash
# Backend
cd bot_service
pytest                             # Все тесты
pytest tests/integration/ -v       # Integration тесты
pytest --cov                       # С coverage
pytest -k "test_auth" -v           # Конкретный тест

# Frontend
cd frontend
npm run test                       # Все тесты
npm run test:watch                 # С автообновлением
npm run test:coverage              # С coverage

# E2E
npx playwright test                # Все E2E тесты
npx playwright test --ui           # С UI
npx playwright test --debug        # С отладкой
```

---

## 📦 ДЕНЬ 6: Database Optimization

### Анализ запросов

```bash
cd bot_service

# Включить SQL логирование
export SQLALCHEMY_ECHO=1
python main.py

# Или использовать EXPLAIN
sqlite3 data/bot_service.db
EXPLAIN QUERY PLAN SELECT * FROM chat_messages WHERE user_id = 1;
```

### Проверка производительности

```bash
cd bot_service
pytest tests/test_performance.py -v --benchmark
```

---

## 📦 ДЕНЬ 7: API Stability

### Тестирование rate limiting

```bash
# Отправить много запросов
for i in {1..100}; do
  curl http://localhost:8000/api/tts/speak -X POST \
    -H "Content-Type: application/json" \
    -d '{"text":"test","voice_id":1}'
done
```

### Тестирование idempotency

```bash
# Отправить один запрос дважды
curl http://localhost:8000/api/youtube/add -X POST \
  -H "Content-Type: application/json" \
  -d '{"video_id":"test123"}'

curl http://localhost:8000/api/youtube/add -X POST \
  -H "Content-Type: application/json" \
  -d '{"video_id":"test123"}'

# Должен быть добавлен только один раз
```

---

## 🔧 ПОЛЕЗНЫЕ КОМАНДЫ

### Git

```bash
git status                         # Статус
git add .                          # Добавить все
git commit -m "Day 1: Type Safety" # Коммит
git push                           # Отправить
```

### Docker (если используешь)

```bash
docker-compose up -d               # Запустить
docker-compose logs -f bot_service # Логи
docker-compose down                # Остановить
docker-compose restart             # Перезапустить
```

### Логи

```bash
# Backend логи
tail -f bot_service/logs/bot_service.log

# Frontend dev server логи
# Смотри в терминале где запущен npm run dev
```

### Очистка

```bash
# Очистить кэш Python
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -type f -name "*.pyc" -delete

# Очистить node_modules
cd frontend
rm -rf node_modules
npm install

# Очистить БД (ОСТОРОЖНО!)
cd bot_service
rm data/bot_service.db
alembic upgrade head
```

---

## 🆘 TROUBLESHOOTING

### Миграция не применяется

```bash
cd bot_service
alembic stamp head                 # Пометить как текущую
alembic upgrade head               # Применить
```

### Backend не запускается

```bash
cd bot_service
python -c "from core.config import settings; print(settings.DATABASE_URL)"
python -c "import sys; print(sys.path)"
```

### TypeScript типы не генерируются

```bash
# Проверить что backend запущен
curl http://localhost:8000/health

# Попробовать с полным URL
cd frontend
npx openapi-typescript http://localhost:8000/openapi.json --output src/types/api-schema.ts
```

### Тесты не проходят

```bash
cd bot_service
pytest -v --tb=short               # Короткий traceback
pytest -v --tb=long                # Полный traceback
pytest -v -s                       # С print выводом
```

---

## 📊 ПРОВЕРКА ПРОГРЕССА

### День 1

```bash
# Проверить что всё работает
curl http://localhost:8000/openapi.json
ls -la frontend/src/types/api-schema.ts
cd bot_service && sqlite3 data/bot_service.db ".indexes user_tokens"
cd ../frontend && npm run type-check:strict
```

### День 2

```bash
curl http://localhost:8000/api/admin/db/pool-status
cd bot_service && pytest tests/test_migrations.py -v
```

### День 3

```bash
curl http://localhost:8000/api/test-error
# Проверить в Sentry dashboard
```

### День 4-5

```bash
cd bot_service && pytest --cov
cd ../frontend && npm run test:coverage
npx playwright test
```

### День 6

```bash
cd bot_service && pytest tests/test_performance.py -v
```

### День 7

```bash
# Проверить rate limiting
for i in {1..100}; do curl http://localhost:8000/api/tts/speak -X POST; done
```

---

**Сохрани этот файл - он пригодится! 📌**
