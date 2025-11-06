# Система виджетов для OBS

Полноценная система создания и настройки виджетов для интеграции с OBS Studio.

## 🎯 Возможности

### ✅ Реализовано:
- **Виджет чата** - отображение сообщений в реальном времени
- **Виджет лутбокса** - анимация открытия с эффектами
- **Настраиваемый интерфейс** - цвета, размеры, анимации
- **WebSocket подключение** - реальное время
- **Экспорт/импорт** конфигураций
- **Предварительный просмотр** - тестирование перед OBS

### 🚀 В разработке:
- Виджет донатов
- Виджет подписчиков
- Виджет фоловеров
- Виджет зрителей

## 📁 Структура

```
widgets/
├── ChatWidget/                 # Виджет чата
│   ├── index.html             # HTML страница
│   ├── style.css              # Стили с CSS переменными
│   └── script.js              # JavaScript логика
├── LootboxWidget/             # Виджет лутбокса
│   ├── index.html
│   ├── style.css
│   └── script.js
├── shared/                    # Общие компоненты
│   ├── websocket.js           # WebSocket клиент
│   └── config-manager.js      # Менеджер конфигураций
└── README.md                  # Эта документация
```

## 🎨 Настройка виджетов

### Виджет чата:
- **Размеры**: ширина, высота
- **Цвета**: фон, границы, текст по ролям
- **Анимации**: слайд, появление, отскок
- **Шрифты**: семейство, размер, вес
- **Функции**: время, роли, максимум сообщений

### Виджет лутбокса:
- **Размеры**: ширина, высота
- **Анимация**: длительность, эффекты
- **Эффекты**: частицы, свечение, звук
- **Цвета**: по редкости (common, rare, epic, legendary)

## 🔧 Использование

### 1. Настройка виджета:
1. Перейдите в **Виджеты OBS** в меню
2. Выберите тип виджета (Чат/Лутбокс)
3. Настройте внешний вид и параметры
4. Сохраните конфигурацию

### 2. Добавление в OBS:
1. Скопируйте URL из настроек
2. В OBS добавьте **Browser Source**
3. Вставьте URL
4. Установите размеры (ширина x высота)
5. Включите "Shutdown source when not visible"

### 3. Тестирование:
- Используйте кнопки тестирования в настройках
- Проверьте WebSocket подключение
- Убедитесь в корректной работе анимаций

## 🌐 API Endpoints

### Конфигурации (требуют аутентификации):
- `POST /api/widgets/chat/config` - Сохранить конфигурацию чата для текущего пользователя
- `GET /api/widgets/chat/config/{id}?user_id={user_id}` - Получить конфигурацию чата
- `POST /api/widgets/lootbox/config` - Сохранить конфигурацию лутбокса для текущего пользователя
- `GET /api/widgets/lootbox/config/{id}?user_id={user_id}` - Получить конфигурацию лутбокса
- `GET /api/widgets/configs` - Список конфигураций текущего пользователя
- `DELETE /api/widgets/config/{id}` - Удалить конфигурацию текущего пользователя

### WebSocket (персональные каналы):
- `ws://localhost:8000/ws/chat-widget/{user_id}` - Подключение виджета чата пользователя
- `ws://localhost:8000/ws/lootbox-widget/{user_id}` - Подключение виджета лутбокса пользователя

### Статические файлы:
- `/widgets/chat/` - Файлы виджета чата
- `/widgets/lootbox/` - Файлы виджета лутбокса

## 🔐 Изоляция пользователей

### Безопасность:
- ✅ **Персональные конфигурации** - каждый пользователь видит только свои виджеты
- ✅ **Аутентификация** - все API endpoints требуют авторизации
- ✅ **Изолированные WebSocket** - каналы разделены по пользователям
- ✅ **Проверка доступа** - пользователи не могут получить чужие конфигурации

### URL структура:
```
/widgets/chat?config={config_id}&user={user_id}
/widgets/lootbox?config={config_id}&user={user_id}
```

### WebSocket каналы:
```
ws://localhost:8000/ws/chat-widget/{user_id}
ws://localhost:8000/ws/lootbox-widget/{user_id}
```

## 📡 WebSocket события

### Чат виджет:
```javascript
// Входящие события
{
  "type": "chat_message",
  "username": "Viewer123",
  "message": "Привет всем!",
  "role": "normal",
  "platform": "twitch",
  "timestamp": "2024-01-15T14:30:25Z"
}
```

### Лутбокс виджет:
```javascript
// Входящие события
{
  "type": "lootbox_opened",
  "username": "Viewer123",
  "rarity": "legendary",
  "lootbox_type": "legendary",
  "timestamp": "2024-01-15T14:30:25Z"
}
```

## 🎨 CSS переменные

### Чат виджет:
```css
--widget-width: 400px;
--widget-height: 300px;
--background-color: rgba(0, 0, 0, 0.8);
--text-color: #ffffff;
--moderator-color: #00ff00;
--vip-color: #ff6b6b;
--subscriber-color: #4ecdc4;
--normal-color: #ffffff;
```

### Лутбокс виджет:
```css
--widget-width: 400px;
--widget-height: 300px;
--animation-duration: 2s;
--common-color: #9CA3AF;
--rare-color: #3B82F6;
--epic-color: #8B5CF6;
--legendary-color: #F59E0B;
```

## 🔧 Разработка

### Добавление нового виджета:

1. **Создайте папку виджета:**
   ```
   widgets/NewWidget/
   ├── index.html
   ├── style.css
   └── script.js
   ```

2. **Добавьте API endpoints:**
   ```python
   # В api/widgets.py
   @router.post("/newwidget/config")
   async def save_new_widget_config(config: Dict[str, Any]):
       # Логика сохранения
   ```

3. **Добавьте WebSocket:**
   ```python
   # В main.py
   @app.websocket("/ws/newwidget-widget")
   async def websocket_new_widget(websocket: WebSocket):
       # Логика подключения
   ```

4. **Создайте конфигуратор:**
   ```jsx
   // В components/widgets/NewWidgetConfigurator.jsx
   const NewWidgetConfigurator = () => {
       // Интерфейс настройки
   };
   ```

## 🐛 Отладка

### Проблемы с WebSocket:
1. Проверьте URL подключения
2. Убедитесь что bot_service запущен
3. Проверьте CORS настройки

### Проблемы с виджетами:
1. Откройте DevTools в браузере
2. Проверьте консоль на ошибки
3. Убедитесь в корректности конфигурации

### Проблемы с OBS:
1. Проверьте URL виджета
2. Убедитесь в правильности размеров
3. Включите "Shutdown source when not visible"

## 📝 Примеры

### Отправка сообщения в чат:
```python
from websocket_handlers import send_chat_message

# Всем пользователям
await send_chat_message(
    username="Viewer123",
    message="Привет всем!",
    role="normal",
    platform="twitch"
)

# Конкретному пользователю
await send_chat_message(
    username="Viewer123",
    message="Привет всем!",
    role="normal",
    platform="twitch",
    user_id="user_123"
)
```

### Отправка события лутбокса:
```python
from websocket_handlers import send_lootbox_opened

# Всем пользователям
await send_lootbox_opened(
    username="Viewer123",
    rarity="legendary",
    lootbox_type="legendary"
)

# Конкретному пользователю
await send_lootbox_opened(
    username="Viewer123",
    rarity="legendary",
    lootbox_type="legendary",
    user_id="user_123"
)
```

## 🎯 Планы развития

- [ ] Виджет донатов с анимацией
- [ ] Виджет подписчиков с эффектами
- [ ] Виджет фоловеров
- [ ] Виджет зрителей онлайн
- [ ] Виджет целей донатов
- [ ] Виджет опросов
- [ ] Темы оформления
- [ ] Плагины для OBS
- [ ] Мобильная версия настройщика
