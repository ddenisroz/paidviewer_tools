# Shared WebSocket

Документ фиксирует только текущий рабочий контракт shared WebSocket между вкладками.

## Зачем это нужно

Без shared-модели каждая вкладка открывала бы собственный WebSocket. Это давало лишний трафик, дубли обработки сообщений и ненужную нагрузку на сервер.

Сейчас между вкладками используется single-leader модель:

- одна вкладка становится лидером;
- только лидер держит реальное WebSocket-соединение;
- остальные вкладки получают данные через `BroadcastChannel`.

## Текущий контракт

- shared WebSocket работает per-user;
- лидер выбирается автоматически;
- при смерти лидера другая вкладка забирает лидерство;
- passive-вкладки не открывают собственный runtime WebSocket, пока есть активный лидер;
- frontend использует один shared слой для чата, stream sync и связанных событий.

## Основные компоненты

- shared WebSocket manager во frontend;
- `BroadcastChannel` для связи между вкладками;
- WebSocket backend endpoint в `bot_service`;
- leader election и heartbeat-логика во frontend.

## Что нельзя ломать

- single-leader поведение;
- автоматическое переизбрание лидера;
- изоляцию каналов между разными пользователями;
- нормальную деградацию при отсутствии `BroadcastChannel`.

## Отладка

Что смотреть в консоли frontend:

- инициализацию вкладки;
- выбор лидера;
- подключение WebSocket;
- потерю лидера и переизбрание;
- пересылку сообщений из лидера в follower tabs.

## Ограничения

- `BroadcastChannel` работает только внутри одного origin;
- старые браузеры могут уйти в degraded mode;
- поведение должно быть одинаковым для dashboard, chat overlay и `tts-player`, если они используют shared runtime-канал.

## Связанные документы

- [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md)
- [DEVELOPER_GUIDE.md](../guides/DEVELOPER_GUIDE.md)
