# Paidviewer Tools: Текущий План И Инструкции По Запуску

Дата актуализации: 2026-03-22

## Зачем этот документ

Этот документ больше не описывает чужую целевую идею.
Теперь он фиксирует наш текущий согласованный план, фактическое состояние реализации и практические инструкции по запуску всех частей проекта.

## Наш текущий план

### Главная архитектурная идея

- `frontend` остается тонким UI и общается только с `bot_service`.
- `bot_service` является центральным control plane.
- `f5-tts-service`, `nano-qwen3tts-vllm`, `tts-gateway` остаются отдельными runtime-сервисами и отдельными репозиториями.
- `tts_worker_agent` становится общим способом подключения worker-ов и для managed path, и для self-hosted path.
- F5 и Qwen должны быть равноправны на уровне backend, worker contract, queue и routing.
- UI/UX фронтенда заморожен до отдельного согласования:
  - не менять layout
  - не добавлять новые кнопки
  - не удалять старые элементы
  - не перестраивать экраны

### Что считаем целевой backend-моделью

- jobs и worker state живут в PostgreSQL
- queue claim делается через `SELECT ... FOR UPDATE SKIP LOCKED`
- Redis остается вспомогательным слоем для rate limit, cache и short-lived infrastructure
- legacy endpoint-based self-host path пока сохраняется как совместимый fallback
- `tts-gateway` пока остается transitional compat-слоем, а не основой целевой архитектуры

### Текущие фазы

1. Backend-first control plane
2. Живая проверка runtime path
3. Документация и операционный запуск
4. Только после согласования отдельная UI/UX-фаза

## Что уже сделано

### Backend и control plane

- Добавлены PostgreSQL-сущности:
  - `workers`
  - `worker_pairing_tokens`
  - `tts_jobs`
  - `tts_job_attempts`
- Добавлена миграция `20260322_worker_control`.
- Реализован backend worker contract:
  - activate
  - poll
  - complete
  - fail
- Добавлены user/admin API для pairing, списка worker-ов, manual jobs, disable/delete worker.
- Добавлен service layer для queue ownership, lease, retry, requeue и worker lifecycle.
- Добавлен reconciler для stale workers и expired leases.

### Интеграция в runtime

- Новый worker path встроен в `bot_service` runtime, а не существует только как отдельный API.
- Managed path и self-host path теперь могут идти через worker control plane.
- Если новый worker path временно недоступен, runtime откатывается на legacy/fallback path, а не ломает synthesis целиком.
- `/api/tts/status` и `/api/tts/health` теперь знают про worker-backed availability.

### Worker agent

- Добавлен `tts_worker_agent` как отдельный Python-агент.
- В агенте есть два adapter-а:
  - `F5Adapter`
  - `QwenAdapter`
- Есть manual/backend-only документация по pairing и запуску.
- Есть dev smoke-скрипт `scripts/dev/worker_control_smoke.py`, который поднимает stub runtimes и проверяет worker path end-to-end для F5 и Qwen.

### Проверки, которые уже пройдены

- Миграция применена на dev PostgreSQL.
- Таблицы `workers`, `worker_pairing_tokens`, `tts_jobs`, `tts_job_attempts` реально созданы.
- Sanity check startup core services прошел:
  - memory TTS queue запускается
  - websocket manager запускается
  - TTS worker запускается
  - worker reconciler запускается
- Реальный managed worker smoke с stub runtimes прошел:
  - F5 path прошел
  - Qwen path прошел
- Регрессионные backend-тесты по затронутым частям прошли.

## Что еще не сделано

### Не сделано в продукте

- Нет согласованного UI flow для pairing, worker status и onboarding.
- Нет новых публичных экранов под worker-agent path.
- Нет approved UX для self-host onboarding.
- Нет упакованного desktop/tray приложения для агента.
- Нет полноценного auto-update/install story для агента.

### Не сделано в live runtime

- Реальные upstream-сервисы на `8010`, `8011`, `8012` в момент последней проверки не были запущены.
- Поэтому реальный live E2E против настоящих F5/Qwen runtime еще не подтвержден.
- Не сделан полноценный production rollout с реальным трафиком.

### Не сделано по эксплуатации

- Нет финального production runbook для worker fleet.
- Нет полноценной observability-фазы с расширенной телеметрией.
- Не решена окончательно судьба `tts-gateway` после стабилизации нового worker path.

## Важные текущие замечания

- В shell окружении был обнаружен `DEBUG=release`.
- Это ломает загрузку `Settings`, потому что поле `DEBUG` ожидает булево значение.
- Для команд миграции и части dev-проверок приходилось временно подставлять `DEBUG=true`.
- Это лучше исправить у себя локально, чтобы `DEBUG` был `true` или `false`, а не `release`.

## Как запускать все части проекта

## 1. Базовые требования

- Python 3.10+
- Node.js 22+
- PostgreSQL
- Redis
- Для полного advanced TTS-контура дополнительно:
  - `tts-gateway`
  - `f5-tts-service`
  - `nano-qwen3tts-vllm`
- Для Qwen обычно нужен Linux или WSL2

## 2. Подготовка core-репозитория

Из корня `paidviewer_tools`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r bot_service/requirements.txt
python -m pip install -r bot_service/requirements_dev.txt

cd frontend
npm install
cd ..
```

Подготовить env:

```powershell
Copy-Item bot_service/.env.example bot_service/.env
Copy-Item frontend/.env.example frontend/.env
```

Минимум для `bot_service/.env`:

- `DATABASE_URL`
- `SECRET_KEY`
- `BACKEND_URL`
- `FRONTEND_URL`

Для полного advanced TTS-контура:

- `TTS_GATEWAY_URL`
- `TTS_GATEWAY_API_KEY`
- `F5_TTS_SERVICE_URL`
- `F5_TTS_SERVICE_API_KEY`
- `QWEN_TTS_SERVICE_URL`
- `QWEN_TTS_SERVICE_API_KEY`
- опционально `QWEN_VOICE_SERVICE_URL`

Важно:

- убедись, что `DEBUG=true` или `DEBUG=false`
- не оставляй `DEBUG=release`

## 3. Поднять PostgreSQL и Redis

Если локально уже есть свои PostgreSQL и Redis, используй их.
Если нет, самый простой вариант для dev:

```powershell
docker compose -f deploy/docker/docker-compose.dev.yml up -d postgres redis
```

После этого сверь `DATABASE_URL` и `REDIS_URL` в `bot_service/.env`.

## 4. Прогнать миграции bot_service

Из каталога `bot_service`:

```powershell
$env:DEBUG='true'
..\.venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
```

Если у тебя уже исправлен `DEBUG` в окружении и `.env`, временный override не нужен.

## 5. Запустить bot_service

Из каталога `bot_service`:

```powershell
$env:DEBUG='true'
..\.venv\Scripts\python.exe .\main.py
```

Ожидаемый адрес:

- `http://localhost:8000`

Быстрая проверка:

```powershell
curl http://localhost:8000/health
curl http://localhost:8000/health/live
curl http://localhost:8000/health/ready
```

## 6. Запустить frontend

В отдельном терминале:

```powershell
cd frontend
npm run dev
```

Ожидаемый адрес:

- `http://localhost:5173`

## 7. Запустить внешние TTS-сервисы

### Вариант A. Через docker compose полного dev-стека

Этот вариант работает, если у тебя уже есть локальные образы:

- `tts-gateway:latest`
- `f5-tts-service:latest`
- `nano-qwen3tts-vllm:latest`

Команда:

```powershell
docker compose -f deploy/docker/docker-compose.dev.yml up -d
```

Поднимутся:

- `postgres` на `5432`
- `redis` на `6379`
- `bot_service` на `8000`
- `tts-gateway` на `8010`
- `f5-tts-service` на `8011`
- `qwen_tts` внутри compose-контура
- `frontend` на `80`

### Вариант B. Запустить внешние сервисы вручную из соседних репозиториев

#### tts-gateway

Репозиторий: `h:\Programming\raw_code\AI\Python\tts-gateway`

```powershell
cd ..\tts-gateway
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8010
```

#### f5-tts-service

Репозиторий: `h:\Programming\raw_code\AI\Python\f5-tts-service`

```powershell
cd ..\f5-tts-service
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8011
```

#### nano-qwen3tts-vllm

Репозиторий: `h:\Programming\raw_code\AI\Python\nano-qwen3tts-vllm`

Linux / WSL2 путь:

```bash
cd ../nano-qwen3tts-vllm
python3 -m venv venv_wsl
source venv_wsl/bin/activate
pip install --upgrade pip setuptools wheel packaging ninja
pip install -r requirements.txt
pip install --no-build-isolation flash-attn
pip install -e .
python api_server.py
```

Ожидаемый адрес:

- `http://127.0.0.1:8012`

Быстрые проверки:

```powershell
curl http://localhost:8010/health/live
curl http://localhost:8011/health/live
curl http://localhost:8012/health/live
curl http://localhost:8012/health/ready
```

## 8. Запустить новый worker-agent path

Подготовить конфиг:

```powershell
Copy-Item tts_worker_agent\config.example.json tts_worker_agent\config.json
```

Настроить в `tts_worker_agent/config.json`:

- `server_base_url`
- `pairing_code`
- `providers.f5.endpoint_url`
- `providers.qwen.endpoint_url`

Установить зависимости агента:

```powershell
cd tts_worker_agent
python -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Запустить агент:

```powershell
.venv\Scripts\python.exe .\main.py --config .\config.json
```

Важно:

- pairing code выдается через `bot_service`
- после активации агент сам сохранит `worker_token` и `worker_key`
- агент не открывает входящий порт, он сам ходит в `bot_service`

Подробный manual flow лежит в:

- `docs/setup/TTS_WORKER_AGENT_MANUAL.md`

## 9. Проверки после запуска

### Проверки core

```powershell
curl http://localhost:8000/health
curl http://localhost:8000/health/ready
curl "http://localhost:8000/api/tts/health?provider=f5&mode=cloud"
curl "http://localhost:8000/api/tts/health?provider=qwen&mode=cloud"
```

### Проверка нового worker control smoke

Если нужно быстро проверить новый managed worker path даже без поднятых реальных upstream-сервисов:

```powershell
.\.venv\Scripts\python.exe -B scripts\dev\worker_control_smoke.py
```

Этот скрипт:

- не меняет UI
- поднимает stub F5/Qwen runtimes
- проверяет managed worker path end-to-end
- полезен как dev smoke, но не заменяет реальный live E2E с настоящими сервисами

## 10. Рекомендуемые сценарии запуска

### Минимальный web/dev сценарий

- PostgreSQL
- `bot_service`
- `frontend`

Подходит для:

- разработки dashboard
- auth
- базового backend
- API без реального advanced TTS

### Полный legacy advanced TTS сценарий

- PostgreSQL
- Redis
- `bot_service`
- `frontend`
- `tts-gateway`
- `f5-tts-service`
- `nano-qwen3tts-vllm`

Подходит для:

- старого gateway-based advanced path
- полного ручного локального тестирования всего TTS-контура

### Новый worker-agent сценарий

- PostgreSQL
- `bot_service`
- `frontend`
- локальный `tts_worker_agent`
- локальный `f5-tts-service` и/или `nano-qwen3tts-vllm`

Подходит для:

- нового backend-first control plane
- managed/self-host worker path
- дальнейшего развития без изменения UI

## Итог

Текущее направление проекта такое:

- backend-first
- один `bot_service` как control plane
- F5 и Qwen равны на уровне backend
- legacy path не ломаем
- UI пока не трогаем
- новый worker-agent path уже реализован и частично подтвержден живыми проверками

Следующий большой этап после этого документа:

- поднять реальные `tts-gateway`, `f5-tts-service`, `nano-qwen3tts-vllm`
- прогнать настоящий live E2E без stub runtimes
- после этого уже решать, что именно согласовываем в UI
