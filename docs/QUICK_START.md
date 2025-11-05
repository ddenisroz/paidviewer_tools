# Быстрый старт (5 минут)

**Версия:** 2.0.0 | **Статус:** Готово | **Дата:** 20 октября 2025

## Установка

### 1. Backend
```bash
cd bot_service
pip install -r requirements.txt
python main.py
# http://localhost:8000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
# http://localhost:3000
```

## Минимальный .env

```env
# bot_service/.env
TWITCH_CLIENT_ID=xxx
TWITCH_CLIENT_SECRET=xxx
VK_CLIENT_ID=xxx
VK_CLIENT_SECRET=xxx
SECRET_KEY=random_32_chars_min
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

## Авторизация

1. Откройте http://localhost:3000
2. Нажмите "Авторизация"
3. Выберите Twitch или VK Live
4. Готово!

## Что готово?

15/15 багов исправлено  
TTS озвучка (gTTS + F5-TTS)  
Чат (Twitch + VK Live)  
YouTube поиск и очередь  
Админка с analytics  
Фильтры и чёрный список  

## Проблемы?

Смотрите `README_MAIN.md` раздел "ЕСЛИ ЧТО-ТО НЕ РАБОТАЕТ"

---

**Дальше:** читайте `README_MAIN.md`

