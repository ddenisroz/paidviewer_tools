# 📚 Документация проекта TTS_TTV

Централизованная документация для всех компонентов проекта.

---

## 📁 Структура документации

```
docs/
├── 📊 reports/          - Отчеты и чеклисты
├── 📖 guides/           - Руководства и инструкции
├── 🚀 deployment/       - Документы по развертыванию
├── ⚙️ setup/            - Гайды по настройке
└── 🔧 scripts/          - Утилитные скрипты
```

---

## 📊 Отчеты (`reports/`)

| Файл | Описание |
|------|----------|
| [`FINAL_CLEANUP_SUMMARY.md`](./reports/FINAL_CLEANUP_SUMMARY.md) | ⭐ **Финальный отчет по реорганизации** |
| [`PROJECT_REPORT.md`](./reports/PROJECT_REPORT.md) | Полный отчет о проекте |
| [`PROJECT_SUMMARY.md`](./reports/PROJECT_SUMMARY.md) | Краткое резюме проекта |
| [`TECHNICAL_REPORT.md`](./reports/TECHNICAL_REPORT.md) | Технический анализ |
| [`OPTIMIZATION_REPORT.md`](./reports/OPTIMIZATION_REPORT.md) | Отчет по оптимизации |
| [`CLEANUP_REPORT.md`](./reports/CLEANUP_REPORT.md) | Отчет по очистке проекта |
| [`PROJECT_REORGANIZATION_REPORT.md`](./reports/PROJECT_REORGANIZATION_REPORT.md) | Детальный отчет по реорганизации |
| [`TESTING_CHECKLIST.md`](./reports/TESTING_CHECKLIST.md) | Чеклист тестирования |
| [`PRODUCTION_CHECKLIST.md`](./reports/PRODUCTION_CHECKLIST.md) | Чеклист для продакшена |

---

## 📖 Руководства (`guides/`)

### 🛠️ Разработка
- [`DEVELOPER_GUIDE.md`](./guides/DEVELOPER_GUIDE.md) - Гайд для разработчиков
- [`CLEANUP_GUIDE.md`](./guides/CLEANUP_GUIDE.md) - Руководство по очистке проекта

### 🗄️ База данных
- [`DATABASE_MANAGEMENT_README.md`](./guides/DATABASE_MANAGEMENT_README.md) - Управление базой данных

### 📝 Системы
- [`LOGGING_AND_BACKUP_SYSTEM.md`](./guides/LOGGING_AND_BACKUP_SYSTEM.md) - Логирование и бэкапы
- [`WORD_FILTER_SYSTEM.md`](./guides/WORD_FILTER_SYSTEM.md) - Система фильтрации слов
- [`PSYCHOLOGY_ANALYSIS_README.md`](./guides/PSYCHOLOGY_ANALYSIS_README.md) - Психологический анализ

### 🎮 Платформы
- [`VK_LIVE_COMMANDS_GUIDE.md`](./guides/VK_LIVE_COMMANDS_GUIDE.md) - Команды для VK Live
- [`EMOTE_SETTINGS.md`](./guides/EMOTE_SETTINGS.md) - Настройка эмоций

---

## 🚀 Развертывание (`deployment/`)

| Файл | Описание |
|------|----------|
| [`DEPLOYMENT.md`](./deployment/DEPLOYMENT.md) | Инструкция по развертыванию |
| [`DEVELOPMENT.md`](./deployment/DEVELOPMENT.md) | Настройка среды разработки |

---

## ⚙️ Настройка (`setup/`)

| Файл | Описание |
|------|----------|
| [`QUICK_SETUP_GUIDE.md`](./setup/QUICK_SETUP_GUIDE.md) | Быстрая настройка проекта |
| [`AI_SETUP_GUIDE.md`](./setup/AI_SETUP_GUIDE.md) | Настройка AI компонентов |
| [`HUGGINGFACE_TOKEN_GUIDE.md`](./setup/HUGGINGFACE_TOKEN_GUIDE.md) | Получение токена HuggingFace |
| [`QUICK_COMMANDS.md`](./setup/QUICK_COMMANDS.md) | Список быстрых команд |

---

## 🔧 Утилитные скрипты (`scripts/`)

### Python скрипты
- **`cleanup_project.py`** - Автоматическая очистка проекта
  ```bash
  # Просмотр без удаления
  python docs/scripts/cleanup_project.py --dry-run
  
  # Полная очистка
  python docs/scripts/cleanup_project.py
  ```

- **`monitoring_viewer.py`** - Просмотр мониторинга
  ```bash
  python docs/scripts/monitoring_viewer.py
  ```

### Bash скрипты
- **`deploy.sh`** - Развертывание на сервере
- **`dev-setup.sh`** - Настройка окружения разработки
- **`update.sh`** - Обновление проекта
- **`setup-cloudflare-tunnel.sh`** - Настройка Cloudflare Tunnel

---

## 🎯 Быстрый старт

### Для начала работы:
1. **Первая настройка**: [`setup/QUICK_SETUP_GUIDE.md`](./setup/QUICK_SETUP_GUIDE.md)
2. **Разработка**: [`deployment/DEVELOPMENT.md`](./deployment/DEVELOPMENT.md)
3. **Команды**: [`setup/QUICK_COMMANDS.md`](./setup/QUICK_COMMANDS.md)

### Для разработчиков:
1. **Developer Guide**: [`guides/DEVELOPER_GUIDE.md`](./guides/DEVELOPER_GUIDE.md)
2. **База данных**: [`guides/DATABASE_MANAGEMENT_README.md`](./guides/DATABASE_MANAGEMENT_README.md)
3. **Оптимизация**: [`reports/OPTIMIZATION_REPORT.md`](./reports/OPTIMIZATION_REPORT.md)

### Для деплоя:
1. **Deployment**: [`deployment/DEPLOYMENT.md`](./deployment/DEPLOYMENT.md)
2. **Production Checklist**: [`reports/PRODUCTION_CHECKLIST.md`](./reports/PRODUCTION_CHECKLIST.md)

---

## 🔍 Поиск документации

| Если нужно... | Смотри... |
|---------------|-----------|
| 🚀 Быстро запустить проект | [`setup/QUICK_SETUP_GUIDE.md`](./setup/QUICK_SETUP_GUIDE.md) |
| 🛠️ Настроить окружение разработки | [`deployment/DEVELOPMENT.md`](./deployment/DEVELOPMENT.md) |
| 🗄️ Работать с базой данных | [`guides/DATABASE_MANAGEMENT_README.md`](./guides/DATABASE_MANAGEMENT_README.md) |
| 🎤 Настроить TTS | [`setup/AI_SETUP_GUIDE.md`](./setup/AI_SETUP_GUIDE.md) |
| 📺 Настроить VK Live | [`guides/VK_LIVE_COMMANDS_GUIDE.md`](./guides/VK_LIVE_COMMANDS_GUIDE.md) |
| 🧹 Очистить проект | [`guides/CLEANUP_GUIDE.md`](./guides/CLEANUP_GUIDE.md) |
| 📊 Узнать о проекте | [`reports/PROJECT_SUMMARY.md`](./reports/PROJECT_SUMMARY.md) |
| 🐛 Протестировать проект | [`reports/TESTING_CHECKLIST.md`](./reports/TESTING_CHECKLIST.md) |
| 🚢 Задеплоить на прод | [`deployment/DEPLOYMENT.md`](./deployment/DEPLOYMENT.md) |

---

## 📝 Обновление документации

При добавлении новой документации:
1. Размести файл в соответствующую папку
2. Обнови этот `README.md`
3. Добавь ссылку в таблицу поиска
4. Проверь все внутренние ссылки

---

## 💡 Принципы организации

### ✅ Правильно:
- Отчеты → `reports/`
- Руководства → `guides/`
- Deployment → `deployment/`
- Setup → `setup/`
- Скрипты → `scripts/`

### ❌ Неправильно:
- ~~Документы в корне проекта~~
- ~~Множественные README~~
- ~~Смешанная структура~~

---

## 🔄 История изменений

### v2.0 (Октябрь 2025)
- ✅ Централизована вся документация в `docs/`
- ✅ Создана логическая структура папок
- ✅ Добавлены навигационные ссылки
- ✅ Перемещены все отчеты и гайды
- ✅ Организованы утилитные скрипты

### v1.0 (До реорганизации)
- ❌ Документы в корне проекта
- ❌ Неструктурированная организация

---

**📧 Вопросы?** Загляни в [`guides/DEVELOPER_GUIDE.md`](./guides/DEVELOPER_GUIDE.md) или [`setup/QUICK_SETUP_GUIDE.md`](./setup/QUICK_SETUP_GUIDE.md)

