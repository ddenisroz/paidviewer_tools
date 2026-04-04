# Paidviewer Tools

Основной репозиторий Paidviewer: `bot_service`, `frontend`, `tts_worker_agent`, интеграции платформ, YouTube queue и drops/streaks.

## С чего начать

- [Быстрый старт](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/QUICKSTART.md)
- [Контекст проекта](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/PROJECT_CONTEXT.md)
- [Release checklist](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/release/RELEASE_CHECKLIST.md)
- [Live smoke runbook](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/setup/LIVE_SMOKE_RUNBOOK.md)
- [Индекс активной документации](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/README.md)

## Коротко

- `frontend` общается только с `bot_service`
- `bot_service` — центральный backend и оркестратор
- `tts-gateway`, `f5-tts-service`, `nano-qwen3tts-vllm` — внешний cloud TTS-контур
- `tts_worker_agent` — официальный self-host путь

## Базовые команды

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r bot_service/requirements.txt
python -m pip install -r bot_service/requirements_dev.txt
```

```powershell
cd frontend
npm install
npm run type-check
npm run test:run
npm run build
```

```powershell
cd ..\bot_service
alembic upgrade head
python main.py
```

## Документация

В `docs/` оставлен только короткий активный слой. Всё историческое и производное должно жить в `docs/backlog/`.
