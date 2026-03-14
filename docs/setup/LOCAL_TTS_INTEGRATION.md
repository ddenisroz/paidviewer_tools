# Локальная интеграция TTS

Последнее обновление: 2026-03-13

Документ фиксирует активный контракт внешнего TTS-стека вокруг `bot_service`.

## Цель

Сохранить единый frontend boundary и разделить три режима работы TTS:

- `self-hosted endpoint` — пользователь поднимает TTS у себя и подключает URL
- `project-hosted worker` — отдельный воркер под инфраструктурой проекта
- `gateway-managed` — путь `bot_service -> tts-gateway -> project-hosted worker`

Voice/admin CRUD живёт на стороне upstream-провайдера.

## Термины

- `self-hosted endpoint` — пользовательский endpoint, который настраивается через экран Local TTS
- `project-hosted worker` — отдельный runtime-воркер проекта, это не пользовательский self-hosted режим
- `gateway-managed` — управляемый путь через `tts-gateway`

Флаги `use_local`, `f5_local`, `qwen_local` пока сохранены только как старые имена для self-hosted path.

## Runtime-контракт

1. Auth mode для upstreams — strict API key
2. `bot_service` отправляет оба заголовка:
   - `Authorization: Bearer <key>`
   - `X-API-Key: <key>`
3. Managed `qwen` synthesis требует настроенный `TTS_GATEWAY_URL`
4. Если `QWEN_VOICE_SERVICE_URL` пуст, qwen voice/admin CRUD возвращает явный `501`
5. `local_tts_endpoints` в runtime означают именно пользовательские self-hosted endpoints

## Нужные backend env

```env
TTS_GATEWAY_URL=http://localhost:8010
TTS_GATEWAY_API_KEY=<gateway-key>

F5_TTS_SERVICE_URL=http://localhost:8011
F5_TTS_SERVICE_API_KEY=<f5-key>

QWEN_TTS_SERVICE_URL=http://localhost:8000
QWEN_TTS_SERVICE_API_KEY=<qwen-key-or-empty>
QWEN_VOICE_SERVICE_URL=

LOCAL_TTS_ALLOWED_HOSTS=localhost,127.0.0.1,::1,host.docker.internal,f5_tts,tts_service,qwen_tts,qwen_service
LOCAL_TTS_ALLOWED_CIDRS=127.0.0.0/8,::1/128
```

## Upstream-репозитории

- `tts-gateway`: `https://github.com/ddenisroz/tts-gateway.git`
- `f5-tts-service`: `https://github.com/ddenisroz/f5-tts-service.git`
- `nano-qwen3tts-vllm`: `https://github.com/calldatfate/nano-qwen3tts-vllm.git`

## Порты по умолчанию

- `tts-gateway` — `8010`
- `f5-tts-service` — `8011`
- `nano-qwen3tts-vllm` — `8000`

## Ограничения по upstream

### `tts-gateway`

- требует Redis
- должен знать URL и API key для F5 и Qwen upstreams

### `f5-tts-service`

- требует свои env и БД
- для старта нужны `vendor/F5-TTS`, веса модели и зависимости prewarm

### `nano-qwen3tts-vllm`

- практически требует Linux или WSL2 runtime
- в текущем upstream нет native parity по auth, health и status
- self-hosted path в этом репозитории работает через слой совместимости

## Стабильные backend entrypoints

- `GET /api/tts/health?provider=f5|qwen|gcloud`
- `GET /api/voices/providers/capabilities`
- `GET /api/local-tts/config?provider=f5|qwen`
- `POST /api/local-tts/test-connection`
- `POST /api/local-tts/config`
- `POST /api/local-tts/toggle?provider=f5|qwen`
- `POST /api/tts/settings`
- `POST /api/tts/synthesize`

## Поведение voice/admin

- `provider=f5` — нормальный CRUD
- `provider=qwen` — `501`, пока не задан `QWEN_VOICE_SERVICE_URL`

## Базовый UI flow для self-hosted

1. Открой Local TTS settings
2. Выбери provider `f5` или `qwen`
3. Сохрани endpoint URL
4. При необходимости сохрани endpoint API key
5. Включи self-hosted режим в TTS settings

## Smoke-checklist

1. `GET /api/tts/health?provider=f5` возвращает healthy
2. `GET /api/tts/health?provider=qwen` возвращает healthy или контролируемый gateway-required статус
3. Synth через backend и gateway работает для `f5` и `qwen`
4. F5 voice CRUD работает через backend routes
5. Qwen voice CRUD даёт ожидаемый `501`
6. Self-hosted Qwen connection checks используют compatibility probe
