# API Client Migration Guide

## 📋 Overview

Новый `apiClient.js` заменяет старые разрозненные способы вызова API.

**До:** 4 разных способа делать API запросы
**После:** 1 унифицированный `api` client

---

## 🎯 Benefits

### 1. **Automatic Retry**
```javascript
// Автоматически retry при 500/502/503/504/429
// Exponential backoff: 1s → 2s → 4s
const data = await api.get('/api/tts/status');
```

### 2. **Centralized Error Handling**
```javascript
// Автоматические toast для ошибок
// Автоматический redirect на /login при 401
// Форматирование ошибок из StandardResponse
```

### 3. **Request Logging**
```javascript
// Логи в консоли (только dev):
// [1] → GET /api/tts/status
// [1] ← 200 (145ms) {success: true, data: {...}}
```

### 4. **TypeScript-Ready**
```typescript
// Готов к типизации:
const data: TtsStatus = await api.get<TtsStatus>('/api/tts/status');
```

---

## 🔄 Migration Examples

### Example 1: Simple GET

**Before:**
```javascript
// ❌ Старый способ
import axios from 'axios';
import { API_BASE_URL } from '../constants';

const response = await axios.get(`${API_BASE_URL}/api/tts/status`);
const data = response.data;
```

**After:**
```javascript
// ✅ Новый способ
import api from '../services/apiClient';

const data = await api.get('/api/tts/status');
// Уже data, не response.data!
```

---

### Example 2: POST with Error Handling

**Before:**
```javascript
// ❌ Старый способ
try {
  const response = await axios.post(`${API_BASE_URL}/api/tts/enable`, {
    engine: 'gtts'
  });
  
  if (response.data.success) {
    toast.success('TTS включен');
  }
} catch (error) {
  if (error.response?.status === 401) {
    window.location.href = '/login';
  } else {
    toast.error(error.response?.data?.message || 'Ошибка');
  }
}
```

**After:**
```javascript
// ✅ Новый способ
try {
  const data = await api.post('/api/tts/enable', { engine: 'gtts' });
  
  if (data.success) {
    toast.success('TTS включен');
  }
} catch (error) {
  // Всё уже обработано!
  // 401 → автоматический redirect
  // Другие ошибки → автоматический toast
  // error уже форматирован: { message, code, status }
}
```

---

### Example 3: Skip Auto-Toast

**Before:**
```javascript
// ❌ Старый способ
try {
  const response = await axios.get(`${API_BASE_URL}/api/tts/status`);
  return response.data;
} catch (error) {
  // Не показываем toast, обрабатываем сами
  return { enabled: false };
}
```

**After:**
```javascript
// ✅ Новый способ
try {
  return await api.get('/api/tts/status', {
    skipToast: true  // Не показывать автоматический toast
  });
} catch (error) {
  // Обрабатываем сами
  return { enabled: false };
}
```

---

### Example 4: Disable Retry

**Before:**
```javascript
// ❌ Старый способ
// Нет возможности отключить retry
```

**After:**
```javascript
// ✅ Новый способ
const data = await api.post('/api/tts/test', null, {
  skipRetry: true  // Не retry при ошибке
});
```

---

### Example 5: AbortController (Cancel Request)

**Before:**
```javascript
// ❌ Старый способ
const source = axios.CancelToken.source();

axios.get(`${API_BASE_URL}/api/search`, {
  cancelToken: source.token
});

// Cancel
source.cancel('Operation canceled');
```

**After:**
```javascript
// ✅ Новый способ
const controller = new AbortController();

api.get('/api/search', {
  signal: controller.signal
});

// Cancel
controller.abort();
```

---

### Example 6: Admin API

**Before:**
```javascript
// ❌ Старый способ
import { adminApi } from '../services/api';

const response = await adminApi.get('/api/admin/users');
const data = response.data;
```

**After:**
```javascript
// ✅ Новый способ
import { adminApi } from '../services/apiClient';

const data = await adminApi.get('/api/admin/users');
// Те же фичи: retry, logging, error handling
```

---

## 📦 API Reference

### Methods

```javascript
// GET
api.get(url, config?)

// POST
api.post(url, data?, config?)

// PUT
api.put(url, data?, config?)

// PATCH
api.patch(url, data?, config?)

// DELETE
api.delete(url, config?)
```

### Config Options

```javascript
{
  // Axios options
  params: { key: 'value' },      // Query params
  headers: { 'X-Custom': 'val' }, // Custom headers
  signal: controller.signal,      // AbortController
  timeout: 5000,                  // Request timeout
  
  // ApiClient options
  skipToast: true,                // Не показывать toast при ошибке
  skipRetry: true,                // Не retry при ошибке
  skipAuthRedirect: true,         // Не redirect на /login при 401
}
```

### Error Format

```typescript
interface ApiError {
  message: string;        // "Не удалось включить TTS"
  code: string;           // "TTS_ENABLE_FAILED"
  status: number;         // 400
  details?: any;          // Дополнительные детали
}
```

---

## 🔧 Migration Checklist

### Phase 1: New Code (Immediate)
- [ ] Все новые API вызовы используют `apiClient`
- [ ] Импорт: `import api from '@/services/apiClient'`

### Phase 2: Refactor High-Priority (Week 1-2)
- [ ] TTS API calls
- [ ] Auth API calls
- [ ] Commands API calls
- [ ] User Settings API calls

### Phase 3: Refactor Medium-Priority (Week 3-4)
- [ ] Media/YouTube API calls
- [ ] Drops API calls
- [ ] Admin API calls

### Phase 4: Cleanup (Week 5)
- [ ] Remove old `services/api.js`
- [ ] Remove direct `axios` imports
- [ ] Update all imports to `apiClient`

---

## ⚠️ Breaking Changes

### 1. Response Format
**Before:** `response.data`  
**After:** Возвращается сразу `data`

```javascript
// ❌ Старый код
const response = await axios.get('/api/tts/status');
const enabled = response.data.enabled;

// ✅ Новый код
const data = await api.get('/api/tts/status');
const enabled = data.enabled;
```

### 2. Error Format
**Before:** `error.response.data`  
**After:** `error` (уже форматирован)

```javascript
// ❌ Старый код
catch (error) {
  const message = error.response?.data?.message;
}

// ✅ Новый код
catch (error) {
  const message = error.message;
}
```

---

## 🎓 Best Practices

### 1. Use Try-Catch for Error Handling
```javascript
// ✅ Хорошо
try {
  const data = await api.get('/api/tts/status');
  // Handle success
} catch (error) {
  // Handle error (если нужна custom логика)
}
```

### 2. Skip Toast for Silent Errors
```javascript
// ✅ Хорошо - для polling/background requests
const checkStatus = async () => {
  try {
    return await api.get('/api/bot/status', { skipToast: true });
  } catch {
    return { status: 'offline' };
  }
};
```

### 3. Use AbortController for Cleanup
```javascript
// ✅ Хорошо - в useEffect
useEffect(() => {
  const controller = new AbortController();
  
  api.get('/api/data', { signal: controller.signal })
    .then(setData);
  
  return () => controller.abort();  // Cleanup
}, []);
```

---

## 📊 Migration Progress

| Module | Status | Files Changed |
|--------|--------|---------------|
| **apiClient** | ✅ Done | 1 new |
| TTS Pages | ⏳ TODO | ~10 files |
| Auth Pages | ⏳ TODO | ~5 files |
| Commands | ⏳ TODO | ~3 files |
| Media/YouTube | ⏳ TODO | ~8 files |
| Admin Pages | ⏳ TODO | ~6 files |
| Contexts | ⏳ TODO | ~5 files |

**Total:** ~40 files to migrate

---

## 🤝 Need Help?

See `frontend/src/services/apiClient.js` for implementation details.

Example usage in tests (TODO).

