# 📜 Changelog - История изменений проекта

Все значимые изменения в проекте документируются в этом файле.

---

## 🔧 Nov 3, 2025 - Code Quality & Cleanup

### ✨ Duplicate Removal
- **Backend:**
  - Удалены дублирующиеся middleware в `main.py` (CORS, Session, StaticFiles настроены в `create_app()`)
  - Удален дублирующийся route handler `create_command_no_slash`
  - Удален дублирующийся endpoint `/api/auth/status` из `additional_api.py` (оставлен в `main.py`)
  - Удалены дублирующиеся импорты (`Bot`, `VKLiveBot`)
  
- **Frontend:**
  - Удалены неиспользуемые страницы: StreamTitlePage, StreamCategoryPage, TtsPage, LootboxPage, YouTubeQueuePage, HiddenAuthPage, CommandsManagementPage, YoutubeSettingsPage, ChannelPointsPage, BotsManagementPage

### 🎨 UI Improvements
- Динамические заголовки страниц в Header (Озвучка, YouTube заказы, Drops система, и т.д.)
- Обновлен BACKGROUND Header для соответствия с main content

### 🔧 Performance
- Мемоизация AuthContext для предотвращения ненужных re-renders
- Использование `useCallback` для стабильных ссылок на функции

### 🔐 Security
- Добавлен `vk_channel_name` в auth status API для корректной работы Drops системы с VK Live

---

## 🔧 Nov 3, 2025 - Release Prep

### ✅ Security
- ✅ Rate limiting (slowapi + limits)
- ✅ Input sanitization (XSS/SQLi)
- ✅ JWT + OAuth2 encryption
- ✅ CSRF protection
- ✅ Retry logic with exponential backoff

### ✅ Reliability  
- ✅ Exponential backoff для VK Live API
- ✅ Timeout configuration для всех HTTP клиентов
- ✅ Retry для Twitch/VK/YouTube/DonationAlerts API
- ✅ SharedWebSocket (Singleton pattern)

### ✅ Performance
- ✅ React Query caching
- ✅ Optimistic updates
- ✅ Database indexing

---

## 🔧 Session 32 - Drops Widget & Command Hierarchy (Nov 3, 2025)

### ✨ Drops System
- Widget token system для OBS
- Перегенерация токена
- Анимированное открытие сундука
- Автоматическая интеграция DonationAlerts

### 🎮 Commands
- Исправлена иерархия ролей (all → vip → moderator → broadcaster)
- Исправлено отображение пустых данных

---

## 🚀 Session 30 - Modern Stack (Nov 3, 2025)

### ✨ Backend
- Performance индексы для БД
- In-memory кеширование
- Оптимизация N+1 запросов

### 🎨 Frontend
- React Query integration
- Modern design system
- Skeleton loading

---

Полная история: см. `docs/CURRENT_STATUS.md`
