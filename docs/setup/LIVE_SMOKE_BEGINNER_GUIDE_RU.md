# Инструкция Для Первого Live Smoke

Дата: 2026-03-12

Эта инструкция сделана для новичка. Иди строго по шагам сверху вниз.

Если коротко:

1. скачать нужные репозитории
2. заполнить `.env`
3. запустить предварительную проверку
4. поднять сервисы
5. проверить сначала F5
6. только потом трогать Qwen

## Самое Важное Сразу

Если ты не разбираешься в Docker и Qwen, не начинай с Qwen.

Правильный первый круг такой:

1. `gateway-managed f5`
2. `self-hosted f5`
3. проверить, что `qwen` voice CRUD дает ожидаемый `501`

Qwen runtime можно оставить на второй этап.

## Что Открыть

Открой эти файлы:

1. `bot_service/.env`
2. `bot_service/.env.example`
3. `frontend/.env`
4. `frontend/.env.example`
5. `docs/setup/LIVE_SMOKE_RUNBOOK.md`
6. `docs/setup/LOCAL_TTS_INTEGRATION.md`

## Шаг 1. Скачай Нужные Репозитории

Рекомендуемая структура папок:

```text
H:\Programming\raw_code\AI\Python\
├─ TTS_TTV_0.02\
├─ tts-gateway\
├─ f5-tts-service\
└─ nano-qwen3tts-vllm\
```

Клонируй их рядом с этим проектом, а не внутрь него.

Открой PowerShell:

```powershell
cd H:\Programming\raw_code\AI\Python
git clone https://github.com/ddenisroz/tts-gateway.git
git clone -b phase1-bootstrap https://github.com/ddenisroz/f5-tts-service.git
git clone https://github.com/calldatfate/nano-qwen3tts-vllm.git
```

Что за что отвечает:

1. `tts-gateway` — managed path
2. `f5-tts-service` — F5 runtime и voice/admin API
3. `nano-qwen3tts-vllm` — Qwen runtime

## Шаг 2. Пойми, Откуда Брать API Key

Для `tts-gateway` и `f5-tts-service` API key обычно задаешь ты сам.

То есть:

1. сам придумываешь ключ
2. вставляешь его в `.env` внешнего сервиса
3. тот же самый ключ вставляешь в `bot_service/.env`

Быстро сгенерировать ключ в PowerShell:

```powershell
[guid]::NewGuid().ToString("N")
```

### Для `tts-gateway`

В его `.env` или config найди:

```env
TTS_GATEWAY_API_KEYS=
```

Поставь туда свой ключ.

Потом в `bot_service/.env` поставь этот же ключ:

```env
TTS_GATEWAY_API_KEY=
```

### Для `f5-tts-service`

В его `.env` или config найди:

```env
F5_TTS_SERVICE_API_KEYS=
```

Поставь туда свой ключ.

Потом в `bot_service/.env` поставь этот же ключ:

```env
F5_TTS_SERVICE_API_KEY=
```

### Для `qwen`

Сейчас не усложняй:

1. если в `qwen` нет явной настройки ключа, не выдумывай ее
2. `QWEN_TTS_SERVICE_API_KEY` можно оставить пустым
3. для первого smoke тебе важнее, чтобы сервис вообще поднялся и отвечал по URL

## Шаг 3. Заполни `bot_service/.env`

Обязательные поля:

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

Как заполнять:

1. `TTS_GATEWAY_URL`
   Адрес поднятого `tts-gateway`
   Пример: `http://localhost:8010`

2. `F5_TTS_SERVICE_URL`
   Адрес поднятого `f5-tts-service`
   Пример: `http://localhost:8011`

3. `QWEN_TTS_SERVICE_URL`
   Адрес поднятого `nano-qwen3tts-vllm`
   Пример: `http://localhost:8000`

4. `LOCAL_TTS_ALLOWED_HOSTS`
   Стартовое значение:
   `localhost,127.0.0.1,::1,host.docker.internal,f5_tts,tts_service,qwen_tts,qwen_service`

5. `LOCAL_TTS_ALLOWED_CIDRS`
   Стартовое значение:
   `127.0.0.0/8,::1/128`

## Шаг 4. Заполни `frontend/.env`

Проверь, что там есть:

```env
VITE_BOT_SERVICE_URL=http://localhost:8000
VITE_BOT_SERVICE_WS_URL=ws://localhost:8000
```

## Шаг 5. Не Лезь В Qwen Раньше Времени

Если ты не разбираешься в Docker, Qwen пока отложи.

Почему:

1. `nano-qwen3tts-vllm` обычно требует Linux или WSL2
2. у него сейчас не самый дружелюбный запуск для новичка
3. ты можешь потратить много времени и не получить полезный smoke

Поэтому первый практический прогон делай без Qwen runtime.

## Шаг 6. Запусти Preflight

Из корня проекта выполни:

```powershell
.\scripts\dev\tts-smoke-preflight.ps1 -Scenario all
```

Как понимать результат:

1. `[OK]` — хорошо
2. `[WARN]` — можно жить, но надо понимать риск
3. `[FAIL]` — дальше не идти

Пока есть хотя бы один `[FAIL]`, live smoke не начинай.

## Шаг 7. Подними Сервисы

Порядок запуска:

1. PostgreSQL
2. Redis
3. `f5-tts-service`
4. `tts-gateway`
5. миграции `bot_service`
6. `bot_service`
7. `frontend`

Qwen пока можно не поднимать, если ты идешь по простому пути.

## Шаг 8. Что Тестировать На Первом Круге

### 1. Managed F5

Тестируй:

1. `GET /api/tts/health?provider=f5`
2. синтез через managed path

Настройки:

```json
{
  "engine": "f5tts",
  "advancedProvider": "f5",
  "f5Mode": "cloud",
  "useLocalTTS": false
}
```

### 2. Self-Hosted F5

Через экран Local TTS:

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

### 3. Qwen Voice CRUD

Сейчас правильный результат:

1. backend возвращает `501`
2. UI не делает вид, что voice CRUD работает

Это нормально для текущего этапа.

## Шаг 9. Когда Переходить К Qwen

К Qwen переходи только если:

1. F5 managed уже работает
2. F5 self-hosted уже работает
3. preflight зеленый или понятный
4. у тебя есть Linux или WSL2
5. ты готов запускать Qwen отдельно

Если этого нет, Qwen пока не трогай.

## Шаг 10. Что Считать Успехом

Минимальный успех первого круга:

1. `f5` через managed path работает
2. `f5` через self-hosted endpoint работает
3. `qwen` voice CRUD отдает ожидаемый `501`

Расширенный успех:

1. `qwen` через managed path тоже работает
2. `qwen` через self-hosted endpoint тоже работает

## Если Что-То Упало

Сначала найди слой проблемы:

1. `.env`
2. сервис не поднят
3. Redis
4. gateway
5. F5 upstream
6. Qwen upstream
7. только UI

Не пытайся объяснить все одной причиной.

## Куда Смотреть Дальше

Если нужна подробная версия:

1. `docs/setup/LIVE_SMOKE_RUNBOOK.md`
2. `docs/setup/LOCAL_TTS_INTEGRATION.md`
3. `docs/STATUS_TRACKER.md`

Если проблема именно в Qwen:

1. `docs/backlog/QWEN_UPSTREAM_PARITY_TASKS_2026-03-12_RU.md`

## Последнее Правило

Не коммить реальные секреты из `.env`.
