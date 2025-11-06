# Category Mapping Guide - Twitch ↔ VK Live

**Last Updated:** October 22, 2025  
**Total Mappings:** 230+ категорий

---

## 📋 **Обзор**

Система маппинга категорий позволяет автоматически подбирать соответствующую категорию VK Live при переключении из Twitch в режиме "Объединить поля".

---

## 🎯 **Покрытие категорий**

### **Основные категории (33)**
- ✅ Just Chatting → Говорим и смотрим
- ✅ Music → Музыка
- ✅ Creative/Art → Творчество
- ✅ Gaming → Игры
- ✅ Sports → Спорт
- ✅ Food & Drink → Кулинария
- ✅ ASMR → АСМР
- ✅ Chess → Интеллектуальные игры
- ✅ Slots/Casino/Poker → Азартные игры
- ✅ Animals → Животные
- ✅ Anime → Аниме
- ✅ Beauty & Makeup → Красота
- ✅ Politics → Общественное
- ✅ News → Новости
- ✅ Esports → Киберспорт
- ✅ Educational → Обучение
- ✅ Science & Technology → Технологии
- ✅ Travel & Outdoors → Путешествия
- И др.

### **Игровые жанры (27)**
- ✅ RPG, MMORPG, MOBA
- ✅ Strategy → Стратегии
- ✅ Simulation → Симуляторы
- ✅ Racing → Гонки
- ✅ Fighting → Файтинги
- ✅ FPS/Shooter → Шутеры
- ✅ Battle Royale
- ✅ Horror → Хоррор
- ✅ Action → Экшн
- ✅ Adventure → Приключения
- ✅ Platformer → Платформеры
- ✅ Puzzle → Головоломки
- ✅ Rhythm → Ритм-игры
- ✅ Indie → Инди
- И др.

### **Конкретные игры (170+)**
**Популярные:**
- Counter-Strike, CS:GO, Counter-Strike 2
- Dota 2, League of Legends
- Minecraft, Fortnite, Roblox
- GTA V, Cyberpunk 2077, Elden Ring
- Call of Duty, Valorant, Apex Legends
- World of Warcraft, Final Fantasy XIV
- Escape from Tarkov, Rust, DayZ
- Dead by Daylight, Phasmophobia
- Among Us, Fall Guys
- И многие другие

**Симуляторы:**
- Euro Truck Simulator 2
- American Truck Simulator
- Farming Simulator
- Microsoft Flight Simulator
- The Sims 4

**Стратегии:**
- Civilization VI
- Age of Empires IV
- StarCraft II
- Cities: Skylines

**Выживание:**
- Valheim, Satisfactory, Factorio
- ARK, Conan Exiles, Palworld
- Project Zomboid, The Forest
- Sons of the Forest

**Инди:**
- Hollow Knight, Celeste, Hades
- Dead Cells, The Binding of Isaac
- Slay the Spire, Vampire Survivors
- Stardew Valley, Terraria

**VR:**
- VRChat, Beat Saber
- Half-Life: Alyx, Pavlov VR

---

## 🔄 **Логика работы**

### **1. Приоритет поиска:**
```
1. Проверка маппинга (categoryMapping)
   ├─ Нашли? → Поиск на VK по mapped name
   └─ Не нашли? → Переход к шагу 2
   
2. Fallback на оригинальное название
   └─ Поиск на VK по original name
   
3. Проверка релевантности
   ├─ Good match (score ≤ 3)? → Использовать ✅
   └─ Poor match? → Пропустить ❌
```

### **2. Примеры работы:**

**Пример 1: Прямой маппинг**
```
Twitch: "Just Chatting"
Mapped: "Говорим и смотрим"
VK Search: "Говорим и смотрим"
Found: "Говорим и смотрим" (exact match)
Result: ✅ Обе платформы обновлены
```

**Пример 2: Сокращенное название**
```
Twitch: "Tom Clancy's Rainbow Six Siege"
Mapped: "Rainbow Six Siege"
VK Search: "Rainbow Six Siege"
Found: "Rainbow Six Siege"
Result: ✅ Обе платформы обновлены
```

**Пример 3: Игра есть на обеих платформах**
```
Twitch: "Minecraft"
Mapped: "Minecraft" (тот же)
VK Search: "Minecraft"
Found: "Minecraft"
Result: ✅ Обе платформы обновлены
```

**Пример 4: Категория только на Twitch**
```
Twitch: "Software and Game Development"
Mapped: "Технологии"
VK Search: "Технологии"
Found: 0 results
Fallback: "Software and Game Development"
Found: 0 results
Result: ⚠️ Только Twitch обновлен
```

---

## 🛠️ **Как добавить новый маппинг**

### **Файл:** `frontend/src/constants/categoryMapping.js`

**Шаблон:**
```javascript
export const categoryMapping = {
    // Twitch → VK
    'Twitch Category Name': 'VK Category Name',
    
    // VK → Twitch (обратный маппинг)
    'VK Category Name': 'Twitch Category Name'
};
```

**Пример добавления:**
```javascript
// 1. Добавить маппинг Twitch → VK
'New Game Title': 'Новая Игра',

// 2. Добавить обратный маппинг VK → Twitch
'Новая Игра': 'New Game Title',
```

---

## ⚙️ **Особенности**

### **1. Двунаправленный маппинг**
Маппинг работает в **обе стороны**:
- Twitch → VK (при включении toggle)
- VK → Twitch (при выборе категории вручную)

### **2. Fallback на оригинал**
Если по маппингу ничего не найдено, система пробует **оригинальное название**:
```javascript
// Если "Говорим и смотрим" не найдено на VK
// Пробуем "Just Chatting" (может быть транслит)
```

### **3. Fuzzy matching**
Система находит категории даже с **опечатками**:
```
"conter strike" → "Counter-Strike" ✅ (1 опечатка)
"mincraft" → "Minecraft" ✅ (1 опечатка)
```

### **4. Нормализация**
Игнорируются **различия в пунктуации**:
```
"counter strike" = "Counter-Strike" ✅
"counter  strike" = "Counter-Strike" ✅
"COUNTER-STRIKE" = "Counter-Strike" ✅
```

---

## 📊 **Статистика покрытия**

| Категория | Количество | Примеры |
|-----------|-----------|---------|
| Основные категории | 33 | Just Chatting, Music, Sports |
| Игровые жанры | 27 | RPG, FPS, Strategy, Horror |
| Конкретные игры | 170+ | CS:GO, Dota 2, Minecraft |
| **Всего** | **230+** | |

---

## 🔍 **Проверка маппинга**

### **Тестирование:**
1. Включите toggle "Объединить поля"
2. Выберите категорию Twitch
3. Проверьте логи в консоли:

```javascript
// Успешный маппинг:
🔍 [AUTO-SYNC] Trying mapped name: Говорим и смотрим
✅ [AUTO-SYNC] Found via mapping: Говорим и смотрим

// Fallback:
🔍 [AUTO-SYNC] Trying original name: Minecraft
✅ [AUTO-SYNC] Found via original name: Minecraft

// Не найдено:
⚠️ [AUTO-SYNC] Could not find VK category for: Software Development
💡 [AUTO-SYNC] Only Twitch category will be updated
```

---

## 🚀 **Производительность**

- **Поиск по маппингу:** O(1) - мгновенно
- **Fallback поиск:** 1 API запрос к VK (~300-500ms)
- **Проверка релевантности:** O(n*m) где n = кол-во результатов, m = длина запроса
- **Общее время:** 300-800ms на auto-sync

---

## 💡 **Советы по расширению**

### **Когда добавлять маппинг:**
1. ✅ Категория на Twitch называется **по-другому** на VK Live
2. ✅ Категория на Twitch **слишком длинная** (сокращение на VK)
3. ✅ Категория на Twitch **на английском**, а на VK **на русском**

### **Когда НЕ нужен маппинг:**
1. ❌ Название **идентично** на обеих платформах (Minecraft, Dota 2)
2. ❌ Fuzzy matching **уже найдет** (counter strike → Counter-Strike)
3. ❌ Категория **уникальна для Twitch** (Software Development)

---

## 📝 **История изменений**

### **v1.0 - October 22, 2025**
- ✅ Добавлено 230+ маппингов
- ✅ Покрытие основных категорий (33)
- ✅ Покрытие игровых жанров (27)
- ✅ Покрытие популярных игр (170+)
- ✅ Двунаправленный маппинг (Twitch ↔ VK)
- ✅ Fallback на оригинальное название
- ✅ Fuzzy matching для опечаток
- ✅ Нормализация пунктуации

---

## 🔗 **См. также:**
- `categoryAliases.js` - Алиасы и сокращения категорий
- `SESSION_6_FINAL_FIXES.md` - Детали реализации auto-sync
- `StreamCategoryCard.jsx` - Компонент с логикой sync

