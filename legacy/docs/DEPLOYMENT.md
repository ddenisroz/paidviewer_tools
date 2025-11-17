# 🚀 Deployment v2.0.0

**Версия:** 2.0.0 | **Дата:** 20 октября 2025

## 🏠 Локально

```bash
# Backend
cd bot_service
pip install -r requirements.txt
python main.py

# Frontend (новый терминал)
cd frontend  
npm install
npm run dev
```

## 🐳 Docker

```bash
docker-compose up -d
```

## 🌐 Production

1. **Backend**: `python main.py --host 0.0.0.0 --port 8000`
2. **Frontend**: `npm run build && npm run preview`
3. **Nginx**: Проксируйте оба сервиса

## ⚙️ .env

```env
TWITCH_CLIENT_ID=xxx
TWITCH_CLIENT_SECRET=xxx
VK_CLIENT_ID=xxx
VK_CLIENT_SECRET=xxx
SECRET_KEY=random_secret_32_chars
BACKEND_URL=http://your-domain.com
FRONTEND_URL=http://your-domain.com
```

## 📊 Мониторинг

- Логи: `bot_service/logs/`
- Health check: `GET /health`
- Metrics: `GET /metrics`

---

**Версия:** 2.0.0 | **Статус:** Готово











