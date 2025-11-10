# 📘 План подготовки к миграции на TypeScript

**Дата:** 10 ноября 2025  
**Статус:** 📋 Подготовка

---

## 🎯 Цель

Подготовить проект к возможной миграции на TypeScript в будущем, улучшив типизацию через JSDoc и структуру кода.

---

## 📋 Этапы подготовки

### Этап 1: Улучшение JSDoc типизации (Текущий этап)

#### 1.1 Service Layer
- [x] Добавить JSDoc комментарии для всех методов сервисов
- [x] Указать типы параметров и возвращаемых значений
- [ ] Добавить примеры использования
- [ ] Добавить описание ошибок

#### 1.2 React Query Hooks
- [x] Добавить JSDoc комментарии для всех hooks
- [x] Указать типы параметров и возвращаемых значений
- [ ] Добавить примеры использования
- [ ] Описать варианты использования `options`

#### 1.3 Компоненты
- [ ] Добавить JSDoc для пропсов компонентов
- [ ] Указать типы состояний
- [ ] Описать события и callbacks
- [ ] Добавить примеры использования

#### 1.4 Утилиты и хелперы
- [ ] Добавить JSDoc для всех утилит
- [ ] Указать типы параметров и возвращаемых значений
- [ ] Описать побочные эффекты

### Этап 2: Структура типов

#### 2.1 Создание файлов с типами (JSDoc) ✅
- [x] `types/api.d.ts` - типы для API responses
- [x] `types/user.d.ts` - типы для пользователя
- [x] `types/tts.d.ts` - типы для TTS
- [x] `types/drops.d.ts` - типы для Drops
- [x] `types/youtube.d.ts` - типы для YouTube
- [x] `types/chat.d.ts` - типы для чата
- [x] `types/points.d.ts` - типы для наград за баллы
- [x] `types/commands.d.ts` - типы для команд

#### 2.2 Использование типов в JSDoc
- [ ] Импортировать типы в JSDoc комментариях
- [ ] Использовать `@typedef` для сложных типов
- [ ] Использовать `@template` для generic типов

### Этап 3: Конфигурация TypeScript ✅

#### 3.1 Установка TypeScript ✅
- [x] `npm install --save-dev typescript @types/react @types/react-dom`
- [x] `npm install --save-dev @types/node` (если необходимо)

#### 3.2 Настройка `tsconfig.json` ✅
- [x] Создать `tsconfig.json` с настройками для миграции
- [x] Настроить `allowJs: true` для постепенной миграции
- [x] Настроить `checkJs: true` для проверки JS файлов
- [x] Настроить пути (`paths`) для алиасов
- [x] Настроить строгость типизации

#### 3.3 Интеграция с ESLint ✅
- [x] Установить `@typescript-eslint/parser`
- [x] Установить `@typescript-eslint/eslint-plugin`
- [x] Настроить ESLint для TypeScript
- [x] Настроить правила типизации

### Этап 4: Постепенная миграция (будущее)

#### 4.1 Приоритетные файлы для миграции
1. **Service Layer** (`frontend/src/services/api/services/`)
   - [ ] `client.js` → `client.ts`
   - [ ] `ttsService.js` → `ttsService.ts`
   - [ ] `dropsService.js` → `dropsService.ts`
   - [ ] `youtubeService.js` → `youtubeService.ts`
   - [ ] `pointsService.js` → `pointsService.ts`
   - [ ] `commandsService.js` → `commandsService.ts`
   - [ ] `chatService.js` → `chatService.ts`
   - [ ] `chatboxService.js` → `chatboxService.ts`
   - [ ] `streamService.js` → `streamService.ts`
   - [ ] `authService.js` → `authService.ts`
   - [ ] `integrationsService.js` → `integrationsService.ts`

2. **React Query Hooks** (`frontend/src/queries/`)
   - [ ] `ttsQueries.js` → `ttsQueries.ts`
   - [ ] `dropsQueries.js` → `dropsQueries.ts`
   - [ ] `youtubeQueries.js` → `youtubeQueries.ts`
   - [ ] `pointsQueries.js` → `pointsQueries.ts`
   - [ ] `commandsQueries.js` → `commandsQueries.ts`
   - [ ] `queryKeys.js` → `queryKeys.ts`

3. **Компоненты** (`frontend/src/components/`)
   - [ ] Компоненты TTS
   - [ ] Компоненты Drops
   - [ ] Компоненты YouTube
   - [ ] Компоненты Points
   - [ ] Компоненты Commands
   - [ ] Компоненты ChatBox

4. **Контексты** (`frontend/src/context/`)
   - [ ] `AuthContext.jsx` → `AuthContext.tsx`
   - [ ] `DataContext.jsx` → `DataContext.tsx`
   - [ ] `ChatContext.jsx` → `ChatContext.tsx`
   - [ ] `PlayerContext.jsx` → `PlayerContext.tsx`
   - [ ] `IntegrationsContext.jsx` → `IntegrationsContext.tsx`
   - [ ] `TtsContext.jsx` → `TtsContext.tsx`

#### 4.2 Стратегия миграции
- [ ] Начать с Service Layer (самый простой, мало зависимостей)
- [ ] Затем мигрировать React Query hooks
- [ ] Затем мигрировать утилиты и хелперы
- [ ] Затем мигрировать компоненты
- [ ] В конце мигрировать контексты и страницы

#### 4.3 Проверка после миграции
- [ ] Проверить, что проект компилируется без ошибок
- [ ] Проверить, что нет ошибок типизации
- [ ] Проверить, что все функции работают корректно
- [ ] Проверить производительность

### Этап 5: Улучшение типизации (будущее)

#### 5.1 Строгая типизация
- [ ] Включить `strict: true` в `tsconfig.json`
- [ ] Исправить все ошибки типизации
- [ ] Добавить типы для всех функций
- [ ] Добавить типы для всех состояний

#### 5.2 Типизация API
- [ ] Создать типы для всех API responses
- [ ] Создать типы для всех API requests
- [ ] Использовать типы в сервисах
- [ ] Валидация типов на runtime (опционально, через Zod)

#### 5.3 Типизация компонентов
- [ ] Типизировать все пропсы компонентов
- [ ] Типизировать все состояния компонентов
- [ ] Типизировать все события
- [ ] Типизировать все callbacks

---

## 📝 Текущий прогресс

### ✅ Завершено

1. **Service Layer**
   - ✅ Созданы все сервисы с JSDoc комментариями
   - ✅ Указаны типы параметров и возвращаемых значений
   - ✅ Добавлены описания методов

2. **React Query Hooks**
   - ✅ Созданы все hooks с JSDoc комментариями
   - ✅ Указаны типы параметров и возвращаемых значений
   - ✅ Добавлены описания hooks

3. **Архитектура**
   - ✅ Единый API клиент
   - ✅ Централизованная обработка ошибок
   - ✅ Централизованные query keys
   - ✅ Оптимистичные обновления

### 🚧 В процессе

1. **JSDoc типизация**
   - 🚧 Улучшение JSDoc в компонентах
   - 🚧 Добавление примеров использования
   - 🚧 Описание ошибок

### 📋 Запланировано

1. **Типы (JSDoc)**
   - 📋 Создание файлов с типами
   - 📋 Использование типов в JSDoc
   - 📋 Документирование сложных типов

2. **TypeScript конфигурация**
   - 📋 Установка TypeScript
   - 📋 Настройка `tsconfig.json`
   - 📋 Интеграция с ESLint

3. **Миграция**
   - 📋 Миграция Service Layer
   - 📋 Миграция React Query hooks
   - 📋 Миграция компонентов
   - 📋 Миграция контекстов

---

## 🔧 Рекомендации

### Для текущего этапа (JSDoc)

1. **Использовать JSDoc везде**
   - Все функции должны иметь JSDoc комментарии
   - Все параметры должны быть документированы
   - Все возвращаемые значения должны быть документированы

2. **Использовать типы в JSDoc**
   - `@param {string} name` - для строк
   - `@param {number} age` - для чисел
   - `@param {Object} user` - для объектов
   - `@param {Array<string>} items` - для массивов
   - `@param {Promise<AxiosResponse>} response` - для промисов

3. **Использовать `@typedef` для сложных типов**
   ```javascript
   /**
    * @typedef {Object} User
    * @property {string} id - ID пользователя
    * @property {string} username - Имя пользователя
    * @property {string} email - Email пользователя
    */
   ```

4. **Использовать `@template` для generic типов**
   ```javascript
   /**
    * @template T
    * @param {T} value - Значение
    * @returns {T} - То же значение
    */
   ```

### Для будущей миграции на TypeScript

1. **Постепенная миграция**
   - Начать с простых файлов (сервисы, утилиты)
   - Затем перейти к более сложным (компоненты, контексты)
   - Использовать `allowJs: true` для смешанного кода

2. **Использовать существующие типы**
   - Использовать типы из `@types/react`
   - Использовать типы из `@types/node`
   - Создавать собственные типы только при необходимости

3. **Строгая типизация**
   - Включать `strict: true` постепенно
   - Исправлять ошибки типизации по мере их появления
   - Не игнорировать ошибки типизации (`@ts-ignore`)

4. **Тестирование**
   - Тестировать каждую мигрированную часть
   - Убедиться, что нет регрессий
   - Проверять производительность

---

## 📊 Метрики прогресса

- **Service Layer:** ✅ 100% (11/11 сервисов)
- **React Query Hooks:** ✅ 100% (40+ hooks)
- **JSDoc типизация:** 🚧 70% (улучшается)
- **Типы (JSDoc):** 📋 0% (запланировано)
- **TypeScript конфигурация:** 📋 0% (запланировано)
- **Миграция на TypeScript:** 📋 0% (запланировано)

---

## 🎯 Цели на ближайшее будущее

1. **Завершить JSDoc типизацию** (1-2 недели)
   - Улучшить JSDoc во всех компонентах
   - Добавить примеры использования
   - Создать файлы с типами (JSDoc)

2. **Подготовить TypeScript конфигурацию** (1 неделя)
   - Установить TypeScript
   - Настроить `tsconfig.json`
   - Интегрировать с ESLint

3. **Начать миграцию Service Layer** (2-3 недели)
   - Мигрировать все сервисы
   - Протестировать каждый сервис
   - Убедиться, что нет регрессий

---

## 📚 Полезные ресурсы

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [JSDoc Reference](https://jsdoc.app/)
- [TypeScript with React](https://react-typescript-cheatsheet.netlify.app/)
- [Migrating from JavaScript to TypeScript](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html)

---

**Дата создания:** 10 ноября 2025  
**Последнее обновление:** 10 ноября 2025

