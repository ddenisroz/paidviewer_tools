23.09.2025, 11:01 Кабинет разработчика VK Видео Live – публичное API стриминговой платформы VK Видео Live API
Документация Приложения
API платформы VK Video Live
Использование API
WebSocket (websocket)
Методы
Каталог
Получение токена для подписки на websocket-канал
Категории
Текущий пользователь
Канал Примеры кода
Чат
Баллы канала
GET /v1/websocket/subscription_token
Роли канала
Записи стримов
Стрим Метод предназначен для получения токенов для подписки на ws-каналы. Если метод не возвращает токе
Видео значит доступ к каналу не может быть предоставлен данному пользователю.
Токен
Websocket
Авторизация Доступность
Получение токена для подписки на websocket-
канал
Метод получения токена для подключения к
пользователь все
pubsub сервису
Подписка на события
Параметры
Схемы
Разное
Имя параметра Расположение Формат Обязательный Описан
channels query string false Список
Примеры ответов
200 Ответ
{
"data": {
"channel_tokens": [
{
"channel": "string",
"token": "string"
}
]
}
}
401 Ответ
{
"error": "unauthorized",
"error_description": "Not authorized"
}
403 Ответ
{
"error": "forbidden",
"error_description": "Access to resource forbidden"
}
https://dev.live.vkvideo.ru/docs/method/websocket 1/3

23.09.2025, 11:01 Кабинет разработчика VK Видео Live – публичное API стриминговой платформы VK Видео Live API
Ответы
Cтатус Значение Описание
200 OK Отдается при успешном запросе
401 Unauthorized Отдается при ошибке проверки авторизационных токенов
Отдается, если текущий уровень авторизации недопускает данной
403 Forbidden
операции
Метод получения токена для подключения к pubsub сервис
Примеры кода
GET /v1/websocket/token
Авторизация Доступность
пользователь, приложение все
Примеры ответов
200 Ответ
{
"data": {
"token": "string"
}
}
401 Ответ
{
"error": "unauthorized",
"error_description": "Not authorized"
}
403 Ответ
{
"error": "forbidden",
"error_description": "Access to resource forbidden"
}
Ответы
Cтатус Значение Описание
200 OK Отдается при успешном запросе
401 Unauthorized Отдается при ошибке проверки авторизационных токенов
https://dev.live.vkvideo.ru/docs/method/websocket 2/3

23.09.2025, 11:01 Кабинет разработчика VK Видео Live – публичное API стриминговой платформы VK Видео Live API
Cтатус Значение Описание
403 Forbidden Отдается, если текущий уровень авторизации недопускает данной опер
https://dev.live.vkvideo.ru/docs/method/websocket 3/3

