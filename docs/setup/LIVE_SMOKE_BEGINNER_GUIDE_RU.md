# Инструкция для первого live smoke

Дата: 2026-03-13

Это упрощённая инструкция для первого прогона. Если нужен полный технический порядок, открой [LIVE_SMOKE_RUNBOOK.md](LIVE_SMOKE_RUNBOOK.md).

## Самое важное

Если не разбираешься в Docker и Qwen, не начинай с Qwen.

Правильный первый круг:

1. `gateway-managed f5`
2. `self-hosted f5`
3. проверка, что `qwen` voice CRUD даёт ожидаемый `501`

Qwen runtime можно оставить на второй этап.

## Что открыть

1. `bot_service/.env`
2. `bot_service/.env.example`
3. `frontend/.env`
4. `frontend/.env.example`
5. `docs/setup/LIVE_SMOKE_RUNBOOK.md`
6. `docs/setup/LOCAL_TTS_INTEGRATION.md`

## 1. Склонируй нужные репозитории

Рекомендуемая структура:

```text
H:\Programming\raw_code\AI\Python\
├─ TTS_TTV_0.02\
├─ tts-gateway\
├─ f5-tts-service\
└─ nano-qwen3tts-vllm\
```

Команды:

```powershell
cd H:\Programming\raw_code\AI\Python
git clone https://github.com/ddenisroz/tts-gateway.git
git clone https://github.com/ddenisroz/f5-tts-service.git
git clone https://github.com/calldatfate/nano-qwen3tts-vllm.git
```

## 2. Разбери API keys

Для `tts-gateway` и `f5-tts-service` ключ обычно задаёшь сам:

1. придумываешь ключ
2. сохраняешь его в `.env` внешнего сервиса
3. тот же ключ копируешь в `bot_service/.env`

Быстро сгенерировать ключ:

```powershell
[guid]::NewGuid().ToString("N")
```

Для `qwen` на первом прогоне можно оставить `QWEN_TTS_SERVICE_API_KEY=` пустым, если upstream его не требует.

## 3. Заполни `bot_service/.env`

Обязательно:

```env
SECRET_KEY=
DATABASE_URL=
BACKEND_URL=
FRONTEND_URL=
TTS_GATEWAY_URL=
TTS_GATEWAY_API_KEY=
F5_TTS_SERVICE_URL=
F5_TTS_SERVICE_API_KEY=
QWEN_TTS_SERVICE_URL=
LOCAL_TTS_ALLOWED_HOSTS=
LOCAL_TTS_ALLOWED_CIDRS=
```

Стартовые значения для allow-list:

```env
LOCAL_TTS_ALLOWED_HOSTS=localhost,127.0.0.1,::1,host.docker.internal,f5_tts,tts_service,qwen_tts,qwen_service
LOCAL_TTS_ALLOWED_CIDRS=127.0.0.0/8,::1/128
```

## 4. Заполни `frontend/.env`

Проверь:

```env
VITE_BOT_SERVICE_URL=http://localhost:8000
VITE_BOT_SERVICE_WS_URL=ws://localhost:8000
```

## 5. Запусти preflight

Из корня проекта:

```powershell
.\scripts\dev\tts-smoke-preflight.ps1 -Scenario all
```

Пока есть `[FAIL]`, live smoke не начинай.

## 6. Подними сервисы

Порядок запуска:

1. PostgreSQL
2. Redis
3. `f5-tts-service`
4. `tts-gateway`
5. миграции `bot_service`
6. `bot_service`
7. `frontend`

Qwen пока можно не поднимать.

## 7. Что тестировать на первом круге

### Managed F5

Проверь:

- `GET /api/tts/health?provider=f5`
- synth через managed path

Настройки:

```json
{
  "engine": "f5tts",
  "advancedProvider": "f5",
  "f5Mode": "cloud",
  "useLocalTTS": false
}
```

### Self-hosted F5

Через Local TTS:

1. введи URL F5
2. нажми `Test connection`
3. сохрани
4. включи self-hosted режим

Настройки:

```json
{
  "engine": "f5tts",
  "advancedProvider": "f5",
  "f5Mode": "local",
  "useLocalTTS": true
}
```

### Qwen voice CRUD

Сейчас правильный результат:

1. backend возвращает `501`
2. UI не делает вид, что voice CRUD работает

## 8. Если что-то сломалось

Сначала смотри, где именно проблема:

1. `.env` и preflight
2. поднятие сервисов
3. managed path
4. self-hosted path
5. только frontend UI
