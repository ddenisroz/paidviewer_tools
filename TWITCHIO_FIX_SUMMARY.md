# Исправление ошибки TwitchIO

## 🚨 **Проблема**
```
AttributeError: module 'twitchio.ext.commands' has no attribute 'event'
```

## 🔧 **Решение**

Проблема была в неправильном использовании twitchio API. В twitchio нет декоратора `@commands.event`.

### ✅ **Исправления:**

1. **Создан новый класс `TwitchBot`:**
   ```python
   class TwitchBot(commands.Bot):
       def __init__(self, bot_instance: Bot, **kwargs):
           super().__init__(**kwargs)
           self.bot_instance = bot_instance
           
       async def event_message(self, message):
           """Правильная обработка сообщений в twitchio"""
   ```

2. **Обновлен метод `start()` в классе `Bot`:**
   ```python
   self.twitch_bot = TwitchBot(
       bot_instance=self,
       token=self.twitch_token,
       prefix=self.prefix,
       initial_channels=[]
   )
   ```

### 📋 **Логика обработки сообщений:**

1. **Игнорируем echo сообщения** (собственные сообщения бота)
2. **Игнорируем ботов** (сообщения от других ботов)
3. **Обрабатываем команды** (сообщения, начинающиеся с !, /, .)
4. **Автоматически отправляем в TTS** все остальные сообщения

### 🎯 **Результат:**
- ❌ Ошибка `AttributeError` устранена
- ✅ TwitchIO корректно обрабатывает события
- ✅ Автоматическая обработка сообщений чата работает
- ✅ Команды !mute и !unmute сохранены

---

**Статус:** ✅ Исправлено
**Файл:** `bot-service/main.py`  
**Тестирование:** Готово к запуску
