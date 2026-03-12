# Аудит Проекта

Дата: 2026-03-12

## Краткое резюме

У этого репозитория уже есть понятная целевая архитектура, но он всё ещё несёт большой объём исторического техдолга.

Что выглядит хорошо:

- Текущее направление по TTS понятно и в основном согласовано между активной документацией и runtime-кодом.
- `bot_service` явно выступает как control plane.
- Frontend runtime успешно зафиксирован на backend API/WS boundary.
- Provider-aware routing для `f5`, `qwen` и `gcloud` реализован и покрыт целевыми тестами.

Что выглядит рискованно:

- `bot_service` по-прежнему тянет чрезмерно большой набор зависимостей, где смешаны runtime, ML, тестовые и tooling-пакеты.
- Контракты auth/roles всё ещё содержат legacy-остатки guest mode, хотя в активных правилах guest mode объявлен удалённым.
- Активный набор docs нельзя считать полностью надёжным: часть файлов всё ещё содержит устаревшие пути и mojibake.
- Meta/system tests содержат legacy-ожидания и часто не падают, а только печатают warnings, что снижает доверие к тестовому слою.
- Deployment inputs пока недостаточно воспроизводимы, потому что upstream images и branch references не зафиксированы.

Итоговая оценка:

- Направление архитектуры: хорошее
- Ясность runtime-контрактов: средняя/хорошая
- Готовность к split: средняя
- Надёжность документации: средняя/низкая
- Гигиена зависимостей: низкая
- Надёжность тестового слоя: средняя/низкая

В проверенном объёме не найдено подтверждённых критических production-breaking дефектов, но есть несколько high-priority проблем, которые стоит закрыть до следующего этапа repo split и self-hosted rollout.

## Объём И Методика

Локально были проверены:

- `docs/`, `README.md`, env examples, compose files
- `bot_service/api`, `bot_service/services`, `bot_service/core`, `bot_service/tests`
- `frontend/src`, frontend API boundary utilities, TTS pages и contexts
- manifests зависимостей backend и frontend

Проверенные команды:

- `frontend`: `npm run check:no-direct-tts-url`
- `frontend`: `npm run type-check`
- `frontend`: `npm run build`
- `bot_service`: `..\.venv\Scripts\python.exe -m pytest -q tests/test_internal_service_auth.py tests/test_tts_provider_utils.py tests/test_tts_manager_fallback.py tests/test_api_tts.py tests/test_voice_functionality.py`
- `bot_service`: `..\.venv\Scripts\python.exe -m pytest -q tests/test_all_systems.py`

Важное ограничение:

- Внешние репозитории `tts-gateway`, `f5-tts-service` и `nano-qwen3tts-vllm` оценивались только через integration surface этого репозитория, docs, compose files и UI references.
- Полноценный построчный аудит upstream-кода из этой рабочей среды не проводился.

## Карта Репозитория

Наблюдаемый масштаб:

- `bot_service/api`: 70 файлов
- `bot_service/services`: 63 файла
- `frontend/src`: 374 файла
- `bot_service/tests`: 41 файл
- `docs`: 78 файлов
- `startup/router_registry.py` регистрирует 44 router'а

Текущая фактическая карта системы:

| Область | Роль | Текущее состояние |
|---|---|---|
| `frontend/` | React + Vite dashboard и widgets | Runtime boundary только к backend уже работает |
| `bot_service/` | Control plane: auth, settings, moderation, integrations, routing, WS | Крупный центральный сервис, всё ещё перегружен |
| `tts-gateway` | Оркестратор advanced synthesis | Воспринимается как внешняя зависимость, gateway-first contract уже ясен |
| `f5-tts-service` | Provider-owned F5 runtime и voice/admin API | Внешний сервис, текущие docs считают его owner'ом provider API |
| `nano-qwen3tts-vllm` | Qwen inference runtime | Внешний сервис, только synthesis; voice CRUD специально вынесен из текущей фазы |

Проверенные стабильные интерфейсы:

- `GET /api/tts/health?provider=f5|qwen|gcloud`
- `GET /api/voices/providers/capabilities`
- `/api/voices/*`
- `/api/admin/voices*`
- `/api/tts/*`
- `/api/local-tts/*`
- `/auth/twitch/*`, `/auth/vk/*`
- `/auth/twitch/bot/*`, `/auth/vk/bot/*`
- `/ws/chat/{user_id}`

## Подтверждённые Позитивные Сигналы

Подтверждено:

- `frontend/scripts/check-no-direct-tts-url.mjs` запрещает `F5_TTS_SERVICE_URL` и `VITE_TTS_SERVICE_URL` в runtime frontend code.
- `frontend/src/services/api/client.ts` и `frontend/src/shared/utils/urlUtils.ts` действительно ведут frontend runtime только через backend API/WS env.
- `bot_service/services/tts/provider_utils.py` и `bot_service/api/tts/settings_routes.py` соответствуют задокументированному staged-behavior для Qwen:
  - Qwen synthesis требует gateway
  - Qwen voice CRUD возвращает явный `501 detail`, пока не настроен `QWEN_VOICE_SERVICE_URL`
- Целевые TTS/backend contract tests проходят.
- Frontend type-check и production build проходят.

Предупреждения, увиденные при верификации:

- Pytest выдавал предупреждения на запись кэша:
  - `PytestCacheWarning`
  - `WinError 5` при создании `.pytest_cache`
- Frontend build сначала не прошёл внутри sandbox из-за `spawn EPERM`, но успешно прошёл при повторном запуске вне sandbox. Это ограничение среды выполнения, а не ошибка проекта.

## Findings

### HIGH-01: dependency boundary у `bot_service` всё ещё монолитный

Область: dependencies, architecture, split readiness

Доказательства:

- В `bot_service/requirements.txt` 220 пакетов.
- В одном runtime-файле смешаны runtime packages, тяжёлые ML packages и dev/test/tooling packages.
- Примеры из одного файла:
  - `torch==2.8.0+cu128`
  - `torchaudio==2.8.0+cu128`
  - `torchvision==0.23.0+cu128`
  - `bitsandbytes==0.48.1`
  - `f5-tts==1.1.9`
  - `gradio==5.49.0`
  - `wandb==0.22.2`
  - `pytest==8.4.2`
  - `pytest-cov==7.0.0`
  - `ruff==0.14.5`
  - `pip_audit==2.9.0`
- В `docs/STATUS_TRACKER.md` это уже отмечено как открытая задача.

Влияние:

- Установка core backend тяжелее, чем должна быть.
- Windows/local setup становится более хрупким.
- Текущая история зависимостей противоречит стратегии repo split.
- Сложнее понять, что `bot_service` действительно нужно на runtime.

Рекомендуемое действие:

1. Разделить backend dependencies хотя бы на:
   - runtime
   - dev/test
   - optional operational tooling
2. Убрать из `bot_service` provider-local ML dependencies там, где код уже завязан на внешние upstream services.
3. Зафиксировать минимальный поддерживаемый runtime set для `bot_service`.

Split relevance: core, deploy

### HIGH-02: Guest mode объявлен удалённым, но legacy guest behavior всё ещё живёт в коде и типах

Область: auth, contracts, docs, frontend

Доказательства:

- Активные правила говорят, что guest mode не должно быть:
  - `AGENTS.md`: guest mode deprecated/removed
  - `docs/guides/DEVELOPER_ONBOARDING.md`: не возвращать guest/anonymous auth flows
  - `docs/guides/TTS_TROUBLESHOOTING.md`: "No more guest sessions or basic auth"
- Но legacy guest residue всё ещё существует:
  - `frontend/src/constants/index.ts` содержит `VK_GUEST_START`, `VK_GUEST_VERIFY` и `USER_MODES.GUEST`
  - `bot_service/auth/auth.py` всё ещё возвращает synthetic guest users для session data без реального user id
  - `bot_service/core/permissions.py` всё ещё определяет `AppRole.GUEST`
  - `frontend/src/types/admin.d.ts` всё ещё моделирует admin session data как `session_type: 'active_user' | 'guest'`
  - `bot_service/tests/test_permissions.py` всё ещё считает guest first-class role
- При этом активных backend routes `/auth/.../guest/*` в проверенных API/auth модулях не найдено, то есть публичный контракт и внутренний legacy-механизм уже расходятся.

Влияние:

- Auth behavior перестал быть decision-complete для разработчиков.
- Инженеры могут случайно сохранить или вернуть deprecated guest flows.
- Docs и code сейчас учат разным версиям истины.

Рекомендуемое действие:

1. Принять одно явное решение:
   - либо полностью удалить guest support
   - либо честно описать его как legacy-compatible, но unsupported для новой работы
2. Если направление на удаление подтверждается, удалять в таком порядке:
   - frontend constants и мёртвые UI types
   - backend fallback paths, создающие guest users
   - permission model для guest role
   - stale tests и docs
3. Если compatibility нужно сохранить, обновить active docs и ограничить, где guest behavior всё ещё допустим.

Split relevance: core, frontend, docs

### HIGH-03: Активная docs surface неравномерно надёжна

Область: documentation

Доказательства:

- `docs/README.md` говорит, что docs с obsolete paths, removed endpoints или mojibake должны быть переписаны или перенесены в `docs/backlog/`.
- Но в active docs всё ещё есть stale и contradictory material:
  - `docs/guides/DEVELOPER_GUIDE.md` всё ещё указывает `F5_tts/` как часть runtime surface, хотя этой папки в репозитории нет.
  - `docs/features/VK_CHANNEL_POINTS_IMPLEMENTATION.md` содержит явный mojibake и ссылается на `bot_service/api/twitch_api.py`, которого не существует.
  - `docs/architecture/VALIDATION_SYSTEM.md` всё ещё документирует `guestModeSchema`.
- Подмножество source-of-truth в root docs в целом неплохое, но более широкий active docs tree пока не приведён в единое состояние.

Влияние:

- Разработчики могут пойти по неверному file path или неверной архитектурной модели.
- Работа по split и deploy замедляется, потому что docs нужно вручную перепроверять по коду.
- Docs index обещает более строгую hygiene discipline, чем реально соблюдается.

Рекомендуемое действие:

1. Ещё сильнее сузить набор "active docs" и начать это правило реально поддерживать.
2. Перенести stale feature/architecture notes с историческими деталями в `docs/backlog/`.
3. Добавить docs hygiene check на:
   - removed file paths
   - known stale env names
   - mojibake markers
4. Переписать `DEVELOPER_GUIDE.md` под фактическую текущую topology.

Split relevance: docs

### HIGH-04: meta/system test layer содержит stale expectations и слабосигнальные проверки

Область: tests, quality gates

Доказательства:

- `bot_service/tests/test_all_systems.py` всё ещё проверяет:
  - `VITE_TTS_SERVICE_URL`
  - `docs/CURRENT_STATUS.md`
  - `docs/DEVELOPER_GUIDE.md`
  - `api/twitch_api.py`
  - `features/drops/drops_service.py`
- `bot_service/tests/test_migration.py` всё ещё ожидает `VITE_TTS_SERVICE_URL` в frontend env examples.
- Текущий репозиторий больше не использует этот frontend env variable в runtime.
- Эти тесты в основном печатают warnings, а не падают на stale assumptions.
- При этом targeted TTS/backend tests проходят, то есть high-signal contract tests и stale meta tests сейчас спорят о том, что считать "healthy state".

Влияние:

- Test suite даёт ложное чувство покрытия.
- Исторический drift может жить бесконечно, потому что warning-style tests ничего не блокируют.
- Разработчику трудно понять, какие тесты реально защищают текущую архитектуру.

Рекомендуемое действие:

1. Изолировать или удалить stale meta tests.
2. Заменить их явными contract tests для:
   - backend-only frontend boundary
   - provider capability endpoint
   - Qwen `501` staging behavior
   - env example completeness только по текущим контрактам
3. Сделать stale-reference checks падающими, а не warning-only.

Split relevance: core, frontend, docs

### MEDIUM-01: versioning upstream'ов и воспроизводимость deployment пока слабые

Область: deploy, external integrations

Доказательства:

- Compose files используют floating upstream images:
  - `tts-gateway:latest`
  - `f5-tts-service:latest`
  - `nano-qwen3tts-vllm:latest`
- F5 references завязаны на branch name:
  - `docs/setup/LOCAL_TTS_INTEGRATION.md`
  - `frontend/src/features/tts/pages/LocalTTSSettingsPage.tsx`
  - оба указывают на `f5-tts-service/tree/phase1-bootstrap`
- `deploy/docker/docker-compose.prod.yml` всё ещё содержит более сложную worker topology (`tts_worker_1` ... `tts_worker_4`), которая не описана в текущем active docs set.

Влияние:

- Трудно воспроизвести конкретное known-good integration state.
- Upstream breakage может возникнуть без какого-либо изменения в этом repo.
- У операторов нет единой compatibility matrix.

Рекомендуемое действие:

1. Пиновать upstream images на tested tags или digests.
2. Заменить branch references на release tags или commit SHA там, где это возможно.
3. Добавить compatibility matrix в `docs/STATUS_TRACKER.md`:
   - версия gateway
   - версия f5 service
   - версия qwen
   - какой compose profile реально проверен

Split relevance: external, deploy

### MEDIUM-02: В репозитории всё ещё заметен encoding/text hygiene debt

Область: docs, developer experience

Доказательства:

- `docs/features/VK_CHANNEL_POINTS_IMPLEMENTATION.md` содержит mojibake.
- `bot_service/auth/auth.py` и несколько TS type/comment blocks показывают encoding artifacts.
- `deploy/docker/docker-compose.prod.yml` тоже содержит mojibake в комментариях.

Влияние:

- Снижает доверие к docs и комментариям.
- Усложняет review, search и сопровождение.
- Повышает шанс случайно использовать stale file.

Рекомендуемое действие:

1. Нормализовать active docs и comments к UTF-8.
2. Перенести исторические encoded files в `docs/backlog/` или переписать.
3. Добавить лёгкую encoding hygiene pass перед release-oriented работой.

Split relevance: docs, hygiene

### MEDIUM-03: Frontend build проходит, но bundle size остаётся medium-term risk

Область: frontend performance

Доказательства:

- Production build прошёл.
- Были замечены большие generated chunks, в том числе примерно:
  - `dash.all.min-*.js`: ~992 kB
  - `index-*.js`: ~606 kB
  - `hls-*.js`: ~521 kB
- Route-level lazy loading уже есть, но media/player dependencies всё ещё доминируют в части output.

Влияние:

- Более медрые initial loads и хуже cache efficiency на media-heavy путях.
- Сложнее будущая frontend extraction и deployment optimization.

Рекомендуемое действие:

1. Провести vendor chunking audit для video/player libraries.
2. Ещё агрессивнее разделить media-heavy routes.
3. После стабилизации split-плана ввести build-size thresholds для крупных chunks.

Split relevance: frontend

### LOW-01: local test cache hygiene шумная

Область: developer workflow

Доказательства:

- Pytest runs проходят, но выдают `.pytest_cache` warnings с `WinError 5`.
- В workspace есть временные pytest cache folders вида `pytest-cache-files-*`.

Влияние:

- Шум при локальной верификации.
- Может скрывать действительно важные warnings.

Рекомендуемое действие:

1. Исправить permissions/readonly flags вокруг pytest cache handling.
2. Убедиться, что временные cache paths стабильно игнорируются и чистятся.
3. При необходимости отключать cache provider в отдельных ограниченных средах.

Split relevance: hygiene

## Что Стоит Сохранить Как Базовый Контракт

Эти области уже в достаточно хорошем состоянии и их стоит сохранять как baseline:

- Backend-only frontend runtime boundary
- Provider capability endpoint
- Gateway-first provider routing
- Явное staged-behavior для Qwen через `501`
- SSRF hardening для local endpoints через allowed host/CIDR validation
- Стабильные backend health entrypoints

## Рекомендуемая Последовательность Работ

### Quick Wins: 1-2 Дня

1. Переписать или перенести stale active docs:
   - `docs/guides/DEVELOPER_GUIDE.md`
   - `docs/features/VK_CHANNEL_POINTS_IMPLEMENTATION.md`
   - `docs/architecture/VALIDATION_SYSTEM.md`
2. Изолировать stale meta tests:
   - `bot_service/tests/test_all_systems.py`
   - `bot_service/tests/test_migration.py`
3. В одном месте явно зафиксировать текущий статус guest mode.
4. Зафиксировать upstream image tags в compose-примерах.

### Medium-Term: 1-3 Недели

1. Разделить `bot_service` dependencies на runtime vs dev/test/tooling.
2. Удалить или формально ограничить legacy guest paths.
3. Заменить stale meta tests на contract tests, согласованные с split architecture.
4. Добавить docs linting для stale paths и mojibake.
5. Собрать явную compatibility matrix для внешних TTS services.

### External Phase

1. Провести прямой аудит репозитория `tts-gateway`:
   - auth contract
   - Redis dependency
   - provider adapters
   - health/readiness behavior
2. Провести прямой аудит репозитория `f5-tts-service`:
   - voice/admin API contract
   - worker topology
   - storage/model requirements
3. Провести прямой аудит репозитория `nano-qwen3tts-vllm`:
   - auth behavior
   - health contract
   - Linux/WSL runtime constraints
4. Принять решение, где именно должен жить Qwen voice CRUD:
   - в отдельном voice service
   - внутри Qwen repo
   - в provider-owned extension за `QWEN_VOICE_SERVICE_URL`

## Предположения И Дефолты, Использованные В Аудите

- Целевая архитектура из текущих active docs считается intended direction.
- `bot_service` в долгую должен оставаться control plane и становиться легче, а не тяжелее.
- Frontend extraction запланирован, но не завершён.
- Qwen voice CRUD в текущем состоянии staged intentionally и сам по себе не считается багом.
- Upstream repos рассматриваются как внешние зависимости, а не как внутренние implementation details этого repo.

## Финальная Оценка

Проект не находится в архитектурном хаосе. Базовые контракты вокруг advanced TTS routing, backend ownership и frontend boundary hardening движутся в правильную сторону и уже подтверждаются проходящими целевыми проверками.

Главные блокеры сейчас не в core TTS design. Они в dependency layering, test drift, trustworthiness документации и unresolved legacy auth residue. Именно эти проблемы сильнее всего удорожают будущий split, self-hosted deployment и multi-repo coordination.

Если следующий этап работы сначала уберёт эти блокеры, у репозитория есть рабочая база, чтобы продолжить разделение TTS platform stack без расшатывания текущего product surface.
