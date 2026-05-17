// src/hooks/useLootboxData.ts
import { useCallback, useEffect, useState } from 'react';

import { createMockLootboxes } from '@/features/drops/utils/lootboxImages';
import { lootboxService } from '@/services/api/services/lootboxService';
import { logger } from '@/shared/utils/prodLogger';

interface LootboxOpening {
    id: number;
    user_name: string;
    reward_name: string;
    lootbox_type: string;
    rarity: string;
    opened_at: string;
}

interface ImageLootbox {
    id: string | number;
    rarity?: string;
    [key: string]: unknown;
}

interface GameDayData {
    day: number;
    viewerName: string | null;
    isActive: boolean;
    hasViewer: boolean;
}

const createInitialGameData = (): GameDayData[] => {
    return Array.from({ length: 30 }, (_, i) => {
        const dayNumber = i + 1;
        const viewers = ['Player1', 'Gamer2', 'Streamer3', 'Viewer4', 'Fan5'];
        const hasViewer = Math.random() > 0.6;
        const viewerName = hasViewer ? viewers[Math.floor(Math.random() * viewers.length)] : null;
        const isActive = hasViewer && Math.random() > 0.5;
        return { day: dayNumber, viewerName, isActive, hasViewer };
    });
};

export const useLootboxData = (channelName: string) => {
    const [recentOpenings, setRecentOpenings] = useState<LootboxOpening[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [imageLootboxes, setImageLootboxes] = useState<ImageLootbox[]>([]);
    const [gameFieldData, setGameFieldData] = useState<GameDayData[]>(createInitialGameData);

    const loadData = useCallback(async (): Promise<void> => {
        try {
            setIsLoading(true);
            const [openingsRes] = await Promise.all([
                lootboxService.getRecentOpenings(channelName, { limit: 5 }),
                lootboxService.getProgression(channelName),
                lootboxService.getLootboxes(channelName),
            ]);
            const responseData = openingsRes.data as {
                data?: { openings?: LootboxOpening[] };
                openings?: LootboxOpening[];
            };
            const openingsData = responseData.data || responseData;
            setRecentOpenings((openingsData?.openings || []) as LootboxOpening[]);
        } catch (error) {
            logger.error('Error loading lootbox data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [channelName]);

    useEffect(() => {
        void loadData();
        setImageLootboxes(createMockLootboxes() as ImageLootbox[]);
    }, [loadData]);

    return {
        recentOpenings,
        isLoading,
        imageLootboxes,
        gameFieldData,
        setGameFieldData,
    };
};
