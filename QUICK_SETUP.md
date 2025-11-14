# ⚡ Быстрая установка (5 минут)

## 1. Клонировать
```bash
git clone https://github.com/ddenisroz/twitch-tts-bot.git
cd twitch-tts-bot
```

## 2. Backend
```bash
cd bot_service
cp .env.example .env
# Отредактировать .env (см. ниже)
pip install -r requirements.txt
alembic upgrade head
python main.py
```

## 3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## 4. Открыть
http://localhost:5173

---

## Что заполнить в bot_service/.env:

```bash
# Сгенерировать:
SECRET_KEY="результат: openssl rand -hex 32"
TOKEN_ENCRYPTION_KEY="результат: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"

# Получить на сайтах:
TWITCH_CLIENT_ID="с https://dev.twitch.tv/console/apps"
TWITCH_CLIENT_SECRET="с https://dev.twitch.tv/console/apps"
VK_CLIENT_ID="с https://vk.com/apps?act=manage"
VK_CLIENT_SECRET="с https://vk.com/apps?act=manage"

# Остальное можно оставить по умолчанию
```

---

## Готово! 🚀

**Не работает?** → Смотри `SETUP_GUIDE.md`
