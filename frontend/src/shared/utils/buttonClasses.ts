/**
 * Button Classes Utility
 * Генерирует классы для кнопок на основе designSystem
 */

import { BUTTON_SIZES, TRANSITIONS } from '@/constants/designSystem';
import { cn } from '@/lib/utils';

/**
 * Получить классы для кнопки-иконки
 * @param size - 'sm' (32x32) или 'default' (40x40)
 * @param additionalClasses - дополнительные классы
 */
export const getIconButtonClasses = (size: 'sm' | 'default' = 'default', additionalClasses?: string): string => {
    const baseClasses = size === 'sm' ? BUTTON_SIZES.iconSm : BUTTON_SIZES.icon;
    return cn(baseClasses, TRANSITIONS.colors, additionalClasses);
};

/**
 * Получить классы для кнопки действия в таблице
 * @param additionalClasses - дополнительные классы
 */
export const getTableActionButtonClasses = (additionalClasses?: string): string => {
    return cn(BUTTON_SIZES.iconSm, 'p-0', TRANSITIONS.colors, additionalClasses);
};

/**
 * Получить классы для обычной кнопки
 * @param size - размер кнопки
 * @param additionalClasses - дополнительные классы
 */
export const getButtonClasses = (size: 'sm' | 'default' | 'lg' = 'default', additionalClasses?: string): string => {
    return cn(BUTTON_SIZES[size], TRANSITIONS.colors, additionalClasses);
};
