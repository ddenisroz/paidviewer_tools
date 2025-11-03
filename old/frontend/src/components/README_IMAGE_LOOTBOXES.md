# Анимированные лутбоксы с картинками

## Обзор

Простая система анимированных лутбоксов, использующая смену картинок для создания эффекта открытия. Каждый лутбокс имеет набор картинок, которые сменяются с определенной скоростью, создавая иллюзию анимации.

## Структура файлов

```
frontend/src/images/lootboxes/
├── common/
│   ├── closed.png      # Закрытый лутбокс
│   ├── opening1.png    # Этап открытия 1
│   ├── opening2.png    # Этап открытия 2
│   └── opened.png      # Открытый лутбокс
├── common2/
│   ├── closed.png
│   ├── opening1.png
│   ├── opening2.png
│   └── opened.png
├── rare/
│   ├── closed.png
│   ├── opening1.png
│   ├── opening2.png
│   ├── opening3.png
│   └── opened.png
├── rare2/
│   ├── closed.png
│   ├── opening1.png
│   ├── opening2.png
│   ├── opening3.png
│   └── opened.png
├── epic/
│   ├── closed.png
│   ├── opening1.png
│   ├── opening2.png
│   ├── opening3.png
│   ├── opening4.png
│   └── opened.png
└── legendary/
    ├── closed.png
    ├── opening1.png
    ├── opening2.png
    ├── opening3.png
    ├── opening4.png
    ├── opening5.png
    └── opened.png
```

## Компоненты

### 1. ImageLootbox.jsx
Основной компонент для отображения анимированных лутбоксов.

**Пропсы:**
- `images` - массив путей к картинкам для анимации
- `title` - название лутбокса
- `rarity` - редкость (common, rare, epic, legendary)
- `isOpening` - открывается ли лутбокс сейчас
- `onOpen` - callback при открытии
- `className` - дополнительные CSS классы
- `size` - размер (small, medium, large)

**Пример использования:**
```jsx
<ImageLootbox
  images={['/src/images/lootboxes/common/closed.png', '/src/images/lootboxes/common/opening1.png', '/src/images/lootboxes/common/opened.png']}
  title="Обычный лутбокс"
  rarity="common"
  size="medium"
  isOpening={false}
  onOpen={() => console.log('Лутбокс открыт!')}
/>
```

### 2. lootboxImages.js
Утилиты для работы с картинками лутбоксов.

**Основные функции:**
- `getLootboxImages(rarity, variant)` - получает набор картинок по редкости
- `createLootboxImageConfig(lootbox, context)` - создает конфигурацию
- `createMockLootboxes()` - создает тестовые данные
- `animateLootboxOpening(element, callback)` - анимация открытия
- `createSparkleEffect(element)` - эффект блеска

## CSS анимации

### Основные анимации
```css
/* Появление лутбокса */
.animate-lootbox-appear {
  animation: lootbox-appear 0.8s ease-out forwards;
}

/* Открытие лутбокса */
.animate-lootbox-open {
  animation: lootbox-open 1.2s ease-in-out forwards;
}

/* Эффект блеска */
.animate-sparkle {
  animation: sparkle 0.6s ease-out;
}

/* Эффект мерцания */
.animate-shimmer {
  animation: shimmer 1.5s ease-in-out infinite;
}
```

### Эффекты свечения по редкости
```css
.lootbox-glow-rare {
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
}

.lootbox-glow-epic {
  box-shadow: 0 0 25px rgba(147, 51, 234, 0.6);
}

.lootbox-glow-legendary {
  box-shadow: 0 0 30px rgba(251, 191, 36, 0.7);
  animation: legendary-pulse 2s ease-in-out infinite;
}
```

## Настройка анимации

### Скорость смены картинок
В компоненте `ImageLootbox.jsx` можно изменить скорость смены картинок:

```javascript
const interval = setInterval(() => {
  setCurrentImageIndex(index);
  index++;
  
  if (index >= images.length) {
    clearInterval(interval);
    setIsAnimating(false);
    setCurrentImageIndex(images.length - 1);
  }
}, 150); // Измените 150 на нужное значение (мс)
```

### Количество этапов открытия
Для разных редкостей можно настроить разное количество этапов:

- **Common**: 3-4 картинки (закрытый → 1-2 этапа → открытый)
- **Rare**: 4-5 картинок
- **Epic**: 5-6 картинок  
- **Legendary**: 6-7 картинок

## Интеграция в LootboxSystem

Система автоматически интегрирована в `LootboxSystem.jsx` с новой вкладкой "🎨 Анимированные лутбоксы".

### Функции управления:
- **Открыть все** - запускает анимацию для всех лутбоксов
- **Сбросить** - останавливает все анимации
- **Анимация открытия** - запускает CSS анимацию поворота

## Создание собственных лутбоксов

### 1. Подготовка картинок
1. Создайте папку для вашего лутбокса в `/src/images/lootboxes/`
2. Подготовьте картинки в последовательности:
   - `closed.png` - закрытый лутбокс
   - `opening1.png`, `opening2.png`, ... - этапы открытия
   - `opened.png` - открытый лутбокс

### 2. Обновление утилит
Добавьте новый набор картинок в `lootboxImages.js`:

```javascript
const imageSets = {
  // ... существующие наборы
  custom: [
    [
      '/src/images/lootboxes/custom/closed.png',
      '/src/images/lootboxes/custom/opening1.png',
      '/src/images/lootboxes/custom/opening2.png',
      '/src/images/lootboxes/custom/opened.png'
    ]
  ]
};
```

### 3. Создание лутбокса
```javascript
const customLootbox = {
  id: 5,
  name: 'Кастомный лутбокс',
  rarity: 'custom',
  variant: 0,
  description: 'Описание лутбокса'
};
```

## Оптимизация производительности

### Предзагрузка картинок
```javascript
import { preloadLootboxImages } from '../utils/lootboxImages';

// Предзагрузка всех картинок лутбокса
const imagePaths = ['/src/images/lootboxes/common/closed.png', ...];
preloadLootboxImages(imagePaths)
  .then(() => console.log('Все картинки загружены'))
  .catch(error => console.error('Ошибка загрузки:', error));
```

### Ленивая загрузка
Картинки загружаются только при необходимости, что экономит трафик.

## Отладка

### Проверка загрузки картинок
```javascript
// В консоли браузера
const img = new Image();
img.onload = () => console.log('Картинка загружена');
img.onerror = () => console.error('Ошибка загрузки картинки');
img.src = '/src/images/lootboxes/common/closed.png';
```

### Проверка анимации
1. Откройте вкладку "Анимированные лутбоксы"
2. Нажмите на лутбокс для запуска анимации
3. Используйте кнопку "Анимация открытия" для CSS анимации

## Расширение функциональности

### Добавление звуков
```javascript
const playLootboxSound = (rarity) => {
  const audio = new Audio(`/src/sounds/lootbox-${rarity}.mp3`);
  audio.play();
};

// В компоненте ImageLootbox
useEffect(() => {
  if (isOpening) {
    playLootboxSound(rarity);
  }
}, [isOpening, rarity]);
```

### Добавление частиц
```javascript
const createParticleEffect = (element) => {
  // Создание эффекта частиц при открытии
  // Можно использовать библиотеку типа particles.js
};
```

### Сохранение состояния
```javascript
const [openedLootboxes, setOpenedLootboxes] = useState(new Set());

const handleLootboxOpen = (lootboxId) => {
  setOpenedLootboxes(prev => new Set([...prev, lootboxId]));
  // ... остальная логика
};
```

## Совместимость

- ✅ Все современные браузеры
- ✅ Мобильные устройства
- ✅ Высокая производительность
- ✅ Легкая настройка
- ✅ Простое расширение
