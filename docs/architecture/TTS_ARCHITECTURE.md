# TTS Architecture

Последнее обновление: 2026-04-06

Этот документ нужен для понимания общей схемы TTS в Paidviewer.

Если тебе нужно просто запустить проект, начни с [QUICKSTART.md](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/QUICKSTART.md).

## Коротко

В продукте есть только два официальных режима озвучки:

- `cloud`
- `self_host`

Никакие старые названия вроде `self-hosted endpoint`, `project-hosted worker`, `gateway-managed` больше не считаются основным сценарием.

## Как идёт запрос в cloud

```text
frontend -> bot_service -> tts-gateway -> provider runtime
```

Это общий cloud-путь и для `f5`, и для `qwen`.

## Как идёт запрос в self-host

```text
frontend -> bot_service -> provisioning/pairing -> tts_worker_agent -> local runtime
```

Это общий self-host путь и для `f5`, и для `qwen`.

## Кто за что отвечает

`frontend`
- показывает настройки и статусы
- не ходит напрямую в TTS runtime

`bot_service`
- хранит пользовательские настройки
- решает, куда направить запрос
- отдаёт `status`, `health`, capability flags
- создаёт provisioning bundle и pairing flow

`tts-gateway`
- общий cloud-оркестратор
- управляет очередью и вызовами provider runtime

`f5-tts-service`
- F5 runtime
- F5 voice/admin APIs

`nano-qwen3tts-vllm`
- Qwen runtime
- streaming synthesis
- хранение Qwen voice samples

`tts_worker_agent`
- официальный self-host агент
- связывает `bot_service` с локальным runtime пользователя

## Какие backend endpoints считаются основными

- `GET /api/tts/status`
- `GET /api/tts/health`
- `GET /api/voices/providers/capabilities`
- `POST /api/local-tts/test-connection`

UI и support должны опираться именно на них.

## Что важно помнить

- `frontend` не должен использовать прямые provider URL
- `tts-gateway` нужен только для `cloud`
- `tts_worker_agent` — основной self-host путь
- raw endpoint нужен только как запасной compatibility-сценарий для поддержки
- Qwen runtime в production лучше считать Linux/WSL-first
