import { API_BASE_URL } from '@/constants';

type LootboxRarity = 'common' | 'rare' | 'epic' | 'legendary' | string;
type LootboxContext = 'grid' | 'modal' | 'carousel' | 'compact' | string;

const imageSets: Record<string, string[]> = {
    common: [
        '/src/images/lootboxes/common/closed.png',
        '/src/images/lootboxes/common/opening1.png',
        '/src/images/lootboxes/common/opening2.png',
        '/src/images/lootboxes/common/opened.png',
    ],
    rare: [
        '/src/images/lootboxes/rare/closed.png',
        '/src/images/lootboxes/rare/opening1.png',
        '/src/images/lootboxes/rare/opening2.png',
        '/src/images/lootboxes/rare/opening3.png',
        '/src/images/lootboxes/rare/opened.png',
    ],
    epic: [
        '/src/images/lootboxes/epic/closed.png',
        '/src/images/lootboxes/epic/opening1.png',
        '/src/images/lootboxes/epic/opening2.png',
        '/src/images/lootboxes/epic/opening3.png',
        '/src/images/lootboxes/epic/opening4.png',
        '/src/images/lootboxes/epic/opened.png',
    ],
    legendary: [
        '/src/images/lootboxes/legendary/closed.png',
        '/src/images/lootboxes/legendary/opening1.png',
        '/src/images/lootboxes/legendary/opening2.png',
        '/src/images/lootboxes/legendary/opening3.png',
        '/src/images/lootboxes/legendary/opening4.png',
        '/src/images/lootboxes/legendary/opening5.png',
        '/src/images/lootboxes/legendary/opened.png',
    ],
};

export const getLootboxImages = (lootboxType: LootboxRarity): string[] => {
    return imageSets[lootboxType] || imageSets.common;
};

const effects: Record<string, string> = {
    common: '',
    rare: 'lootbox-glow-rare',
    epic: 'lootbox-glow-epic',
    legendary: 'lootbox-glow-legendary',
};

export const getRarityEffects = (rarity: LootboxRarity): string => effects[rarity] || '';

const sizes: Record<string, string> = {
    grid: 'medium',
    modal: 'large',
    carousel: 'small',
    compact: 'small',
};

export const getLootboxSize = (context: LootboxContext): string => sizes[context] || 'medium';

export interface Lootbox {
    id?: number;
    name?: string;
    rarity?: LootboxRarity;
    description?: string;
}

export const createLootboxImageConfig = (lootbox: Lootbox, context: LootboxContext = 'grid') => ({
    images: getLootboxImages(lootbox.rarity ?? 'common'),
    title: lootbox.name || 'Лутбокс',
    rarity: (lootbox.rarity || 'common') as 'common' | 'rare' | 'epic' | 'legendary',
    size: getLootboxSize(context) as 'small' | 'medium' | 'large',
    effects: getRarityEffects(lootbox.rarity || 'common'),
});

export const groupLootboxesByRarity = (lootboxes: Lootbox[]): Record<string, Lootbox[]> => {
    return lootboxes.reduce<Record<string, Lootbox[]>>((groups, lootbox) => {
        const rarity = lootbox.rarity || 'common';
        if (!groups[rarity]) {
            groups[rarity] = [];
        }
        groups[rarity].push(lootbox);
        return groups;
    }, {});
};

export const animateLootboxOpening = (element: HTMLElement | null, onComplete?: () => void): void => {
    if (!element) return;
    element.classList.add('animate-lootbox-open');
    setTimeout(() => {
        element.classList.remove('animate-lootbox-open');
        if (onComplete) onComplete();
    }, 1200);
};

export const animateLootboxAppear = (element: HTMLElement | null, delay: number = 0): void => {
    if (!element) return;
    setTimeout(() => {
        element.classList.add('animate-lootbox-appear');
    }, delay);
};

export const getRandomLootboxImages = (rarity: LootboxRarity): string[] => getLootboxImages(rarity);

export const createLootboxesFromAPI = async (): Promise<Lootbox[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/drops/lootboxes`, {
            credentials: 'include',
        });
        if (response.ok) {
            const data = await response.json();
            return data.lootboxes || [];
        }
        return [];
    } catch {
        return [];
    }
};

export const preloadLootboxImages = (imagePaths: string[]): Promise<string[]> => {
    return Promise.all(
        imagePaths.map(
            (path) =>
                new Promise<string>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(path);
                    img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
                    img.src = path;
                })
        )
    );
};

export const createSparkleEffect = (element: HTMLElement | null): void => {
    if (!element) return;
    const sparkle = document.createElement('div');
    sparkle.className = 'absolute inset-0 pointer-events-none animate-sparkle';
    sparkle.textContent = '✨';
    sparkle.style.fontSize = '2rem';
    sparkle.style.display = 'flex';
    sparkle.style.alignItems = 'center';
    sparkle.style.justifyContent = 'center';
    element.appendChild(sparkle);
    setTimeout(() => {
        if (sparkle.parentNode) {
            sparkle.parentNode.removeChild(sparkle);
        }
    }, 600);
};

export const createMockLootboxes = (): Lootbox[] => [
    { id: 1, name: 'Обычный лутбокс', rarity: 'common', description: 'Базовый лутбокс с обычными наградами' },
    { id: 2, name: 'Редкий лутбокс', rarity: 'rare', description: 'Лутбокс с редкими наградами' },
    { id: 3, name: 'Эпический лутбокс', rarity: 'epic', description: 'Лутбокс с эпическими наградами' },
    { id: 4, name: 'Легендарный лутбокс', rarity: 'legendary', description: 'Лутбокс с легендарными наградами' },
];
