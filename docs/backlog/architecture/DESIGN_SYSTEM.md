# Design System - Руководство по использованию

## Обзор

Этот документ описывает единую систему дизайна проекта. Используйте эти правила для создания согласованного UI.

**Последнее обновление:** 18 декабря 2025

## 📦 Централизованные константы

Все константы дизайн-системы находятся в файле `frontend/src/constants/designSystem.ts`.

```typescript
import { 
  BUTTON_SIZES, 
  INPUT_SIZES, 
  SPACING, 
  PLATFORM_COLORS,
  STATUS_COLORS,
  ADMIN_SECTION_COLORS,
  TABLE_CLASSES 
} from '@/constants/designSystem';
```

### Доступные константы

| Константа | Описание |
|-----------|----------|
| `BUTTON_SIZES` | Размеры кнопок (sm, default, lg, icon, iconSm) |
| `INPUT_SIZES` | Размеры полей ввода (sm, default, lg) |
| `SPACING` | Отступы между элементами (xs, sm, md, lg, xl) |
| `CARD_PADDING` | Padding для карточек (sm, default, lg) |
| `FONT_SIZES` | Размеры шрифтов (xs, sm, base, lg, xl, 2xl, 3xl) |
| `PLATFORM_COLORS` | Цвета платформ (twitch, vk, donationalerts) |
| `STATUS_COLORS` | Цвета статусов (success, error, warning, info, neutral) |
| `ADMIN_SECTION_COLORS` | Цвета секций админки |
| `TABLE_CLASSES` | Стандартные классы для таблиц |
| `FORM_CLASSES` | Стандартные классы для форм |
| `TRANSITIONS` | Анимации и переходы |

## 📏 Система отступов (Spacing)

Используем **8px grid system**. Все отступы кратны 4px или 8px.

### CSS переменные

```css
--space-0: 0px
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-6: 24px
--space-8: 32px
--space-12: 48px
```

### Tailwind классы

```jsx
// Padding
<div className="p-4">     {/* 16px */}
<div className="p-6">     {/* 24px */}
<div className="px-4 py-2"> {/* 16px horizontal, 8px vertical */}

// Margin
<div className="m-4">     {/* 16px */}
<div className="mb-6">    {/* 24px bottom */}

// Gap (для flex/grid)
<div className="gap-4">   {/* 16px */}
<div className="gap-6">   {/* 24px */}
```

### Когда использовать

- **4px (space-1)**: Минимальные отступы между близкими элементами
- **8px (space-2)**: Отступы между связанными элементами (label и input)
- **16px (space-4)**: Стандартные отступы между элементами
- **24px (space-6)**: Отступы между секциями внутри карточки
- **32px (space-8)**: Отступы между крупными блоками
- **48px (space-12)**: Отступы между основными секциями страницы

## 🔤 Типографика

### Размеры шрифтов

```jsx
<p className="text-xs">    {/* 12px - мелкий текст, метки */}
<p className="text-sm">    {/* 14px - основной текст UI */}
<p className="text-base">  {/* 16px - основной текст контента */}
<p className="text-lg">    {/* 18px - подзаголовки */}
<p className="text-xl">    {/* 20px - заголовки карточек */}
<p className="text-2xl">   {/* 24px - заголовки секций */}
<p className="text-3xl">   {/* 30px - заголовки страниц */}
```

### Веса шрифтов

```jsx
<p className="font-normal">   {/* 400 - обычный текст */}
<p className="font-medium">   {/* 500 - акценты */}
<p className="font-semibold"> {/* 600 - подзаголовки */}
<p className="font-bold">     {/* 700 - заголовки */}
```

### Высота строки

```jsx
<p className="leading-tight">   {/* 1.25 - компактный текст */}
<p className="leading-normal">  {/* 1.5 - стандартный текст */}
<p className="leading-relaxed"> {/* 1.625 - читаемый текст */}
```

## 🔘 Кнопки

### Размеры

```jsx
import { BUTTON_SIZES } from '@/constants/designSystem';

// Маленькая кнопка (32px высота)
<Button size="sm" className={BUTTON_SIZES.sm}>
  Маленькая
</Button>

// Стандартная кнопка (40px высота) - ИСПОЛЬЗУЙТЕ ПО УМОЛЧАНИЮ
<Button size="default" className={BUTTON_SIZES.default}>
  Стандартная
</Button>

// Большая кнопка (48px высота)
<Button size="lg" className={BUTTON_SIZES.lg}>
  Большая
</Button>

// Кнопка-иконка (40x40px) - для иконок в header/toolbar
<Button size="icon" className={BUTTON_SIZES.icon}>
  <Icon />
</Button>

// Маленькая кнопка-иконка (32x32px) - для action buttons в таблицах
<Button size="icon" className={BUTTON_SIZES.iconSm}>
  <Icon className="h-4 w-4" />
</Button>
```

### Константы размеров

```typescript
BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs',      // 32px
  default: 'h-10 px-4 py-2',   // 40px - СТАНДАРТ
  lg: 'h-12 px-8',             // 48px
  icon: 'h-10 w-10 p-0',       // 40x40px - для иконок
  iconSm: 'h-8 w-8 p-0',       // 32x32px - маленькие иконки
}
```

### Варианты

```jsx
<Button variant="default">   {/* Основная кнопка */}
<Button variant="secondary"> {/* Второстепенная */}
<Button variant="outline">   {/* С обводкой */}
<Button variant="ghost">     {/* Прозрачная */}
<Button variant="destructive"> {/* Опасное действие */}
```

## 📝 Поля ввода (Inputs)

### Размеры

```jsx
// Маленькое поле (32px высота)
<Input className="h-8 text-xs" />

// Стандартное поле (36px высота) - ИСПОЛЬЗУЙТЕ ПО УМОЛЧАНИЮ
<Input className="h-9" />

// Большое поле (44px высота)
<Input className="h-11 text-base" />
```

### Группы полей

```jsx
<div className="space-y-2">
  <Label>Название</Label>
  <Input />
  <p className="text-xs text-muted-foreground">Подсказка</p>
</div>
```

## 🃏 Карточки (Cards)

### Стандартная карточка

```jsx
<Card className="border-gray-700">
  <CardHeader className="pb-3">
    <CardTitle className="text-xl">Заголовок</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Контент с отступами 16px между элементами */}
  </CardContent>
</Card>
```

### Размеры padding

- **CardHeader**: `p-6` (24px)
- **CardContent**: `p-6 pt-0` (24px, но без верхнего отступа)
- **CardFooter**: `p-6 pt-0` (24px, но без верхнего отступа)

## 🎨 Цвета

### Используйте CSS переменные темы

```jsx
// Текст
<p className="text-foreground">      {/* Основной текст */}
<p className="text-muted-foreground"> {/* Второстепенный текст */}

// Фон
<div className="bg-background">      {/* Основной фон */}
<div className="bg-card">            {/* Фон карточки */}
<div className="bg-muted">           {/* Приглушенный фон */}

// Границы
<div className="border-border">      {/* Стандартная граница */}
<div className="border-input">       {/* Граница поля ввода */}

// Акценты
<div className="bg-primary">         {/* Основной акцент */}
<div className="bg-secondary">       {/* Второстепенный акцент */}
<div className="bg-accent">          {/* Акцент для hover */}
```

### Цвета платформ

```jsx
import { PLATFORM_COLORS } from '@/constants/designSystem';

// Twitch
<Button className={`${PLATFORM_COLORS.twitch.bg} ${PLATFORM_COLORS.twitch.bgHover}`}>
  Twitch
</Button>

// VK Live
<Button className={`${PLATFORM_COLORS.vk.bg} ${PLATFORM_COLORS.vk.bgHover}`}>
  VK Live
</Button>

// DonationAlerts
<Button className={`${PLATFORM_COLORS.donationalerts.bg} ${PLATFORM_COLORS.donationalerts.bgHover}`}>
  DonationAlerts
</Button>
```

### Цвета статусов

```jsx
import { STATUS_COLORS } from '@/constants/designSystem';

<span className={STATUS_COLORS.success}>Успешно</span>
<span className={STATUS_COLORS.error}>Ошибка</span>
<span className={STATUS_COLORS.warning}>Предупреждение</span>
<span className={STATUS_COLORS.info}>Информация</span>
```

### Цвета секций админки

```jsx
import { ADMIN_SECTION_COLORS } from '@/constants/designSystem';

// Разные цвета для разных секций
<Tab className={ADMIN_SECTION_COLORS.voices}>Голоса</Tab>
<Tab className={ADMIN_SECTION_COLORS.users}>Пользователи</Tab>
<Tab className={ADMIN_SECTION_COLORS.bots}>Боты</Tab>
<Tab className={ADMIN_SECTION_COLORS.logs}>Логи</Tab>
```

## 📐 Сетки и Layout

### Стандартные сетки

```jsx
// 2 колонки на больших экранах
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <Card />
  <Card />
</div>

// 3 колонки на больших экранах
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card />
  <Card />
  <Card />
</div>

// 4 колонки на очень больших экранах
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  <Card />
  <Card />
  <Card />
  <Card />
</div>
```

### Ограничение ширины контента

```jsx
// Узкий контент (например, формы)
<div className="max-w-2xl mx-auto">
  {/* Контент */}
</div>

// Стандартный контент (например, дашборд)
<div className="max-w-6xl mx-auto">
  {/* Контент */}
</div>

// Широкий контент (например, таблицы)
<div className="max-w-7xl mx-auto">
  {/* Контент */}
</div>
```

## 🔄 Анимации и переходы

### Стандартные переходы

```jsx
// Быстрый переход (150ms)
<Button className="transition-all duration-150">

// Стандартный переход (200ms) - ИСПОЛЬЗУЙТЕ ПО УМОЛЧАНИЮ
<Button className="transition-all duration-200">

// Медленный переход (300ms)
<div className="transition-all duration-300">
```

### Hover эффекты

```jsx
// Изменение цвета
<Button className="hover:bg-accent">

// Изменение прозрачности
<div className="hover:opacity-80 transition-opacity">

// НЕ используйте transform для обычных элементов
// ❌ ПЛОХО: <Button className="hover:scale-105">
// ✅ ХОРОШО: <Button className="hover:bg-accent">
```

## 📊 Таблицы

### Стандартные классы для таблиц

```jsx
import { TABLE_CLASSES } from '@/constants/designSystem';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead className={TABLE_CLASSES.header}>Имя</TableHead>
      <TableHead className={TABLE_CLASSES.header}>Email</TableHead>
      <TableHead className={TABLE_CLASSES.header}>Действия</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {users.map(user => (
      <TableRow key={user.id} className={TABLE_CLASSES.row}>
        <TableCell className={TABLE_CLASSES.cell}>{user.name}</TableCell>
        <TableCell className={TABLE_CLASSES.cell}>{user.email}</TableCell>
        <TableCell className={TABLE_CLASSES.cell}>
          <Button className={TABLE_CLASSES.actionButton}>
            <Edit className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Константы таблиц

```typescript
TABLE_CLASSES = {
  header: 'text-left p-3 font-semibold text-sm',
  cell: 'p-3 text-sm',
  row: 'border-b border-gray-700 hover:bg-gray-800/50',
  actionButton: 'h-8 w-8 p-0',  // 32x32px для action buttons
}
```

## ✅ Чек-лист для новых компонентов

- [ ] Используются константы из `designSystem.ts`
- [ ] Используются стандартные размеры кнопок (h-8, h-10, h-12)
- [ ] Используются стандартные отступы (gap-4, gap-6, p-4, p-6)
- [ ] Используются CSS переменные для цветов
- [ ] Используются стандартные размеры шрифтов (text-sm, text-base, text-xl)
- [ ] Hover эффекты не используют transform (кроме специальных случаев)
- [ ] Анимации используют стандартные duration (150ms, 200ms, 300ms)
- [ ] Карточки используют стандартный padding (p-6)
- [ ] Формы используют space-y-2 между полями
- [ ] Action buttons в таблицах используют h-8 w-8 (32x32px)

## 🚫 Что НЕ делать

### ❌ Произвольные значения

```jsx
// ПЛОХО
<div className="p-[13px]">
<div className="gap-[17px]">
<div className="text-[15px]">

// ХОРОШО
<div className="p-4">
<div className="gap-4">
<div className="text-base">
```

### ❌ Несогласованные размеры

```jsx
// ПЛОХО - разные размеры кнопок в одной группе
<div className="flex gap-2">
  <Button className="h-9">Кнопка 1</Button>
  <Button className="h-10">Кнопка 2</Button>
  <Button className="h-11">Кнопка 3</Button>
</div>

// ХОРОШО - одинаковые размеры
<div className="flex gap-2">
  <Button className="h-10">Кнопка 1</Button>
  <Button className="h-10">Кнопка 2</Button>
  <Button className="h-10">Кнопка 3</Button>
</div>
```

### ❌ Избыточные hover эффекты

```jsx
// ПЛОХО - слишком много эффектов
<Button className="hover:scale-110 hover:rotate-3 hover:shadow-2xl">

// ХОРОШО - простой и понятный эффект
<Button className="hover:bg-accent transition-colors">
```

## 📚 Примеры использования

### Форма с правильными отступами

```jsx
<Card>
  <CardHeader>
    <CardTitle>Настройки</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label>Имя</Label>
      <Input className="h-9" />
    </div>
    <div className="space-y-2">
      <Label>Email</Label>
      <Input className="h-9" type="email" />
    </div>
    <Button className="h-10 w-full">
      Сохранить
    </Button>
  </CardContent>
</Card>
```

### Список с карточками

```jsx
<div className="space-y-6">
  <h2 className="text-2xl font-bold">Заголовок</h2>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {items.map(item => (
      <Card key={item.id}>
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </CardContent>
      </Card>
    ))}
  </div>
</div>
```

## 🔧 Инструменты разработки

### Проверка согласованности

Используйте эти команды для проверки:

```bash
# Поиск произвольных значений
grep -r "p-\[" frontend/src/

# Поиск несогласованных размеров кнопок
grep -r "h-[0-9]" frontend/src/components/ui/button.tsx
```

### VS Code snippets

Добавьте в `.vscode/snippets.code-snippets`:

```json
{
  "Standard Button": {
    "prefix": "btn",
    "body": [
      "<Button className=\"h-10 px-4\">",
      "  $1",
      "</Button>"
    ]
  },
  "Standard Card": {
    "prefix": "card",
    "body": [
      "<Card>",
      "  <CardHeader>",
      "    <CardTitle>$1</CardTitle>",
      "  </CardHeader>",
      "  <CardContent className=\"space-y-4\">",
      "    $2",
      "  </CardContent>",
      "</Card>"
    ]
  }
}
```

## 📝 Заметки

- Всегда используйте Tailwind классы вместо inline стилей
- Используйте CSS переменные для цветов темы
- Следуйте 8px grid для всех отступов
- Тестируйте на разных размерах экрана
- Проверяйте accessibility (минимальный размер кликабельных элементов 44x44px)
