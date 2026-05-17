// src/utils/rarityHelpers.ts

type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

interface _RarityConfig {
    color: string;
    icon: React.ReactNode;
}

/**
 * Get rarity color class
 */
export function getRarityColor(rarity: string): string {
    const rarityColors: Record<string, string> = {
        common: 'bg-gray-500',
        rare: 'bg-blue-500',
        epic: 'bg-purple-500',
        legendary: 'bg-yellow-500',
    };

    return rarityColors[rarity.toLowerCase()] || 'bg-gray-500';
}

/**
 * Get button color for rarity
 */
export function getRarityButtonColor(rarity: Rarity): string {
    const buttonColors: Record<Rarity, string> = {
        legendary: 'bg-yellow-600 hover:bg-yellow-700',
        epic: 'bg-purple-600 hover:bg-purple-700',
        rare: 'bg-blue-700 hover:bg-blue-800',
        common: 'bg-gray-600 hover:bg-gray-700',
    };

    return buttonColors[rarity] || buttonColors.common;
}

/**
 * Get button text based on state
 */
export function getLootboxButtonText(isAnimating: boolean, hasFinalResult: boolean): string {
    if (isAnimating) return 'Открывается...';
    if (hasFinalResult) return 'Открыто!';
    return 'Открыть лутбокс';
}
