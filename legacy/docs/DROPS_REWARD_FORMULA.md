# 📐 Полная формула определения награды в системе Drops

**ВАЖНО:** Виджет OBS - это только визуализация! Вся логика определения награды происходит на бэкенде.

---

## 🎯 **Общая схема:**

```
ТРИГГЕР → ПРОВЕРКА УСЛОВИЙ → ОПРЕДЕЛЕНИЕ КАЧЕСТВА → ВЫБОР НАГРАДЫ → СОХРАНЕНИЕ → ОТПРАВКА В ВИДЖЕТ
```

---

## 📍 **ШАГ 1: Триггеры (когда срабатывает система)**

### **1.1. Streak Drops (Стрик-лутбоксы)**

**Триггер:** Зритель написал сообщение в чат

**Условия активации:**
```
1. config.streak_enabled_twitch = true (для Twitch)
   ИЛИ
   config.streak_enabled_vk = true (для VK)

2. Прошел новый день (24 часа с last_activity)

3. Зритель выполнил требование:
   streak.messages_this_stream >= config.streak_messages_required

4. Стрик достиг минимального порога:
   streak.current_streak >= config.streak_days_common
```

**Формула вызова:**
```python
process_streak_drops(
    user_id=owner_id,
    channel_name=channel_name,
    platform="twitch" | "vk",
    viewer_id=viewer_id,
    viewer_name=viewer_name
)
```

---

### **1.2. Donation Drops (Донат-лутбоксы)**

**Триггер:** Зритель сделал донат через DonationAlerts

**Условия активации:**
```
1. config.donation_enabled = true

2. donation_amount >= config.donation_amount_common
```

**Формула вызова:**
```python
process_donation_drops(
    user_id=owner_id,
    channel_name=channel_name,
    platform="donationalerts",
    viewer_id=donor_id,
    viewer_name=donor_name,
    donation_amount=amount
)
```

---

### **1.3. Mythical Drops (Мифические лутбоксы)**

**Триггер:** Прошло достаточно времени с последнего появления

**Условия активации:**
```
1. config.mythical_enabled = true

2. time_since_last >= config.mythical_min_interval_hours

3. (Опционально) Случайная активация:
   random() < 0.1 (10% шанс)
```

**Формула вызова:**
```python
process_mythical_drops(
    user_id=owner_id,
    channel_name=channel_name,
    platform="twitch" | "vk",
    viewer_id=viewer_id,
    viewer_name=viewer_name
)
```

---

## 🎨 **ШАГ 2: Определение качества (Quality)**

### **2.1. Streak Quality (по дням стрика)**

**Формула:**
```python
def get_streak_quality(days: int, config: DropsConfig) -> str:
    if days >= config.streak_days_legendary:
        return "Legendary"
    elif days >= config.streak_days_epic:
        return "Epic"
    elif days >= config.streak_days_rare:
        return "Rare"
    elif days >= config.streak_days_common:
        return "Common"
    return None  # Стрик слишком мал
```

**Пример (дефолтные значения):**
```
days = 1  → Common
days = 7  → Rare
days = 30 → Epic
days = 60 → Legendary
```

**Математическая формула:**
```
Quality = {
    "Legendary"  if streak_days >= streak_days_legendary
    "Epic"       if streak_days >= streak_days_epic AND streak_days < streak_days_legendary
    "Rare"       if streak_days >= streak_days_rare AND streak_days < streak_days_epic
    "Common"     if streak_days >= streak_days_common AND streak_days < streak_days_rare
    None         if streak_days < streak_days_common
}
```

---

### **2.2. Donation Quality (по сумме доната)**

**Формула:**
```python
def get_donation_quality(amount: float, config: DropsConfig) -> str:
    if amount >= config.donation_amount_legendary:
        return "Legendary"
    elif amount >= config.donation_amount_epic:
        return "Epic"
    elif amount >= config.donation_amount_rare:
        return "Rare"
    elif amount >= config.donation_amount_common:
        return "Common"
    return None  # Донат слишком мал
```

**Пример (дефолтные значения):**
```
amount = 50₽   → Common
amount = 100₽  → Rare
amount = 500₽  → Epic
amount = 1000₽ → Legendary
```

**Математическая формула:**
```
Quality = {
    "Legendary"  if donation_amount >= donation_amount_legendary
    "Epic"       if donation_amount >= donation_amount_epic AND donation_amount < donation_amount_legendary
    "Rare"       if donation_amount >= donation_amount_rare AND donation_amount < donation_amount_epic
    "Common"     if donation_amount >= donation_amount_common AND donation_amount < donation_amount_rare
    None         if donation_amount < donation_amount_common
}
```

---

### **2.3. Mythical Quality**

**Всегда:** `"Mythical"` (фиксированное качество)

---

## 🎲 **ШАГ 3: Выбор конкретной награды (Weighted Random Selection)**

### **3.1. Получение списка наград**

**Фильтры:**
```python
rewards = DropsReward.query.filter(
    DropsReward.user_id == user_id,
    DropsReward.channel_name == channel_name,
    DropsReward.platform == platform,  # "twitch" или "vk" - ВАЖНО!
    DropsReward.quality_id == quality.id,
    DropsReward.is_active == True
).all()
```

**ВАЖНО:** 
- **Настройки (DropsConfig)** - ОБЩИЕ для всех платформ (`platform="global"`)
  - Пороги дней стрика, суммы донатов, таймауты - одинаковые для Twitch и VK
- **Награды (DropsReward)** - ОБЩИЕ для всех платформ
  - Все награды доступны для всех платформ (Twitch, VK, DonationAlerts)
  - Когда вы наполняете сундук наградами - они автоматически доступны на всех платформах
  - Поле `platform` в БД сохраняется для совместимости, но не используется при фильтрации

---

### **3.2. Взвешенный случайный выбор**

**Алгоритм:**

```python
def get_random_reward(rewards: List[DropsReward]) -> DropsReward:
    # Шаг 1: Суммируем все веса
    total_weight = Σ(reward.weight for reward in rewards)
    
    # Шаг 2: Генерируем случайное число
    random_value = random.random() * total_weight
    # random_value ∈ [0, total_weight)
    
    # Шаг 3: Идем по наградам, суммируя веса
    current_weight = 0
    for reward in rewards:
        current_weight += reward.weight
        if random_value < current_weight:
            return reward
    
    # Fallback (математически не должно произойти)
    return rewards[-1]
```

---

### **3.3. Математическая формула вероятности**

**Для каждой награды:**
```
P(reward_i) = weight_i / total_weight

где:
  weight_i = вес i-й награды
  total_weight = Σ(weight_j) для всех j
```

**Пример:**

Награды в качестве "Epic":
- Награда A: вес = 10
- Награда B: вес = 30
- Награда C: вес = 60

```
total_weight = 10 + 30 + 60 = 100

P(A) = 10/100 = 10%
P(B) = 30/100 = 30%
P(C) = 60/100 = 60%
```

**Визуализация:**
```
[0──────10──────40──────100]
  A (10%)  B (30%)  C (60%)
  
random_value = 56.7
→ Попадает в диапазон [40, 100)
→ Выбрана награда C
```

---

## 📊 **ПОЛНАЯ ФОРМУЛА (объединенная)**

### **Для Streak Drops:**

```
// Шаг 1: Получаем ОБЩИЕ настройки (platform="global")
config = get_config(platform=None)

// Шаг 2: Проверяем условия
IF config.streak_enabled_platform AND is_new_day AND messages_this_stream >= config.streak_messages_required:
    
    // Шаг 3: Определяем качество по ОБЩИМ настройкам
    quality = {
        "Legendary"  if streak_days >= config.streak_days_legendary
        "Epic"       if streak_days >= config.streak_days_epic
        "Rare"       if streak_days >= config.streak_days_rare
        "Common"     if streak_days >= config.streak_days_common
    }
    
    // Шаг 4: Получаем награды (ОБЩИЕ для всех платформ)
    rewards = get_rewards(quality, platform="twitch")  // platform игнорируется
    
    // Шаг 5: Взвешенный случайный выбор
    total_weight = Σ(reward.weight)
    random_value = random() * total_weight
    
    selected_reward = find_reward_by_weight(rewards, random_value)
    
    RETURN {
        type: "streak",
        quality: quality,
        reward: selected_reward,
        streak_days: streak_days
    }
```

---

### **Для Donation Drops:**

```
// Шаг 1: Получаем ОБЩИЕ настройки (platform="global")
config = get_config(platform=None)

// Шаг 2: Проверяем условия
IF config.donation_enabled AND donation_amount >= config.donation_amount_common:
    
    // Шаг 3: Определяем качество по ОБЩИМ настройкам
    quality = {
        "Legendary"  if amount >= config.donation_amount_legendary
        "Epic"       if amount >= config.donation_amount_epic
        "Rare"       if amount >= config.donation_amount_rare
        "Common"     if amount >= config.donation_amount_common
    }
    
    // Шаг 4: Получаем награды (ОБЩИЕ для всех платформ)
    rewards = get_rewards(quality, platform="donationalerts")  // platform игнорируется
    
    // Шаг 5: Взвешенный случайный выбор
    total_weight = Σ(reward.weight)
    random_value = random() * total_weight
    
    selected_reward = find_reward_by_weight(rewards, random_value)
    
    RETURN {
        type: "donation",
        quality: quality,
        reward: selected_reward,
        donation_amount: amount
    }
```

---

### **Для Mythical Drops:**

```
// Шаг 1: Получаем ОБЩИЕ настройки (platform="global")
config = get_config(platform=None)

// Шаг 2: Проверяем условия
IF config.mythical_enabled AND time_since_last >= config.mythical_min_interval_hours:
    
    quality = "Mythical"  // Фиксированное
    
    // Шаг 3: Получаем награды (ОБЩИЕ для всех платформ)
    rewards = get_rewards(quality, platform="twitch")  // platform игнорируется
    
    // Шаг 4: Взвешенный случайный выбор
    total_weight = Σ(reward.weight)
    random_value = random() * total_weight
    
    selected_reward = find_reward_by_weight(rewards, random_value)
    
    RETURN {
        type: "mythical",
        quality: "Mythical",
        reward: selected_reward
    }
```

---

## 🔍 **Детали реализации**

### **Проверка наличия наград:**

```python
if not rewards:
    logger.warning("No rewards found")
    return None  # Лутбокс не выдается
```

### **Обработка нулевых весов:**

```python
if total_weight == 0:
    return random.choice(rewards)  # Равномерное распределение
```

### **Настройки и награды - ОБЩИЕ:**

```python
# НАСТРОЙКИ - ОБЩИЕ (platform="global")
config = get_config(platform=None)  # или platform="global"
# Все пороги, таймауты, флаги включения - одинаковые для всех платформ

# НАГРАДЫ - ОБЩИЕ ДЛЯ ВСЕХ ПЛАТФОРМ
rewards = get_rewards(quality, platform="twitch")  # platform игнорируется!
# Или
rewards = get_rewards(quality, platform="vk")  # Результат одинаковый!

# Это ОДИН И ТОТ ЖЕ набор наград для всех платформ!
# Когда вы наполняете сундук - награды доступны везде
```

---

## 📝 **Пример полного расчета**

### **Сценарий:**
- Зритель "yourchy" написал 10-е сообщение за день
- Его текущий стрик: 18 дней
- Настройки: `streak_days_common=1`, `streak_days_rare=7`, `streak_days_epic=30`, `streak_days_legendary=60`
- Требование: `streak_messages_required=10`
- Платформа: Twitch

### **Расчет:**

**Шаг 1: Проверка условий**
```
streak_enabled_twitch = true ✅
is_new_day = true ✅
messages_this_stream = 10 >= 10 ✅
streak_days = 18 >= 1 ✅
```

**Шаг 2: Определение качества**
```
18 >= 7 (rare) AND 18 < 30 (epic)
→ Quality = "Rare"
```

**Шаг 3: Получение наград**
```
rewards = [
    {id: 1, name: "100 очков", weight: 50},
    {id: 2, name: "500 очков", weight: 30},
    {id: 3, name: "Голос TTS", weight: 20}
]
```

**Шаг 4: Взвешенный выбор**
```
total_weight = 50 + 30 + 20 = 100
random_value = 67.3

current_weight = 0
→ reward[0]: current_weight = 50, 67.3 >= 50 ❌
→ reward[1]: current_weight = 80, 67.3 < 80 ✅

→ Выбрана награда: "500 очков"
```

**Результат:**
```json
{
    "type": "streak",
    "viewer_name": "yourchy",
    "quality": "Rare",
    "reward": "500 очков",
    "reward_type": "points",
    "reward_value": "500",
    "streak_days": 18
}
```

---

## 🎬 **Отправка в виджет**

После определения награды:

1. **Сохранение в историю:**
```python
_record_drops_history(
    drops_type="streak",
    quality_id=quality.id,
    reward=selected_reward,
    ...
)
```

2. **Отправка в WebSocket:**
```python
broadcast_drops_event({
    "type": "streak",
    "quality": "Rare",
    "reward": "500 очков",
    "reward_id": 2,
    "reward_name": "500 очков",
    ...
})
```

3. **Виджет получает данные и показывает анимацию:**
   - Открытие сундука
   - Рулетка с карточками
   - Остановка на выбранной награде
   - Показ победителя

---

## ⚠️ **Важные моменты**

1. **Виджет НЕ влияет на выбор награды** - он только визуализирует уже определенный результат
2. **Настройки ОБЩИЕ для всех платформ** (`platform="global"`):
   - Пороги дней стрика (`streak_days_common/rare/epic/legendary`)
   - Пороги сумм донатов (`donation_amount_common/rare/epic/legendary`)
   - Таймауты мифических лутбоксов
   - Требование сообщений (`streak_messages_required`)
   - Все эти настройки одинаковые для Twitch и VK
3. **Награды ОБЩИЕ для всех платформ**:
   - Когда вы наполняете сундук наградами - они автоматически доступны на ВСЕХ платформах
   - Один набор наград для Twitch, VK и DonationAlerts
   - Параметр `platform` в API игнорируется при получении наград
   - Качество определяется по ОБЩИМ настройкам, награда выбирается из ОБЩЕГО набора
4. **Веса работают относительно** - важно соотношение весов, а не абсолютные значения
5. **Качество определяется ДО выбора награды** - сначала качество (по общим настройкам), потом конкретная награда (из общего набора)
6. **Все проверки происходят на бэкенде** - фронтенд только отображает результат

---

## 📚 **Связанные файлы**

- `bot_service/services/drops_service.py` - основная логика
- `bot_service/api/drops_api.py` - API endpoints
- `bot_service/core/database.py` - модели данных
- `frontend/src/pages/obs/DropsWidget.jsx` - виджет (только визуализация)

---

**Дата создания:** 2025-11-08  
**Версия:** 1.0

