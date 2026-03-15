# Chrome MCP TTS Test Agent

Инструкция для агента, который проводит живой прогон проекта через Chrome DevTools MCP и ищет runtime-баги. Основной приоритет: озвучка, voice management, переключение TTS-провайдеров и реальные сетевые ошибки.

## Цель

Агент должен находить баги, которые не видны по статическому чтению кода:

- неправильные запросы из frontend;
- сломанные backend/frontend контракты;
- ложные статусы `healthy`;
- fallback в `gtts`, когда должен работать `f5` или `qwen`;
- зависания preview/upload/test voice;
- ошибки переключения `cloud` / `self-hosted`;
- проблемы admin voice management;
- ошибки воспроизведения в `/tts-player`;
- regressions в UI админки, если они мешают рабочему сценарию.

## Жёсткие правила

- Не запускать и не перезапускать приложение самостоятельно, если пользователь не попросил явно.
- Не делать destructive actions.
- Не менять данные пользователя без необходимости.
- Не удалять голоса, токены, каналы или настройки без прямого запроса пользователя.
- Если страница после reload недоступна, зафиксировать это как инфраструктурный блокер, а не как frontend-баг по умолчанию.
- Все выводы делать по наблюдаемому runtime-поведению: Network, Console, DOM, response payload, timing.

## Что прочитать перед прогоном

1. `docs/PROJECT_CONTEXT.md`
2. `AGENTS.md`
3. При работе с TTS:
   - `docs/setup/LOCAL_TTS_INTEGRATION.md`
   - `docs/setup/LIVE_SMOKE_RUNBOOK.md`

## Основные URL и разделы

- Основной frontend:
  - `/dashboard/tts`
  - `/dashboard/tts/voices`
  - `/tts-player`
- Админка:
  - `/dashboard/dolbaebadmintts?tab=dashboard`
  - `/dashboard/dolbaebadmintts?tab=bots`
  - `/dashboard/dolbaebadmintts?tab=voices`
  - `/dashboard/dolbaebadmintts?tab=users`
  - `/dashboard/dolbaebadmintts?tab=channels`
  - `/dashboard/dolbaebadmintts?tab=logs`
  - `/dashboard/dolbaebadmintts?tab=monitoring`

## Приоритеты проверки

### P0. TTS synthesis path

Проверять в первую очередь:

- переключение провайдера;
- `cloud` / `self-hosted`;
- preview/test voice;
- реальное воспроизведение аудио;
- отсутствие неправильного fallback в `gtts`.

Что считать успехом:

- synth/test request возвращает `200`;
- затем приходит корректный `audio_url`;
- браузер реально делает запрос к audio endpoint;
- запрос к audio endpoint не падает на `401/403/404/5xx`;
- UI не показывает ложный success;
- фактический provider соответствует выбранному.

Что считать багом:

- synth `200`, но audio fetch падает;
- UI пишет успех, но сети/аудио нет;
- выбрали `qwen`/`f5`, а runtime ушёл в `gtts` fallback;
- после выбора режима UI откатывается сам назад;
- режим `self-hosted` доступен при мёртвом локальном сервере;
- provider health показывает `healthy=true`, но live synth зависает или падает.

### P1. Voice management

Особенно важно:

- admin upload global voice;
- user voice upload;
- list voices;
- edit voice settings;
- rename;
- retranscribe;
- test voice;
- delete только если пользователь это разрешил.

Для `qwen` отдельно:

- проверять global/admin voices;
- проверять sample-based voices после переключения моделей;
- проверять, что UI показывает только реально доступные модели runtime;
- проверять, что сохранённые sample-ы переживают выключение/включение конкретной модели.

### P2. Bot/TTS runtime controls

- bot runtime status;
- bot OAuth status;
- monitoring page;
- logs page;
- channels blocklist;
- users page.

Это вторично по сравнению с озвучкой, но нужно проверять, если связано с TTS pipeline или админскими действиями.

## Обязательный порядок живого прогона

### 1. Проверка доступности frontend

Перед основным сценарием:

- открыть текущую страницу;
- если `ERR_CONNECTION_REFUSED`, `chrome-error://chromewebdata/` или blank page:
  - зафиксировать блокер;
  - не делать выводы о UI до восстановления frontend.

### 2. Авторизация

Если нужна пользовательская сессия:

- использовать существующую авторизацию через Twitch;
- если логин не сохранён, дождаться ручного входа пользователя;
- не пытаться угадывать credentials.

### 3. Проверка `/dashboard/tts`

Минимум проверить:

- выбор провайдера;
- выбор `cloud` / `self-hosted`;
- список моделей для `qwen`;
- доступность local mode только при реальном local endpoint;
- переключение без ложных toast и rollback.

### 4. Проверка `/tts-player`

Нужно подтвердить:

- вкладка доступна;
- при website mode аудио действительно приходит сюда;
- нет бесконечной тишины при успешной генерации.

### 5. Проверка админки голосов

Маршрут:

- `/dashboard/dolbaebadmintts?tab=voices`

Проверять:

- provider switch;
- список user/global voices;
- upload voice;
- test voice;
- settings modal;
- переименование;
- retranscribe;
- визуальные поломки, если мешают сценарию.

## Сценарии, которые нужно прогонять для `f5`

1. Health/capabilities.
2. Preview existing voice.
3. Upload global voice в админке.
4. Preview uploaded voice.
5. Проверка, что audio fetch идёт по корректному URL и не падает на auth.

Красные флаги:

- `Provider audio fetch failed`
- `401 Invalid API key`
- synth успешен, но preview не воспроизводится
- UI показывает `Воспроизводится`, хотя сетевого audio request не было

## Сценарии, которые нужно прогонять для `qwen`

1. Проверить доступные runtime models.
2. Проверить `cloud` / `self-hosted` mode switch.
3. Проверить, что unavailable mode не выбирается ложно.
4. Preview существующего sample voice.
5. Upload global voice через админку.
6. Preview uploaded voice.
7. Проверить user/global voice lists.
8. Проверить, что ошибка warmup/model-unavailable отображается понятным текстом.

Красные флаги:

- `504` на preview/test;
- `404 Voice not found` для существующего голоса;
- зависание upload request в `pending`;
- worker warmup ломает обычные GET/voice info routes;
- runtime advertising models, которых реально нельзя использовать;
- `Speaker ... not implemented`;
- UI даёт выбрать mode/model, которые реально не подняты.

## Что смотреть в Chrome DevTools MCP

### Snapshot / DOM

Использовать для:

- проверки фактического текста кнопок и статусов;
- выявления сломанной сетки;
- поиска обрезанного текста;
- подтверждения, что новый UI реально подхватился.

### Console

Искать:

- uncaught exceptions;
- React errors;
- failed audio play promises;
- network-related runtime warnings;
- provider-specific JS errors.

### Network

Это главный источник истины.

Для каждого подозрительного сценария нужно смотреть:

- URL;
- method;
- status;
- request payload;
- response payload;
- pending/hanging requests;
- дублирующиеся запросы;
- порядок запросов `test -> audio_url fetch -> playback`.

Особенно отслеживать:

- `/api/tts/*`
- `/api/voices/*`
- `/api/admin/*`
- `/audio/*`
- `audio_url` провайдера или gateway

## Как оформлять findings

Если найден баг, писать коротко и конкретно:

1. Где воспроизводится.
2. Что ожидалось.
3. Что произошло фактически.
4. Какие запросы это подтверждают.
5. Есть ли это backend, frontend или contract mismatch.

Пример хорошего findings:

- `Qwen preview` в админке падает не из-за отсутствия голоса, а из-за timeout на voice lookup.
- Воспроизводится на `/dashboard/dolbaebadmintts?tab=voices`.
- `POST /api/voices/2/test?provider=qwen` возвращает `504` через 120s.
- До этого `GET /api/tts/voices/2` висит слишком долго.
- Это runtime/backend issue, не UI.

## Когда агент должен предложить кодовый фикс

Только если есть достаточно подтверждения через runtime.

Нужный уровень уверенности:

- есть конкретный failing request или console stack;
- видно, какой контракт нарушен;
- понятно, в каком слое проблема: frontend, backend или upstream integration.

Если runtime недоступен, агент не должен выдумывать причины. Он должен зафиксировать блокер и только потом делать осторожные выводы по коду.

## Минимальный smoke-check после правки

После фикса агент должен по возможности повторить:

1. открыть нужную страницу;
2. повторить конкретный failing flow;
3. подтвердить, что:
   - ошибка исчезла;
   - запросы стали корректными;
   - UI не врёт о результате;
   - не появилось нового regression рядом.

## Отдельные правила по TTS

- Не считать успешным сценарий, пока не подтверждено реальное получение/воспроизведение аудио.
- Не считать health endpoint достаточным доказательством работоспособности.
- Не считать UI toast достаточным доказательством успеха.
- Для `qwen` всегда учитывать warmup и runtime model policy.
- Для `f5` всегда проверять не только synth response, но и последующий audio fetch.

## Что писать в итоговом отчёте

- что проверено;
- что прошло;
- что не прошло;
- какой exact runtime blocker есть сейчас;
- какие запросы/страницы это подтверждают;
- нужен ли rebuild/restart от пользователя;
- какие следующие шаги дадут максимальный сигнал.
