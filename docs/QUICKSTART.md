# Быстрый старт

Этот документ описывает запуск **всего проекта**, а не только `bot_service` и `frontend`.

Под “весь проект” здесь понимается:

- `postgres`
- `redis`
- `bot_service`
- `frontend`
- `tts-gateway`
- `f5-tts-service`
- `nano-qwen3tts-vllm`
- `tts_worker_agent` при проверке `self_host`

## Требования

- Python `3.12`
- Node.js `20+`
- Docker Desktop + Docker Compose
- PostgreSQL и Redis, если запускаешь не через docker compose
- Linux/WSL2 для штатного запуска `nano-qwen3tts-vllm`

## Репозитории

- основной продукт: [paidviewer_tools](/H:/Programming/raw_code/AI/Python/paidviewer_tools)
- cloud gateway: [tts-gateway](/H:/Programming/raw_code/AI/Python/tts-gateway)
- F5 runtime: [f5-tts-service](/H:/Programming/raw_code/AI/Python/f5-tts-service)
- Qwen runtime: [nano-qwen3tts-vllm](/H:/Programming/raw_code/AI/Python/nano-qwen3tts-vllm)

## Рекомендуемый путь: полный Docker-контур

Это основной локальный сценарий для всего проекта.

### 1. Подготовь основной репозиторий
Для основного Docker-сценария локальная установка Python-зависимостей и `npm install` не нужны.

Достаточно перейти в основной репозиторий:

```powershell
cd H:\Programming\raw_code\AI\Python\paidviewer_tools
```

### 2. Подготовь `.env`

Если `.env` уже настроены, **не перезаписывай их**.

Если файлов нет:

```powershell
Copy-Item bot_service/.env.example bot_service/.env
Copy-Item frontend/.env.example frontend/.env
```

Минимум для `bot_service/.env`:

- `DATABASE_URL`
- `REDIS_URL`
- `SECRET_KEY`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `VK_CLIENT_ID`
- `VK_CLIENT_SECRET`
- `TTS_GATEWAY_URL`
- `TTS_GATEWAY_API_KEY`
- `F5_TTS_SERVICE_URL`
- `F5_TTS_SERVICE_API_KEY`
- `QWEN_TTS_SERVICE_URL`
- `QWEN_TTS_SERVICE_API_KEY`

### 3. Подними локальный Docker-контур

```powershell
cd H:\Programming\raw_code\AI\Python\paidviewer_tools
docker compose --env-file bot_service/.env --env-file deploy/docker/compose.local.env `
  -f deploy/docker/docker-compose.prod.yml -f deploy/docker/docker-compose.local.yml `
  --profile core --profile cloud-tts up --build
```

Если нужен только core без TTS runtime профиля:

```powershell
docker compose --env-file bot_service/.env --env-file deploy/docker/compose.local.env `
  -f deploy/docker/docker-compose.prod.yml -f deploy/docker/docker-compose.local.yml `
  --profile core up --build
```

Контур поднимет:

- `postgres` на `5432`
- `redis` на `6379`
- `bot_service` на `8000`
- `tts-gateway` на `8010`
- `f5-tts-service` на `8011`
- `qwen_tts` на `8012` через Docker
- `frontend` на `80`

### 4. Зафиксируй локальный origin для OAuth

Локально открывай приложение только через:

- `http://localhost`

Не смешивай `localhost` и `127.0.0.1`: для OAuth это разные origin, и это ломает cookie/state-проверку.

Локальные redirect URI у провайдеров должны быть такими:

- `http://localhost/auth/twitch/callback`
- `http://localhost/auth/twitch/bot/callback`
- `http://localhost/auth/vk/callback`
- `http://localhost/auth/vk/bot/callback`
- `http://localhost/auth/donationalerts/callback`

`web-push URL` в VK Live не является OAuth callback и настраивается отдельно.

### 5. Проверь базовые точки

- `http://localhost`
- `http://localhost:8000/health`
- `http://localhost:8000/api/tts/health?provider=f5`
- `http://localhost:8000/api/tts/health?provider=qwen`
- `http://localhost:8010/health/ready`
- `http://localhost:8011/health/ready`
- `http://localhost:8012/health/ready`

Старый `deploy/docker/docker-compose.dev.yml` оставлен только как совместимый локальный compose, но официальный путь теперь production-first: `docker-compose.prod.yml + docker-compose.local.yml`.

## Вариант B. Запуск self-host агента

Основной стек остаётся Docker-first, но `tts_worker_agent` по своей природе запускается отдельно на машине пользователя.

## Если нужен именно локальный dev без Docker

Этот путь больше не считается основным стартовым сценарием.

Используй его только если осознанно отлаживаешь backend/frontend вне контейнеров.

## Self-host путь через `tts_worker_agent`

Если нужно проверить `self_host`, поднимай агент отдельно. Автозапуск теперь **только opt-in**.

```powershell
cd H:\Programming\raw_code\AI\Python\paidviewer_tools\tts_worker_agent
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python.exe .\main.py --config .\config.json
```

Активация:

1. Открой `Local TTS` в интерфейсе Paidviewer
2. Скачай provisioning bundle
3. Выполни pairing flow
4. Проверь локальную диагностику:
   - `http://127.0.0.1:46321/health`
   - `http://127.0.0.1:46321/diagnostics`

Если нужен installer-managed автозапуск, это отдельное явное действие:

```powershell
.\install-agent.ps1 -EnableAutostart -StartNow
```

## Минимальная последовательность проверки после запуска

1. Открой UI и войди в систему
2. Проверь `/api/tts/health` и `/api/tts/status`
3. Прогони один `cloud F5` synth
4. Прогони один `cloud Qwen` synth
5. Если нужен self-host smoke, подними `tts_worker_agent` и прогони `self_host F5` и `self_host Qwen`
6. Проверь YouTube queue, drops и VK bot status

## Перед релизом

- [release/RELEASE_CHECKLIST.md](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/release/RELEASE_CHECKLIST.md)
- [setup/LIVE_SMOKE_RUNBOOK.md](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/setup/LIVE_SMOKE_RUNBOOK.md)
- [setup/TTS_SUPPORT_RUNBOOK.md](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/setup/TTS_SUPPORT_RUNBOOK.md)
