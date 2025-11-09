# 🏗️ План рефакторинга архитектуры TTS_TTV_0.02

**Дата:** 10 ноября 2025  
**Статус:** 📋 План

---

## 🎯 Цель рефакторинга

Упростить архитектуру, улучшить поддерживаемость, повысить производительность и упростить тестирование.

---

## 📋 Фаза 1: Service Layer и API абстракция (Неделя 1)

### 1.1. Создать Service Layer

**Структура:**
```
frontend/src/services/
├── api/
│   ├── client.js          # Единый API клиент
│   ├── interceptors.js    # Interceptors для auth, errors, logging
│   └── types.js           # Типы для API responses
├── tts/
│   ├── ttsService.js      # TTS API calls
│   └── ttsTypes.js        # TTS types
├── youtube/
│   ├── youtubeService.js  # YouTube API calls
│   └── youtubeTypes.js    # YouTube types
├── drops/
│   ├── dropsService.js    # Drops API calls
│   └── dropsTypes.js      # Drops types
├── commands/
│   ├── commandsService.js # Commands API calls
│   └── commandsTypes.js   # Commands types
└── index.js               # Export all services
```

**Задачи:**
- [ ] Создать единый API клиент с конфигурацией
- [ ] Создать сервисы для каждого домена (TTS, YouTube, Drops, Commands)
- [ ] Инкапсулировать все API вызовы в сервисы
- [ ] Добавить типизацию (JSDoc/Zod)
- [ ] Централизованная обработка ошибок

**Пример:**
```javascript
// services/tts/ttsService.js
export const ttsService = {
  async getStatus(channelName = null) {
    return apiClient.get('/api/tts/status', { params: { channel_name: channelName } });
  },
  async enable() {
    return apiClient.post('/api/tts/enable');
  },
  async disable() {
    return apiClient.post('/api/tts/disable');
  },
  // ... другие методы
};
```

---

### 1.2. Унифицировать API клиенты

**Задачи:**
- [ ] Объединить `botService`, `api`, `adminApi`, `ttsService` в единый клиент
- [ ] Создать разные instances только при необходимости (разные baseURL)
- [ ] Единые interceptors для всех клиентов
- [ ] Единая обработка ошибок

**Пример:**
```javascript
// services/api/client.js
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Interceptors
apiClient.interceptors.request.use(authInterceptor);
apiClient.interceptors.response.use(
  response => response,
  errorHandler
);
```

---

## 📋 Фаза 2: React Query миграция (Неделя 2)

### 2.1. Создать централизованные queries

**Структура:**
```
frontend/src/queries/
├── queryKeys.js           # Централизованные query keys
├── tts/
│   ├── ttsQueries.js      # TTS queries
│   └── ttsMutations.js    # TTS mutations
├── youtube/
│   ├── youtubeQueries.js  # YouTube queries
│   └── youtubeMutations.js # YouTube mutations
├── drops/
│   ├── dropsQueries.js    # Drops queries
│   └── dropsMutations.js  # Drops mutations
└── index.js               # Export all queries
```

**Задачи:**
- [ ] Создать `queryKeys.js` с централизованными ключами
- [ ] Создать query factories для каждого домена
- [ ] Мигрировать все API вызовы на React Query
- [ ] Добавить optimistic updates где необходимо
- [ ] Настроить staleTime и gcTime

**Пример:**
```javascript
// queries/queryKeys.js
export const queryKeys = {
  tts: {
    all: ['tts'] as const,
    status: (channelName?: string) => ['tts', 'status', channelName] as const,
    settings: () => ['tts', 'settings'] as const,
  },
  youtube: {
    all: ['youtube'] as const,
    queue: () => ['youtube', 'queue'] as const,
  },
  // ... другие keys
};

// queries/tts/ttsQueries.js
export const useTtsStatus = (channelName?: string) => {
  return useQuery({
    queryKey: queryKeys.tts.status(channelName),
    queryFn: () => ttsService.getStatus(channelName),
    staleTime: 30 * 1000,
  });
};
```

---

### 2.2. Мигрировать контексты на React Query

**Задачи:**
- [ ] `AuthContext` - оставить только UI состояние, данные через React Query
- [ ] `ChatContext` - сообщения через React Query, только UI состояние в контексте
- [ ] `DataContext` - данные стрима через React Query
- [ ] `PlayerContext` - очередь через React Query, только UI состояние в контексте
- [ ] `TtsContext` - настройки через React Query, только UI состояние в контексте
- [ ] `IntegrationsContext` - интеграции через React Query
- [ ] `UserSettingsContext` - настройки через React Query

**Пример:**
```javascript
// context/ChatContext.jsx (упрощенный)
export const ChatProvider = ({ children }) => {
  // Только UI состояние
  const [isPaused, setIsPaused] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  
  // Серверное состояние через React Query
  const { data: messages } = useChatMessages();
  const { data: botStatus } = useBotStatus();
  
  // WebSocket через хук
  useSharedWebSocket(userId, handleMessage);
  
  const value = useMemo(() => ({
    messages: messages || [],
    isPaused,
    setIsPaused,
    scrollPosition,
    setScrollPosition,
    botStatus,
  }), [messages, isPaused, scrollPosition, botStatus]);
  
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
```

---

## 📋 Фаза 3: Упрощение контекстов (Неделя 3)

### 3.1. Объединить связанные контексты

**Задачи:**
- [ ] Объединить `TtsContext` + `TtsHealthContext` → `TtsContext`
- [ ] Объединить `AuthContext` + `IntegrationsContext` → `AuthContext` (интеграции как часть auth)
- [ ] Упростить `UserSettingsContext` - использовать React Query
- [ ] Убрать `DonationAlertsContext` - использовать React Query

**Результат:**
- Было: 9 контекстов
- Станет: 5 контекстов
  - `AuthContext` - аутентификация и интеграции
  - `ChatContext` - UI состояние чата
  - `PlayerContext` - UI состояние плеера
  - `TtsContext` - UI состояние TTS
  - `UserSettingsContext` - UI состояние настроек

---

### 3.2. Упростить зависимости

**Задачи:**
- [ ] Убрать зависимость `ChatContext` от `IntegrationsContext`
- [ ] Убрать зависимость `DataContext` от `IntegrationsContext`
- [ ] Использовать React Query для независимой загрузки данных
- [ ] Использовать события для синхронизации (если необходимо)

**Результат:**
```
AuthContext (независимый)
  ↓
ChatContext, PlayerContext, TtsContext, UserSettingsContext (независимые)
```

---

## 📋 Фаза 4: Обработка ошибок и валидация (Неделя 4)

### 4.1. Единый обработчик ошибок

**Задачи:**
- [ ] Создать `errorHandler.js` с централизованной обработкой
- [ ] Настроить interceptors для всех API клиентов
- [ ] Добавить error reporting (Sentry, LogRocket)
- [ ] Единый UI для отображения ошибок

**Пример:**
```javascript
// utils/errorHandler.js
export const errorHandler = (error) => {
  // Логирование
  logger.error('API Error:', error);
  
  // Error reporting
  if (window.Sentry) {
    window.Sentry.captureException(error);
  }
  
  // Обработка по типу ошибки
  if (error.response?.status === 401) {
    // Handle unauthorized
  } else if (error.response?.status === 403) {
    // Handle forbidden
  }
  
  // Возврат user-friendly сообщения
  return getErrorMessage(error);
};
```

---

### 4.2. Единая валидация

**Задачи:**
- [ ] Установить Zod для валидации
- [ ] Создать схемы валидации для всех форм
- [ ] Генерация типов из схем
- [ ] Единая валидация на фронте и бэке

**Пример:**
```javascript
// schemas/ttsSettingsSchema.js
import { z } from 'zod';

export const ttsSettingsSchema = z.object({
  enable7TV: z.boolean(),
  enableTwitch: z.boolean(),
  filterReplies: z.boolean(),
  filterMentions: z.boolean(),
  // ... другие поля
});
```

---

## 📋 Фаза 5: Оптимизация производительности (Неделя 5)

### 5.1. Оптимизация контекстов

**Задачи:**
- [ ] Разделить контексты на мелкие (по необходимости)
- [ ] Мемоизировать значения контекстов
- [ ] Использовать `useMemo` и `useCallback` везде
- [ ] Оптимизировать ре-рендеры

---

### 5.2. Виртуализация и code splitting

**Задачи:**
- [ ] Виртуализация больших списков (react-window)
- [ ] Code splitting для страниц (уже есть, улучшить)
- [ ] Lazy loading компонентов
- [ ] Оптимизация bundle size

---

## 📋 Фаза 6: Типизация и тестирование (Неделя 6)

### 6.1. Типизация

**Задачи:**
- [ ] Добавить JSDoc комментарии для типов
- [ ] Использовать Zod для runtime валидации
- [ ] Генерация типов из API схемы
- [ ] Постепенная миграция на TypeScript (опционально)

---

### 6.2. Тестирование

**Задачи:**
- [ ] Создать моки для API
- [ ] Написать unit тесты для сервисов
- [ ] Написать integration тесты для компонентов
- [ ] Настроить CI/CD для тестов

---

## 📊 Ожидаемые результаты

### До рефакторинга:
- ❌ 9 контекстов
- ❌ 176 прямых вызовов API
- ❌ Смешанные паттерны (Context API + React Query + ручной кэш)
- ❌ Сложные зависимости между контекстами
- ❌ Дублирование логики
- ❌ Нет единого обработчика ошибок

### После рефакторинга:
- ✅ 5 контекстов (только UI состояние)
- ✅ 0 прямых вызовов API (только через сервисы)
- ✅ Единый паттерн (React Query для серверного состояния)
- ✅ Независимые контексты
- ✅ Нет дублирования логики
- ✅ Единый обработчик ошибок
- ✅ Типизация (JSDoc/Zod)
- ✅ Тестируемость

---

## 🚀 Начало работы

### Шаг 1: Создать Service Layer
1. Создать `services/api/client.js`
2. Создать сервисы для каждого домена
3. Мигрировать API вызовы в сервисы

### Шаг 2: Мигрировать на React Query
1. Создать `queries/queryKeys.js`
2. Создать queries для каждого домена
3. Мигрировать контексты на React Query

### Шаг 3: Упростить контексты
1. Объединить связанные контексты
2. Упростить зависимости
3. Оставить только UI состояние

---

**Дата создания:** 10 ноября 2025  
**Статус:** 📋 План  
**Ориентировочное время:** 6 недель

