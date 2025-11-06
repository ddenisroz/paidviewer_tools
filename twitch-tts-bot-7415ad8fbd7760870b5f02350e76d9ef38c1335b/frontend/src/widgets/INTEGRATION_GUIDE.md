# 🎯 Руководство по интеграции виджетов

Это руководство поможет вам интегрировать систему виджетов в ваше приложение.

## 📋 Обзор системы

### **Виджеты:**
1. **Чат виджет** - отображение сообщений с настройками
2. **Лутбокс виджет** - анимация открытия сундуков
3. **Триггеры дропов** - настройка условий получения наград

### **Триггеры событий:**
- 💰 **Донаты** - по сумме доната
- 📅 **Стрики** - по дням присутствия на стримах
- 💬 **Сообщения** - по количеству сообщений в день
- 🎉 **Подписки** - по уровню подписки
- 👋 **Фолловы** - при подписке на канал

## 🚀 Быстрый старт

### 1. Запуск сервисов

```bash
# Терминал 1 - Backend
cd bot_service
python main.py

# Терминал 2 - Frontend  
cd frontend
npm run dev
```

### 2. Настройка виджетов

1. Откройте `http://localhost:3000`
2. Войдите в систему
3. Перейдите в "Виджеты OBS"
4. Настройте нужные виджеты
5. Скопируйте URL для OBS

### 3. Добавление в OBS

1. Добавьте **Browser Source**
2. Вставьте URL виджета
3. Установите размеры
4. Включите "Shutdown source when not visible"

## 🔧 Интеграция в код

### Python (Backend)

```python
from integrations.drops_integration import (
    handle_donation_event,
    handle_attendance_event, 
    handle_message_event,
    handle_subscription_event,
    handle_follow_event
)

# Обработка доната
await handle_donation_event(
    user_id="user123",
    username="ViewerName", 
    amount=500.0,
    message="На развитие канала!"
)

# Обработка присутствия на стриме
await handle_attendance_event(
    user_id="user123",
    username="ViewerName"
)

# Обработка сообщения
await handle_message_event(
    user_id="user123",
    username="ViewerName",
    message="Привет всем!",
    platform="twitch"
)

# Обработка подписки
await handle_subscription_event(
    user_id="user123",
    username="ViewerName",
    tier="2000",
    is_resub=False
)

# Обработка фоллова
await handle_follow_event(
    user_id="user123", 
    username="ViewerName"
)
```

### JavaScript (Frontend)

```javascript
// Отправка события через API
const triggerLootbox = async (username, rarity, reward) => {
    const response = await fetch('/api/widgets/lootbox/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username,
            rarity,
            reward,
            user_id: 'user123' // Опционально
        })
    });
};

// Использование
await triggerLootbox('ViewerName', 'epic', '1000 баллов');
```

## ⚙️ Настройка триггеров

### Создание триггера через API

```python
import requests

# Создание триггера доната
trigger_data = {
    "name": "Донат 500₽",
    "trigger_type": "donation",
    "condition": {"min_amount": 500},
    "reward": {"name": "500 баллов", "type": "points"},
    "rarity": "rare",
    "enabled": True
}

response = requests.post(
    'http://localhost:8000/api/drops/triggers',
    json=trigger_data,
    headers={'Authorization': 'Bearer YOUR_TOKEN'}
)
```

### Предустановленные триггеры

Система включает готовые триггеры:

- **Донат 100₽** → Обычный сундук
- **Донат 500₽** → Редкий сундук  
- **Донат 1000₽** → Эпический сундук
- **Стрик 7 дней** → Редкий сундук
- **Стрик 30 дней** → Легендарный сундук
- **100 сообщений** → Обычный сундук
- **1000 сообщений** → Эпический сундук

## 🎨 Настройка виджетов

### Чат виджет

```javascript
const chatConfig = {
    width: 400,
    height: 300,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    textColor: '#ffffff',
    fontSize: 14,
    platformFilter: 'combined', // 'twitch', 'vk', 'combined'
    showUserRoles: true,
    showTimestamps: false,
    maxMessages: 50
};
```

### Лутбокс виджет

```javascript
const lootboxConfig = {
    width: 500,
    height: 400,
    animationDuration: 3.0,
    showParticles: true,
    showGlow: true,
    soundEnabled: true,
    colors: {
        common: '#9CA3AF',
        rare: '#3B82F6',
        epic: '#8B5CF6', 
        legendary: '#F59E0B'
    }
};
```

## 📊 Мониторинг и статистика

### Получение статистики

```python
from integrations.drops_integration import get_user_drops_stats

stats = get_user_drops_stats("user123")
print(f"Стрик: {stats['streak_days']} дней")
print(f"Сообщений сегодня: {stats['messages_today']}")
```

### API статистики

```bash
# Получить статистику пользователя
curl -H "Authorization: Bearer TOKEN" \
     http://localhost:8000/api/drops/stats
```

## 🔄 WebSocket события

### Подключение к WebSocket

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/lootbox-widget/user123');

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'lootbox_opened') {
        // Обработка открытия лутбокса
        console.log(`${data.username} получил ${data.reward}`);
    }
};
```

### Типы событий

- `lootbox_opened` - открытие лутбокса
- `chat_message` - новое сообщение чата
- `user_stats_updated` - обновление статистики

## 🛠️ Расширение функциональности

### Добавление нового типа триггера

1. Обновите `check_trigger_condition()` в `drops_triggers.py`
2. Добавьте обработку в `drops_integration.py`
3. Обновите интерфейс в `DropsTriggersConfigurator.jsx`

### Добавление нового виджета

1. Создайте папку в `frontend/src/widgets/`
2. Добавьте HTML, CSS, JS файлы
3. Создайте конфигуратор в `frontend/src/components/widgets/`
4. Добавьте роутер в `main.py`
5. Обновите `WidgetsPage.jsx`

## 🐛 Отладка

### Проверка подключения

```bash
# Проверка здоровья API
curl http://localhost:8000/api/widgets/health

# Проверка WebSocket
curl http://localhost:8000/ws/chat-widget/test
```

### Логи

```bash
# Логи bot_service
tail -f bot_service/logs/app/bot_service.log

# Логи frontend
npm run dev # смотрите в консоли браузера
```

## 📝 Примеры использования

### Интеграция с Twitch ботом

```python
# В вашем Twitch боте
async def on_message(self, channel, user, message):
    # Обрабатываем сообщение
    await handle_message_event(
        user_id=user['id'],
        username=user['name'],
        message=message,
        platform='twitch'
    )
    
    # Проверяем присутствие
    await handle_attendance_event(
        user_id=user['id'],
        username=user['name']
    )
```

### Интеграция с системой донатов

```python
# В обработчике донатов
async def process_donation(self, donation_data):
    user_id = donation_data['user_id']
    username = donation_data['username']
    amount = donation_data['amount']
    message = donation_data.get('message', '')
    
    # Обрабатываем донат
    await handle_donation_event(
        user_id=user_id,
        username=username,
        amount=amount,
        message=message
    )
```

## 🎯 Лучшие практики

1. **Всегда указывайте user_id** для персональных виджетов
2. **Используйте try-catch** для обработки ошибок
3. **Проверяйте статус ответов** API
4. **Логируйте важные события** для отладки
5. **Тестируйте триггеры** перед продакшеном
6. **Мониторьте производительность** WebSocket соединений

## 🆘 Поддержка

При возникновении проблем:

1. Проверьте логи сервисов
2. Убедитесь в правильности URL виджетов
3. Проверьте настройки CORS
4. Убедитесь в корректности user_id
5. Проверьте подключение к WebSocket

---

**Готово!** Теперь вы можете интегрировать систему виджетов в ваше приложение. 🚀
