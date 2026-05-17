/**
 * Design System Constants
 * Единые константы для всего проекта
 * Следуем 8px grid system
 */

// Размеры кнопок
export const BUTTON_SIZES = {
    sm: 'h-8 px-3 text-xs', // 32px
    default: 'h-10 px-4 py-2', // 40px - СТАНДАРТ
    lg: 'h-12 px-8', // 48px
    icon: 'h-10 w-10 p-0', // 40x40px - для иконок
    iconSm: 'h-8 w-8 p-0', // 32x32px - маленькие иконки
} as const;

// Размеры полей ввода
export const INPUT_SIZES = {
    sm: 'h-8 text-xs', // 32px
    default: 'h-9', // 36px - СТАНДАРТ
    lg: 'h-11 text-base', // 44px
} as const;

// Отступы
export const SPACING = {
    xs: 'gap-1', // 4px
    sm: 'gap-2', // 8px
    md: 'gap-4', // 16px - СТАНДАРТ
    lg: 'gap-6', // 24px
    xl: 'gap-8', // 32px
} as const;

// Padding для карточек
export const CARD_PADDING = {
    sm: 'p-4', // 16px
    default: 'p-6', // 24px - СТАНДАРТ
    lg: 'p-8', // 32px
} as const;

// Размеры шрифтов
export const FONT_SIZES = {
    xs: 'text-xs', // 12px - метки
    sm: 'text-sm', // 14px - UI текст
    base: 'text-base', // 16px - контент
    lg: 'text-lg', // 18px - подзаголовки
    xl: 'text-xl', // 20px - заголовки карточек
    '2xl': 'text-2xl', // 24px - заголовки секций
    '3xl': 'text-3xl', // 30px - заголовки страниц
} as const;

// Цвета для платформ
export const PLATFORM_COLORS = {
    twitch: {
        bg: 'bg-purple-600',
        bgHover: 'hover:bg-purple-700',
        bgLight: 'bg-purple-600/20',
        text: 'text-purple-400',
        border: 'border-purple-600',
    },
    vk: {
        bg: 'bg-rose-600',
        bgHover: 'hover:bg-rose-700',
        bgLight: 'bg-rose-600/20',
        text: 'text-rose-400',
        border: 'border-rose-600',
    },
    donationalerts: {
        bg: 'bg-orange-500',
        bgHover: 'hover:bg-orange-600',
        bgLight: 'bg-orange-500/20',
        text: 'text-orange-400',
        border: 'border-orange-500',
    },
} as const;

// Цвета для статусов
export const STATUS_COLORS = {
    success: 'text-green-400 bg-green-900/20',
    error: 'text-red-400 bg-red-900/20',
    warning: 'text-yellow-400 bg-yellow-900/20',
    info: 'text-blue-400 bg-blue-900/20',
    neutral: 'text-gray-400 bg-gray-900/20',
} as const;

// Цвета для админки (разные секции)
export const ADMIN_SECTION_COLORS = {
    voices: 'bg-purple-600',
    users: 'bg-blue-600',
    bots: 'bg-green-600',
    storage: 'bg-cyan-600',
    logs: 'bg-slate-600',
    errors: 'bg-red-600',
    monitoring: 'bg-emerald-600',
    blocked: 'bg-rose-600',
} as const;

// Breakpoints для адаптивности
export const BREAKPOINTS = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
} as const;

// Максимальная ширина контента
export const MAX_WIDTH = {
    narrow: 'max-w-2xl', // Формы
    default: 'max-w-6xl', // Дашборд
    wide: 'max-w-7xl', // Таблицы
    full: 'max-w-full', // Полная ширина
} as const;

// Анимации
export const TRANSITIONS = {
    fast: 'transition-all duration-150',
    default: 'transition-all duration-200',
    slow: 'transition-all duration-300',
    colors: 'transition-colors duration-200',
} as const;

// Стандартные классы для таблиц
export const TABLE_CLASSES = {
    header: 'text-left p-3 font-semibold text-sm',
    cell: 'p-3 text-sm',
    row: 'border-b border-gray-700 hover:bg-gray-800/50',
    actionButton: 'h-8 w-8 p-0',
} as const;

// Стандартные классы для форм
export const FORM_CLASSES = {
    group: 'space-y-2',
    label: 'text-sm font-medium',
    hint: 'text-xs text-muted-foreground',
    error: 'text-xs text-red-400',
} as const;
