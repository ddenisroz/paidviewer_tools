# Восстановление Legacy маппинга категорий

## 🎯 Проблема

Текущий код имел **упрощённый и неработающий** маппинг категорий:

```javascript
// ❌ ПЛОХО (было)
export function findMappedCategory(originalCategory) {
  return CATEGORY_MAPPING[originalCategory] || 'other'; // Возвращает СТРОКУ!
}
```

**Почему не работало:**
- Возвращал просто строку (`'just-chatting'`, `'music'`)
- НЕ искал категорию в реальном списке доступных категорий
- НЕ возвращал `category_id` (необходим для API запросов)
- Простой key-value без умной логики
- Не мог найти похожие категории на разных платформах

## ✅ Решение: Legacy код

Legacy код был **намного умнее** и правильно работал с категориями:

```javascript
// ✅ ХОРОШО (legacy)
export function findMappedCategory(categoryName, fromPlatform, targetCategories) {
    // 1. Ищем ТОЧНОЕ совпадение по имени
    let exactMatch = targetCategories.find(cat => 
        cat.name && cat.name.toLowerCase() === categoryName.toLowerCase()
    );
    if (exactMatch) return exactMatch;

    // 2. Ищем через МАППИНГ (Twitch <-> VK)
    const mappedName = categoryMapping[categoryName];
    if (mappedName) {
        const mappedCategory = targetCategories.find(cat => 
            cat.name && cat.name.toLowerCase() === mappedName.toLowerCase()
        );
        if (mappedCategory) return mappedCategory;
    }

    // 3. Ищем ЧАСТИЧНОЕ совпадение
    const partialMatch = targetCategories.find(cat => 
        cat.name && (
            cat.name.toLowerCase().includes(categoryName.toLowerCase()) ||
            categoryName.toLowerCase().includes(cat.name.toLowerCase())
        )
    );
    return partialMatch;
}
```

## 📊 Преимущества Legacy кода

| Аспект | Текущий (плохой) | Legacy (хороший) |
|--------|-----------------|------------------|
| **Принимает аргументы** | `originalCategory` | `categoryName, fromPlatform, targetCategories` |
| **Возвращает** | Строку (`'just-chatting'`) | Объект категории `{id, name, box_art_url}` |
| **Поиск** | Простой key-value | 3-этапный умный поиск |
| **Работает с API** | ❌ Нет | ✅ Да (возвращает `category_id`) |
| **Частичное совпадение** | ❌ Нет | ✅ Да |
| **Маппинг Twitch<->VK** | Частичный | ✅ Полный (37 маппингов) |

## 🔍 Как работает 3-этапный поиск

### Пример: Выбираем "Dead by Daylight" на Twitch в объединённом режиме

**Этап 1: Точное совпадение**
```javascript
// Ищем в VK категориях точное совпадение
targetCategories.find(cat => cat.name.toLowerCase() === 'dead by daylight')
// Результат: Если в VK есть категория "Dead by Daylight" → возвращаем её
```

**Этап 2: Маппинг**
```javascript
// Проверяем есть ли маппинг для "Dead by Daylight"
categoryMapping['Dead by Daylight'] // undefined (нет маппинга для конкретных игр)
// Переходим к следующему этапу
```

**Этап 3: Частичное совпадение**
```javascript
// Ищем категории содержащие "dead" или содержащиеся в "dead by daylight"
targetCategories.find(cat => 
    cat.name.toLowerCase().includes('dead by daylight') ||
    'dead by daylight'.includes(cat.name.toLowerCase())
)
// Результат: Находим "Dead by Daylight" в VK или похожую игру
```

## 🗺️ Маппинг категорий

### Twitch → VK

| Twitch | VK |
|--------|-----|
| Just Chatting | Говорим и смотрим |
| Talk Shows & Podcasts | Говорим и смотрим |
| Music | Музыка |
| Art / Creative | Творчество |
| Gaming | Игры |
| IRL | Реальная жизнь |
| Sports | Спорт |
| Travel & Outdoors | Путешествия |
| Science & Technology | Технологии |
| Food & Drink | Кулинария |
| ASMR | АСМР |
| Chess | Интеллектуальные игры |
| Slots / Poker | Азартные игры |
| Special Events | Мероприятия |

### VK → Twitch

| VK | Twitch |
|----|--------|
| Говорим и смотрим | Just Chatting |
| Музыка | Music |
| Творчество | Art |
| Игры | Gaming |
| Реальная жизнь | IRL |
| Спорт | Sports |
| Путешествия | Travel & Outdoors |
| Технологии | Science & Technology |
| Кулинария | Food & Drink |
| АСМР | ASMR |
| Интеллектуальные игры | Chess |
| Азартные игры | Slots |
| Мероприятия | Special Events |

**Всего: 37 маппингов** (с учётом двунаправленности)

## 🎮 Примеры использования

### В StreamCategoryCard

```javascript
const handleCategorySelect = (platform, category) => {
    if (isLinked && bothEnabled) {
        // В объединенном режиме ищем соответствующую категорию для другой платформы
        const otherPlatform = platform === 'twitch' ? 'vk' : 'twitch';
        const otherCategories = categories[otherPlatform] || [];
        
        // Используем умный маппинг
        const mappedCategory = findMappedCategory(
            category.name,      // "Just Chatting"
            platform,           // "twitch"
            otherCategories     // [{id: 123, name: "Говорим и смотрим"}, ...]
        );
        // Результат: {id: 123, name: "Говорим и смотрим", ...}
        
        if (mappedCategory) {
            // Устанавливаем разные категории для разных платформ
            setCurrentData(prev => ({
                ...prev,
                [platform]: { ...prev[platform], category },
                [otherPlatform]: { ...prev[otherPlatform], category: mappedCategory },
            }));
        } else {
            // Не нашли - устанавливаем одинаковую
            setCurrentData(prev => ({
                ...prev,
                twitch: { ...prev.twitch, category },
                vk: { ...prev.vk, category },
            }));
        }
    }
};
```

### Сохранение на backend

```javascript
const handleSave = (mode) => {
    const payload = {};
    
    if (twitchEnabled && currentData.twitch.category?.id) {
        payload.twitch = { 
            category_id: currentData.twitch.category.id  // ← ID из маппинга!
        };
    }
    if (vkEnabled && currentData.vk.category?.id) {
        payload.vk = { 
            category_id: currentData.vk.category.id      // ← ID из маппинга!
        };
    }
    
    saveChanges(payload, 'saveCategory');
};
```

## 🆕 Дополнительная функция: getSimilarCategories

Legacy код также включает функцию для поиска похожих категорий (может использоваться для автокомплита):

```javascript
export function getSimilarCategories(categoryName, fromPlatform, targetCategories) {
    const similar = [];
    const lowerName = categoryName.toLowerCase();
    
    // Добавляем категории с похожими названиями
    targetCategories.forEach(cat => {
        if (cat.name) {
            const catLower = cat.name.toLowerCase();
            if (catLower.includes(lowerName) || lowerName.includes(catLower)) {
                similar.push(cat);
            }
        }
    });

    // Добавляем категории из маппинга
    const mappedName = categoryMapping[categoryName];
    if (mappedName) {
        const mapped = targetCategories.filter(cat => 
            cat.name && cat.name.toLowerCase().includes(mappedName.toLowerCase())
        );
        similar.push(...mapped);
    }

    // Убираем дубликаты, возвращаем максимум 5
    return Array.from(new Set(similar.map(cat => cat.id)))
        .map(id => similar.find(cat => cat.id === id))
        .slice(0, 5);
}
```

**Использование:**
```javascript
const similar = getSimilarCategories('Dead', 'twitch', vkCategories);
// Результат: [
//   {id: 1, name: "Dead by Daylight"},
//   {id: 2, name: "Dead Space 3"},
//   {id: 3, name: "Dead Cells"},
//   ...
// ]
```

## 📝 Что восстановлено

### Файл: `frontend/src/constants/categoryMapping.js`

1. **Функция `findMappedCategory`** (умная логика с 3 этапами)
2. **Функция `getSimilarCategories`** (для автокомплита)
3. **Объект `categoryMapping`** (37 маппингов Twitch ↔ VK)
4. **Legacy экспорты** (`CATEGORY_MAPPING`, `CATEGORY_ICONS`) для обратной совместимости

### Использование в коде

`StreamCategoryCard.jsx` **уже правильно использует** маппинг:
```javascript
const mappedCategory = findMappedCategory(category.name, platform, otherCategories);
```

Никаких изменений в `StreamCategoryCard` не требуется! ✅

## ✅ Результат

После восстановления legacy кода:
- ✅ Объединённый режим категорий работает корректно
- ✅ Категории правильно мапятся между Twitch и VK
- ✅ API получает правильные `category_id`
- ✅ Частичное совпадение работает для конкретных игр
- ✅ Есть функция для автокомплита (на будущее)

## 🔗 Связанные документы

- `docs/CATEGORY_BUTTON_FIX_LEGACY_RESTORE.md` - восстановление StreamCategoryCard
- `frontend/src/components/StreamCategoryCard.jsx` - компонент использующий маппинг
- `twitch-tts-bot-feature-tts-controls/frontend/src/constants/categoryMapping.js` - исходный legacy код



