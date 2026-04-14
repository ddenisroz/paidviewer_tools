# Live smoke runbook

Последнее обновление: 2026-04-05

Это документ для первого end-to-end smoke без смешения инфраструктурных проблем, контрактных проблем и upstream gaps.

## Термины

- `cloud` — `bot_service -> tts-gateway -> provider runtime`
- `self_host` — `bot_service -> provisioning/pairing -> tts_worker_agent -> local runtime`
- `raw endpoint compatibility` — запасной ручной путь через `local_tts_endpoints`; не основной пользовательский сценарий

## Что входит в первый smoke

Обязательно:

1. `cloud` synth для `f5`
2. `cloud` synth для `qwen`
3. `self_host via tts_worker_agent` для `f5`
4. `self_host via tts_worker_agent` для `qwen`
5. `drops` duplicate-event/session-boundary
6. `youtube` next/skip/reorder
7. `vk` bot OAuth beta flow

## Preflight

Перед стартом прогони:

```powershell
.\scripts\dev\tts-smoke-preflight.ps1 -Scenario all
```

До smoke должно быть закрыто:

- `bot_service/.env` существует и заполнен
- `frontend/.env` существует и указывает на `bot_service`
- backend знает URL и API keys для TTS upstreams
- provider-specific direct keys (`F5_TTS_SERVICE_API_KEY`, `QWEN_TTS_SERVICE_API_KEY`) не подменяются одним только `TTS_GATEWAY_API_KEY`
- `LOCAL_TTS_ALLOWED_HOSTS` и `LOCAL_TTS_ALLOWED_CIDRS` настроены
- `tts_worker_agent` поднимается вручную или через явно включённый opt-in автозапуск, а не за счёт скрытых startup side effects
- Qwen runtime для smoke поднят на Linux или WSL2, если используется локальный/self-host путь

## Что preflight не гарантирует

- что Redis реально доступен из `tts-gateway`
- что F5 assets и weights реально присутствуют
- что Qwen runtime реально поднят в Linux или WSL2
- что пользователь уже авторизован и может включить self-host режим

## Порядок запуска

1. PostgreSQL
2. Redis
3. `f5-tts-service`
4. `nano-qwen3tts-vllm`
5. `tts-gateway`
6. миграции `bot_service`
7. `bot_service`
8. `frontend`

## Базовые health checks

- `GET /health` у `bot_service`
- `GET /api/tts/health?provider=f5`
- `GET /api/tts/health?provider=qwen`
- `GET /api/voices/providers/capabilities`
- открыть `/dashboard/admin?tab=overview` и убедиться, что admin read-models загружаются
- открыть `/tts-player`, потому что website-mode воспроизведение без него не стартует

## Сценарии

### S1. Cloud F5

Ожидаемо:

- `f5Mode = cloud`
- `advancedProvider = f5`
- `useLocalTTS = false`
- synth проходит через `tts-gateway`

### S2. Cloud Qwen

Ожидаемо:

- `qwenMode = cloud`
- `advancedProvider = qwen`
- `useLocalTTS = false`
- synth проходит через `tts-gateway`

### S3. Self-host F5 via agent

Ожидаемо:

- provisioning bundle создаётся успешно
- `tts_worker_agent` активируется без `version_mismatch`
- synth идёт через локальный агент и локальный runtime
- upload smoke использует [female_1.wav](/H:/Programming/raw_code/AI/Python/paidviewer_tools/female_1.wav)

### S4. Self-host Qwen via agent

Ожидаемо:

- provisioning bundle создаётся успешно
- `tts_worker_agent` активируется без `version_mismatch`
- synth идёт через локальный агент и локальный runtime
- upload smoke использует [female_1.wav](/H:/Programming/raw_code/AI/Python/paidviewer_tools/female_1.wav) и валидный `API_KEY` worker-а

### S5. Drops duplicate-event/session-boundary

Ожидаемо:

- повторный donation/chat event не создаёт вторую награду
- streak progression опирается на `stream_session_id`
- reconnect overlay не ломает историю и не дублирует reward emission

### S6. YouTube queue/runtime

Ожидаемо:

- `Play now`, `next`, `skip` и reorder работают консистентно
- reorder сохраняется на сервере
- natural end не ломает переход на следующий ролик

### S7. VK bot OAuth beta flow

Ожидаемо:

- bot OAuth возвращает нормализованные коды ошибок
- успешный callback поднимает bot runtime или честно возвращает `restart_failed`
- VK остаётся beta-tier, но без ложного success-state

## Критерий успеха

Первый smoke считается успешным, если:

1. `f5` и `qwen` synth работают через `cloud`
2. `f5` и `qwen` работают через `self_host` именно через `tts_worker_agent`
3. `drops` не дублируют награды на повторных событиях
4. `youtube` queue/runtime проходит smoke без ручного восстановления
5. `vk` bot OAuth beta flow не даёт ложных success-state
6. frontend везде остаётся backend-only

## Для презентационного smoke

- не меняй порядок шагов по ходу демонстрации
- считай `VK Live` обязательным live-блоком, если он заявлен в сценарии презентации
- не используй legacy admin route или raw endpoint fallback как часть основного сценария
