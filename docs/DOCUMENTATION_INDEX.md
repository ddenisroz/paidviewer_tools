# 📚 Индекс документации TTS_TTV_0.02

**Последнее обновление:** 22 октября 2025

---

## 🎯 С чего начать?

### Для разработчиков (людей):
1. 📖 **[QUICK_START.md](QUICK_START.md)** - Быстрый старт проекта
2. 🏗️ **[ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md)** - Архитектура системы
3. 👨‍💻 **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** - Руководство разработчика

### Для AI-агентов:
1. 🚨 **[CURRENT_STATUS.md](CURRENT_STATUS.md)** - ЧИТАЙ ПЕРВЫМ! Что работает, что нет
2. 🤖 **[LLM_DEVELOPMENT_RULES.md](LLM_DEVELOPMENT_RULES.md)** - КРИТИЧЕСКИЕ правила
3. 🔧 **[QUICK_FIX_GUIDE.md](QUICK_FIX_GUIDE.md)** - Исправление типичных багов

---

## 📁 Структура документации

### 🔴 КРИТИЧЕСКИ ВАЖНЫЕ (читать обязательно!)

| Документ | Для кого | Описание |
|----------|----------|----------|
| [**DO_NOT_TOUCH.md**](DO_NOT_TOUCH.md) | AI + Разработчики | 🚫 **ФАЙЛЫ КОТОРЫЕ НЕЛЬЗЯ ТРОГАТЬ!** Система категорий |
| [**CURRENT_STATUS.md**](CURRENT_STATUS.md) | AI + Разработчики | ✅ Что работает, ❌ что сломано, 🔧 что в работе |
| [**LLM_DEVELOPMENT_RULES.md**](LLM_DEVELOPMENT_RULES.md) | AI-агенты | Правила чтобы НЕ ломать рабочие фичи |
| [**QUICK_FIX_GUIDE.md**](QUICK_FIX_GUIDE.md) | Все | Быстрое исправление частых проблем |

### 🟢 Основная документация

| Документ | Описание |
|----------|----------|
| [QUICK_START.md](QUICK_START.md) | Быстрый запуск проекта за 5 минут |
| [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md) | Архитектура: Backend, Frontend, База данных |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Как разрабатывать: паттерны, примеры, best practices |
| [DEVELOPER_HANDOFF.md](DEVELOPER_HANDOFF.md) | Передача проекта новому разработчику |
| [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) | Техническая документация API и компонентов |

### 🔵 История и патчи

| Документ | Описание |
|----------|----------|
| [PATCH_FIXES_OCT_21_2025.md](PATCH_FIXES_OCT_21_2025.md) | Исправления от 21 октября 2025 |
| [DEPLOYMENT_READY.txt](DEPLOYMENT_READY.txt) | Чеклист готовности к деплою |

### 🟡 Специализированные

| Документ | Описание |
|----------|----------|
| [SECURITY_LOGIC.md](SECURITY_LOGIC.md) | Логика безопасности и авторизации |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Инструкции по деплою |
| [CATEGORY_MAPPING_RESTORE.md](CATEGORY_MAPPING_RESTORE.md) | Восстановление маппинга категорий |
| [VK_USERNAME_AND_ADMIN_USERS_EXPLANATION.md](VK_USERNAME_AND_ADMIN_USERS_EXPLANATION.md) | Объяснение VK username логики |

### 📂 VK Live API

| Документ | Описание |
|----------|----------|
| [vk/Методы.Категории.md](vk/Методы.Категории.md) | API категорий VK Live |
| [vk/Методы.Канал.md](vk/Методы.Канал.md) | API канала VK Live |

---

## 🎯 Сценарии использования

### Я хочу запустить проект

1. [QUICK_START.md](QUICK_START.md) - Установка и запуск
2. [DEPLOYMENT.md](DEPLOYMENT.md) - Деплой на сервер

### Я хочу добавить новую фичу

1. ⚠️ **ОБЯЗАТЕЛЬНО:** [CURRENT_STATUS.md](CURRENT_STATUS.md) - Проверь что работает
2. ⚠️ **ОБЯЗАТЕЛЬНО:** [LLM_DEVELOPMENT_RULES.md](LLM_DEVELOPMENT_RULES.md) - Правила разработки
3. [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md) - Пойми архитектуру
4. [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) - Следуй паттернам

### Я хочу исправить баг

1. ⚠️ **ОБЯЗАТЕЛЬНО:** [CURRENT_STATUS.md](CURRENT_STATUS.md) - Убедись что это баг, а не фича
2. [QUICK_FIX_GUIDE.md](QUICK_FIX_GUIDE.md) - Типичные проблемы
3. [LLM_DEVELOPMENT_RULES.md](LLM_DEVELOPMENT_RULES.md) - Как правильно фиксить

### Я AI-агент, меня попросили что-то сделать

1. 🚨 **ЧИТАЙ ПЕРВЫМ:** [CURRENT_STATUS.md](CURRENT_STATUS.md)
2. 🚨 **ЧИТАЙ ВТОРЫМ:** [LLM_DEVELOPMENT_RULES.md](LLM_DEVELOPMENT_RULES.md)
3. Если что-то неясно: [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md)
4. Для примеров кода: [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)

**⚠️ НЕ НАЧИНАЙ РАБОТУ БЕЗ ПРОЧТЕНИЯ CURRENT_STATUS.md и LLM_DEVELOPMENT_RULES.md!**

---

## 🔍 Поиск информации

### Как работает авторизация?

- [SECURITY_LOGIC.md](SECURITY_LOGIC.md) - Логика безопасности
- [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md) - Раздел "Authentication Flow"

### Как работает TTS?

- [CURRENT_STATUS.md](CURRENT_STATUS.md) - Секция "TTS (Озвучка)"
- [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) - API endpoints

### Как работает ChatBox?

- [CURRENT_STATUS.md](CURRENT_STATUS.md) - Секция "ChatBox"
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) - Примеры WebSocket

### Как работает смена категорий?

- [CURRENT_STATUS.md](CURRENT_STATUS.md) - Секция "Управление стримом"
- [vk/Методы.Категории.md](vk/Методы.Категории.md) - VK API
- [CATEGORY_MAPPING_RESTORE.md](CATEGORY_MAPPING_RESTORE.md) - Маппинг

### VK Live API не работает?

- [vk/Методы.Канал.md](vk/Методы.Канал.md) - Документация API
- [VK_USERNAME_AND_ADMIN_USERS_EXPLANATION.md](VK_USERNAME_AND_ADMIN_USERS_EXPLANATION.md) - Объяснение логики

---

## 📊 Статус документации

| Документ | Актуальность | Статус |
|----------|--------------|--------|
| CURRENT_STATUS.md | 22.10.2025 | ✅ Актуально |
| LLM_DEVELOPMENT_RULES.md | 22.10.2025 | ✅ Актуально |
| QUICK_FIX_GUIDE.md | 21.10.2025 | ✅ Актуально |
| ARCHITECTURE_GUIDE.md | 20.10.2025 | ✅ Актуально |
| DEVELOPER_GUIDE.md | 20.10.2025 | ✅ Актуально |
| DEPLOYMENT_READY.txt | 21.10.2025 | 🟡 Частично устарел |
| PATCH_FIXES_OCT_21_2025.md | 21.10.2025 | ✅ Актуально |

---

## 🚀 Что нового?

### 22 октября 2025
- ✅ Добавлен **CURRENT_STATUS.md** - главный источник правды о состоянии проекта
- ✅ Обновлен **LLM_DEVELOPMENT_RULES.md** v3.0.0 - усилены правила для AI
- ✅ Обновлен **DOCUMENTATION_INDEX.md** - этот файл

### 21 октября 2025
- ✅ Критические фиксы TTS
- ✅ Обновлена база документации

---

## 🔄 Правила обновления документации

1. **При изменении кода:**
   - Обновляй [CURRENT_STATUS.md](CURRENT_STATUS.md) если меняется статус фичи
   - Обновляй дату в документе

2. **При добавлении фичи:**
   - Добавь в [CURRENT_STATUS.md](CURRENT_STATUS.md) → "✅ РАБОТАЮЩИЕ ФИЧИ"
   - Обнови [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) если нужно

3. **При обнаружении бага:**
   - Добавь в [CURRENT_STATUS.md](CURRENT_STATUS.md) → "❌ НЕ РАБОТАЕТ"
   - Опиши причину и план исправления

4. **При исправлении бага:**
   - Перемести из "❌ НЕ РАБОТАЕТ" в "✅ РАБОТАЮЩИЕ ФИЧИ"
   - Обнови дату

---

## 📞 Поддержка

Если не можешь найти информацию:

1. Проверь [CURRENT_STATUS.md](CURRENT_STATUS.md) - 90% вопросов там
2. Проверь [QUICK_FIX_GUIDE.md](QUICK_FIX_GUIDE.md) - частые проблемы
3. Читай логи:
   - Backend: `bot_service/bot_service.log`
   - Frontend: F12 → Console

---

**Версия индекса:** 2.0  
**Последнее обновление:** 22 октября 2025  
**Статус:** ✅ Актуально

