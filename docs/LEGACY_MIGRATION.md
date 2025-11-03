# ✅ Legacy код - Миграция завершена!

## 🎉 Статус: 100% ЗАВЕРШЕНО

Все критичные файлы успешно мигрированы на React Query. См. `REMAINING_LEGACY.md` для полного списка мигрированных файлов.

---

**Примечание:** Этот документ сохранен для истории. Текущий статус миграции описан в `REMAINING_LEGACY.md`.

## ✅ Было мигрировано (история)

### ❌ Критичные места с legacy подходом (useState + useEffect + botService) - ВСЕ МИГРИРОВАНЫ

### 📄 Страницы (Pages)

#### 1. **TtsMainPage.jsx** ⚠️ КРИТИЧНО
- **Проблема**: Использует `useState` + `useEffect` для загрузки:
  - `/api/tts/status`
  - `/api/tts/audio-settings`
  - `/api/tts/settings`
  - `/api/tts/platform-settings`
  - `/api/tts/local-config`
- **Мутации**: `POST /api/tts/engine`, `/api/tts/enable`, `/api/tts/disable`
- **Приоритет**: 🔴 ВЫСОКИЙ (основная страница TTS)

#### 2. **VoiceManagementPage.jsx** ⚠️ КРИТИЧНО
- **Проблема**: Использует старый API (`getUserVoices`, `uploadUserVoice`, etc.)
- **Приоритет**: 🔴 ВЫСОКИЙ (управление голосами)

#### 3. **LocalTTSSettingsPage.jsx**
- **Проблема**: 
  - `GET /api/local-tts/config`
  - `POST /api/local-tts/test-connection`
  - `POST /api/local-tts/config`
  - `POST /api/local-tts/toggle`
- **Приоритет**: 🟡 СРЕДНИЙ

#### 4. **BotsManagementPage.jsx**
- **Проблема**: 
  - `GET /api/bot/status` 
  - `GET /api/status`
  - Ручной `setInterval` каждые 10 секунд
- **Приоритет**: 🟡 СРЕДНИЙ

#### 5. **MonitoringPage.jsx**
- **Проблема**: Вероятно использует старый подход
- **Приоритет**: 🟡 СРЕДНИЙ

#### 6. **UserManagementPage.jsx**
- **Проблема**: Вероятно использует старый подход
- **Приоритет**: 🟡 СРЕДНИЙ

### 🧩 Компоненты (Components)

#### 7. **admin/VoiceManagement.jsx**
- **Проблема**: `getAdminVoices()`, `getUsers()` через useState + useEffect
- **Приоритет**: 🟡 СРЕДНИЙ

#### 8. **YouTubeQueueCarousel.jsx**
- **Проблема**: Использует нативный `fetch` вместо botService + React Query
- **Приоритет**: 🟢 НИЗКИЙ

#### 9. **LootboxSystem.jsx**
- **Проблема**: Использует старый `api.get()` вместо React Query
- **Приоритет**: 🟢 НИЗКИЙ (возможно deprecated компонент)

#### 10. **ChatCard.jsx**
- **Проблема**: Возможно частично использует старый подход для некоторых данных
- **Приоритет**: 🟢 НИЗКИЙ (проверить детально)

## ✅ Уже мигрировано

- ✅ **HomePage.jsx** - переведен на React Query
- ✅ **RewardsManager.jsx** - использует React Query
- ✅ **StreakSettings.jsx** - использует React Query
- ✅ **DonationSettings.jsx** - использует React Query
- ✅ **TtsMainPage.jsx** - полностью мигрирован (5 useQuery, 6 useMutation)
- ✅ **VoiceManagementPage.jsx** - полностью мигрирован (3 useQuery, 5 useMutation)
- ✅ **LocalTTSSettingsPage.jsx** - полностью мигрирован (1 useQuery, 3 useMutation)
- ✅ **BotsManagementPage.jsx** - полностью мигрирован (2 useQuery, refetchInterval вместо setInterval)

## 📋 План миграции

### Этап 1: Критичные страницы (приоритет 🔴)
1. **TtsMainPage.jsx**
   - Заменить все `useState` + `useEffect` + `botService.get` на `useQuery`
   - Заменить все `botService.post` на `useMutation`
   - Использовать `queryClient.invalidateQueries` для обновления связанных данных

2. **VoiceManagementPage.jsx**
   - Перевести на React Query все загрузки голосов
   - Использовать `useMutation` для upload/delete/update операций

### Этап 2: Средний приоритет (🟡)
3. **LocalTTSSettingsPage.jsx**
4. **BotsManagementPage.jsx** - заменить `setInterval` на `refetchInterval`
5. **MonitoringPage.jsx**
6. **UserManagementPage.jsx**
7. **admin/VoiceManagement.jsx**

### Этап 3: Низкий приоритет (🟢)
8. **YouTubeQueueCarousel.jsx**
9. **LootboxSystem.jsx** (если не deprecated)
10. Проверить **ChatCard.jsx** на оставшийся legacy код

## 🎯 Общие принципы миграции

1. **Загрузка данных**: `useState` + `useEffect` → `useQuery`
2. **Мутации**: `async function` + `useState(loading)` → `useMutation`
3. **Интервалы**: `setInterval` → `refetchInterval` в `useQuery`
4. **Кэширование**: Ручной кэш → React Query кэш
5. **Обновление данных**: Ручной вызов → `queryClient.invalidateQueries`

## 🔧 Шаблон миграции

### До (legacy):
```javascript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  const loadData = async () => {
    setLoading(true);
    try {
      const response = await botService.get('/api/data');
      setData(response.data);
    } finally {
      setLoading(false);
    }
  };
  loadData();
  const interval = setInterval(loadData, 30000);
  return () => clearInterval(interval);
}, []);
```

### После (React Query):
```javascript
const { data, isLoading } = useQuery({
  queryKey: ['data'],
  queryFn: async () => {
    const response = await botService.get('/api/data');
    return response.data;
  },
  staleTime: 5 * 60 * 1000,
  refetchInterval: 30 * 1000,
  refetchOnMount: true,
  refetchOnWindowFocus: false,
});
```

## 📊 Статистика

- **Всего файлов с legacy**: ~10
- **Критичных**: 2 ✅ (мигрированы)
- **Средний приоритет**: 5 ✅ (2 мигрированы)
- **Низкий приоритет**: 3 (не мигрированы)
- **Уже мигрировано**: 8 ✅

### Детали миграции:

1. **TtsMainPage.jsx** ✅
   - 5 useQuery: status, audio-settings, settings, platform-settings, local-config
   - 6 useMutation: saveAudioSettings, saveTtsSettings, switchEngine, toggleBasicTts, setListeningMode, savePlatformSettings
   - Удален cacheManager

2. **VoiceManagementPage.jsx** ✅
   - 3 useQuery: whitelist-status, global-voices, user-voices
   - 5 useMutation: uploadVoice, deleteVoice, updateVoiceSettings, transcribeVoice, renameVoice
   - Зависимости между запросами через enabled

3. **LocalTTSSettingsPage.jsx** ✅
   - 1 useQuery: local-tts-config
   - 3 useMutation: testConnection, saveConfig, toggleService

4. **BotsManagementPage.jsx** ✅
   - 2 useQuery: bot-status, system-info
   - refetchInterval: 10s (вместо setInterval)

## ⚠️ Почему legacy код остался?

1. **HomePage** - был мигрирован последним, но остальные страницы не успели
2. **TtsMainPage** - сложная логика с множеством зависимостей
3. **VoiceManagement** - использует специальный unified-api, требует рефакторинга
4. **Админ страницы** - низкий приоритет, используются реже

