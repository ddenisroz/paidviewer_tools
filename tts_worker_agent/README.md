# Paidviewer TTS Worker Agent

Официальный self-host агент для Paidviewer.

## Кому нужен этот репозиторий

Этот репозиторий нужен, если ты хочешь запускать локальную озвучку у себя на ПК или сервере и отдавать нагрузку на свой F5/Qwen runtime.

Если ты просто используешь Paidviewer как облачный сервис, этот репозиторий тебе обычно не нужен.

## Что делает агент

Агент:

1. получает provisioning bundle из Paidviewer
2. проходит pairing по одноразовому коду
3. забирает задания у `bot_service`
4. отправляет их в локальный F5 или Qwen runtime
5. возвращает результат обратно в Paidviewer

## Рабочая модель

- `cloud`: `frontend -> bot_service -> tts-gateway -> provider runtime`
- `self_host`: `frontend -> bot_service -> provisioning/pairing -> tts_worker_agent -> local runtime`

Основной пользовательский self-host путь — только через `tts_worker_agent`.
`raw endpoint` остаётся только как compatibility-режим для поддержки и диагностики.

## Быстрый старт

Базовый runtime: Python `3.12`.

1. Открой `Local TTS` в Paidviewer.
2. Скачай provisioning bundle `paidviewer-worker-provisioning-*.json`.
3. Подготовь окружение:

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

4. Запусти агент вручную:

```powershell
.venv\Scripts\python.exe .\main.py --config .\config.json
```

Если нужен installer-managed автозапуск, это отдельное явное действие:

```powershell
.\install-agent.ps1 -EnableAutostart -StartNow
```

Если нужно только подготовить окружение без автозапуска:

```powershell
.\install-agent.ps1
```

На первом запуске агент ищет provisioning bundle сначала рядом с собой, потом в `Downloads`.

## Локальная диагностика

- `GET http://127.0.0.1:46321/health`
- `GET http://127.0.0.1:46321/diagnostics`

Типовые коды:

- `version_mismatch`
- `provider_unreachable`
- `auth_failed`
- `model_not_ready`
- `voice_missing`

## Что ожидается от локальных провайдеров

- F5 runtime: `POST /api/tts/synthesize-channel`
- Qwen runtime: `POST /api/prepare`, затем `GET /api/stream/{stream_id}`

## Важные замечания

- На Windows секреты агента хранятся через DPAPI best-effort.
- Сервер может отклонить activation/polling, если версия агента ниже обязательной.
- Если self-host не нужен, не включай автозапуск.
