# 📚 Документация TTS_TTV_0.02

**Обновлено:** 22 октября 2025

---

## 🚨 НАЧНИ ОТСЮДА!

### Для AI-агентов (Claude, GPT, и т.д.):

1. **ОБЯЗАТЕЛЬНО ЧИТАЙ ПЕРВЫМ:** [CURRENT_STATUS.md](CURRENT_STATUS.md)  
   ✅ Что работает | ❌ Что сломано | ⛔ Что НЕ ТРОГАТЬ

2. **ОБЯЗАТЕЛЬНО ЧИТАЙ ВТОРЫМ:** [LLM_DEVELOPMENT_RULES.md](LLM_DEVELOPMENT_RULES.md)  
   🚨 Критические правила чтобы НЕ ЛОМАТЬ рабочие фичи

3. Полный список: [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)

### Для людей-разработчиков:

1. **Быстрый старт:** [QUICK_START.md](QUICK_START.md)
2. **Архитектура:** [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md)
3. **Разработка:** [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
4. **Текущий статус:** [CURRENT_STATUS.md](CURRENT_STATUS.md)

---

## 📊 Текущий статус проекта

### ✅ Работает:
- Авторизация (Twitch + VK Live)
- Смена названия стрима
- Смена категории стрима (раздельный режим)
- ChatBox (отображение сообщений)
- TTS базовая озвучка
- TTS shortcuts (кнопки на главной)

### ❌ Баги:
- Смена категории в объединенном режиме
- Сохранение истории Twitch чата (backend не перезапущен!)
- Позиционирование контекстного меню

### 🔧 В разработке:
- Кнопка "Настройка" в ChatBox (редактор стилей + экспорт в OBS)

**Детали:** [CURRENT_STATUS.md](CURRENT_STATUS.md)

---

## ⚠️ ВАЖНО ДЛЯ AI-АГЕНТОВ

**НЕ НАЧИНАЙ РАБОТУ** без прочтения:
- [CURRENT_STATUS.md](CURRENT_STATUS.md)
- [LLM_DEVELOPMENT_RULES.md](LLM_DEVELOPMENT_RULES.md)

**НЕ ТРОГАЙ рабочие фичи!**  
Лучше не исправить баг, чем сломать 5 работающих фич.

---

## 📁 Структура документации

```
docs/
├── README.md                          ← ты здесь
├── DOCUMENTATION_INDEX.md             ← полный индекс
├── CURRENT_STATUS.md                  ← что работает/не работает
├── LLM_DEVELOPMENT_RULES.md           ← правила для AI
├── QUICK_START.md                     ← быстрый старт
├── ARCHITECTURE_GUIDE.md              ← архитектура
├── DEVELOPER_GUIDE.md                 ← гайд разработчика
├── QUICK_FIX_GUIDE.md                 ← частые проблемы
├── DEPLOYMENT.md                      ← деплой
├── SECURITY_LOGIC.md                  ← безопасность
└── vk/                                ← VK Live API docs
    ├── Методы.Категории.md
    └── Методы.Канал.md
```

---

## 🔍 Быстрый поиск

| Вопрос | Документ |
|--------|----------|
| Что работает/не работает? | [CURRENT_STATUS.md](CURRENT_STATUS.md) |
| Как не сломать код? | [LLM_DEVELOPMENT_RULES.md](LLM_DEVELOPMENT_RULES.md) |
| Как запустить проект? | [QUICK_START.md](QUICK_START.md) |
| Как устроен проект? | [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md) |
| Как разрабатывать? | [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) |
| Типичные баги? | [QUICK_FIX_GUIDE.md](QUICK_FIX_GUIDE.md) |
| VK Live API? | [vk/Методы.*.md](vk/) |
| Полный список? | [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) |

---

## 📞 Поддержка

**Проблемы?**

1. Проверь [CURRENT_STATUS.md](CURRENT_STATUS.md)
2. Проверь [QUICK_FIX_GUIDE.md](QUICK_FIX_GUIDE.md)
3. Читай логи:
   - Backend: `bot_service/bot_service.log`
   - Frontend: F12 → Console

---

**Версия:** 2.0 | **Статус:** ✅ Актуально | **Дата:** 22.10.2025

