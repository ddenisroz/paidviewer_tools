# Документация TTS_TTV_0.02

**Последнее обновление:** 3 ноября 2025  
**Версия проекта:** 0.02

---

## Быстрый старт

### Для обычных пользователей (стримеры):
1. **[README.md](../README.md)** - Главный README (5 минут)
2. **[QUICK_START.md](QUICK_START.md)** - Полная установка

### Для разработчиков:
1. **[README.md](../README.md)** - Обзор проекта
2. **[ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md)** - Архитектура (1 страница)
3. **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** - Паттерны и примеры

### Для AI-агентов (Claude, GPT):
1. **[LLM_DEVELOPMENT_RULES.md](LLM_DEVELOPMENT_RULES.md)** - ОБЯЗАТЕЛЬНО! Правила
2. **[CURRENT_STATUS.md](CURRENT_STATUS.md)** - ЧТО РАБОТАЕТ/НЕ РАБОТАЕТ
3. **[DO_NOT_TOUCH.md](DO_NOT_TOUCH.md)** - Что нельзя менять

---

## Организованная структура

### БЫСТРЫЕ
| Файл | Время | Для кого |
|------|-------|----------|
| **[README.md](../README.md)** | 5 мин | Все |
| **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** | 10 мин | Разработчики |
| **[ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md)** | 10 мин | Разработчики |

### КРИТИЧЕСКИЕ
| Файл | Для кого |
|------|----------|
| **[DO_NOT_TOUCH.md](DO_NOT_TOUCH.md)** | AI-агенты, разработчики |
| **[CURRENT_STATUS.md](CURRENT_STATUS.md)** | AI-агенты, разработчики |
| **[LLM_DEVELOPMENT_RULES.md](LLM_DEVELOPMENT_RULES.md)** | AI-агенты |

### ОСНОВНАЯ
| Файл | Описание |
|------|----------|
| [QUICK_START.md](QUICK_START.md) | Установка и первый запуск |
| [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md) | Полная архитектура |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Паттерны, best practices |
| [CHANGELOG.md](CHANGELOG.md) | История изменений |

### СПЕЦИАЛИЗИРОВАННЫЕ
| Файл | Тема |
|------|------|
| [TTS_ARCHITECTURE.md](TTS_ARCHITECTURE.md) | TTS система |
| [SHARED_WEBSOCKET.md](SHARED_WEBSOCKET.md) | WebSocket |
| [DROPS_SYSTEM.md](DROPS_SYSTEM.md) | Drops система |
| [GUEST_MODE_SUPPORT.md](GUEST_MODE_SUPPORT.md) | Гостевой режим |
| [SECURITY_LOGIC.md](SECURITY_LOGIC.md) | Безопасность |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Деплой |

### VK Live API Reference

Документация VK Live API находится в папке `vk/` (19 файлов).

---

## Поиск информации

| Вопрос | Файл |
|--------|------|
| Как работает TTS? | TTS_ARCHITECTURE.md |
| Как работает ChatBox? | CURRENT_STATUS.md |
| Как работают токены? | TOKEN_SYSTEM_UNIFIED.md |
| Как работают команды? | UNIFIED_COMMANDS.md |
| Как работает WebSocket? | SHARED_WEBSOCKET.md |
| VK API не работает? | vk/Методы.*.md |

---

## Статус проекта

### Работает
- Multi-platform (Twitch, VK Live, DonationAlerts)
- TTS (Cloud gTTS + Local F5-TTS)
- ChatBox (OBS overlay)
- Commands (global, override, custom)
- Drops система (lootbox, streak, donation)
- YouTube заказы
- Гостевой режим
- Админ панель

---

## Технический стек

**Backend:** FastAPI, SQLAlchemy, Alembic, WebSocket, TwitchIO  
**Frontend:** React 18, Vite, Tailwind, shadcn/ui, React Query  
**Database:** SQLite (dev) / PostgreSQL (prod)  
**TTS:** Google Cloud TTS / F5-TTS

---

**Последнее обновление:** 3 ноября 2025
