# 🛠️ Разработка и обновление проекта

Это руководство поможет вам легко вносить изменения в проект и обновлять его.

## 🚀 Быстрый старт для разработки

### 1. Первоначальная настройка

```bash
# Клонируем проект
git clone https://github.com/yourusername/tts-project.git
cd tts-project

# Автоматическая настройка среды
chmod +x dev-setup.sh
./dev-setup.sh
```

### 2. Запуск для разработки

```bash
# В разных терминалах:

# Frontend (React)
npm run dev:frontend

# Bot Service (FastAPI) 
npm run dev:bot

# TTS Service
npm run dev:tts
```

## 🔄 Внесение изменений

### Типичные сценарии изменений:

#### 🎨 **Изменения в UI (Frontend)**
```bash
# 1. Вносите изменения в frontend/src/
# 2. Изменения применяются автоматически (hot reload)
# 3. Для продакшена:
npm run build
npm run deploy  # только если нужно обновить на сервере
```

#### 🔧 **Изменения в API (Bot Service)**
```bash
# 1. Вносите изменения в bot_service/
# 2. Перезапустите сервис
# 3. Для продакшена:
docker-compose -f docker-compose.prod.yml restart bot_service
```

#### 🎤 **Изменения в TTS**
```bash
# 1. Вносите изменения в tts_service/
# 2. Перезапустите локальный TTS
# 3. Cloudflare Tunnel автоматически обновится
```

### 📝 **Добавление новых функций**

#### Новая страница в Frontend:
```bash
# 1. Создайте компонент в frontend/src/pages/
# 2. Добавьте роут в App.jsx
# 3. Добавьте в навигацию (Sidebar.jsx)
```

#### Новый API эндпоинт:
```bash
# 1. Добавьте в bot_service/main.py или отдельный файл
# 2. Обновите frontend/src/services/api.js если нужно
# 3. Добавьте в документацию
```

## 🔄 Система обновлений

### Автоматическое обновление

```bash
# Запустите скрипт обновления
./update.sh
```

Скрипт автоматически:
- ✅ Проверит изменения на сервере
- ✅ Сохранит ваши локальные изменения
- ✅ Обновит зависимости при необходимости
- ✅ Перезапустит нужные сервисы

### Ручное обновление

```bash
# 1. Сохраните изменения
git add .
git commit -m "Мои изменения"

# 2. Получите обновления
git pull origin main

# 3. Обновите зависимости (если нужно)
cd frontend && npm install && cd ..
cd bot_service && pip install -r requirements.txt && cd ..

# 4. Перезапустите сервисы
npm run deploy  # или перезапустите вручную
```

## 🔧 Полезные команды

### Разработка
```bash
npm run dev:frontend    # Frontend в dev режиме
npm run dev:bot        # Bot service
npm run dev:tts        # TTS service
npm run build          # Сборка frontend
```

### Продакшен
```bash
npm run deploy         # Полный деплой
npm run logs           # Просмотр логов
npm run status         # Статус сервисов
./update.sh            # Обновление
```

### Git
```bash
git status             # Статус изменений
git add .              # Добавить все изменения
git commit -m "msg"    # Коммит
git push origin main   # Отправить на сервер
```

### Docker (для продакшена)
```bash
# Перезапуск отдельных сервисов
docker-compose -f docker-compose.prod.yml restart frontend
docker-compose -f docker-compose.prod.yml restart bot_service

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f bot_service

# Полная пересборка
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

## 🐛 Отладка

### Frontend проблемы
```bash
# Проверить ошибки сборки
cd frontend && npm run build

# Проверить в браузере
# F12 -> Console -> смотрим ошибки
```

### Backend проблемы
```bash
# Локально
cd bot_service && python main.py
# Смотрим вывод в терминале

# В продакшене
docker-compose -f docker-compose.prod.yml logs -f bot_service
```

### TTS проблемы
```bash
# Проверить локальный сервис
curl http://localhost:8002/health

# Проверить туннель
curl https://your-tunnel-url.trycloudflare.com/health
```

## 📁 Структура проекта для изменений

```
tts-project/
├── frontend/src/
│   ├── pages/          ← Новые страницы
│   ├── components/     ← Новые компоненты
│   ├── services/       ← API клиенты
│   └── utils/          ← Утилиты
├── bot_service/
│   ├── main.py         ← Основные API
│   ├── api/            ← Эндпоинты
│   ├── models/         ← Модели данных
│   └── services/       ← Бизнес логика
├── tts_service/
│   ├── main.py         ← TTS API
│   ├── tts_engine.py   ← TTS движок
│   └── voices/         ← Голоса
└── deploy/             ← Конфигурация деплоя
```

## 🔐 Безопасность при разработке

### ❌ Не коммитьте:
- `.env` файлы с реальными ключами
- Пароли и токены
- Приватные ключи
- Базы данных

### ✅ Используйте:
- `.env.example` файлы как шаблоны
- `logger.debug()` вместо `console.log`
- Git hooks для проверки кода

## 🚀 Готовые шаблоны

### Новая страница:
```jsx
// frontend/src/pages/MyNewPage.jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MyNewPage = () => {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Моя новая страница</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Контент страницы</p>
                </CardContent>
            </Card>
        </div>
    );
};

export default MyNewPage;
```

### Новый API эндпоинт:
```python
# bot_service/main.py
@app.get("/api/my-endpoint")
async def my_endpoint():
    return {"message": "Hello from new endpoint"}
```

---

**Вносить изменения теперь очень просто!** 🎉

Любые вопросы? Смотрите логи, используйте `./update.sh` и не забывайте коммитить изменения!
