import React, { useState } from 'react';

import { useLootboxData } from '@/features/drops/hooks/useLootboxData';
import { animateLootboxOpening, createSparkleEffect } from '@/features/drops/utils/lootboxImages';
import { CardSkeleton } from '@/shared/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

import CalendarTab from './lootbox/CalendarTab';
import ImageLootboxTab from './lootbox/ImageLootboxTab';
import LootboxHeader from './lootbox/LootboxHeader';
import LootboxResultModal from './lootbox/LootboxResultModal';

interface LootboxSystemProps {
    channelName: string;
}

interface LootboxResult {
    rarity?: string;
    type?: string;
    name?: string;
    description?: string;
    value?: number;
}

const LootboxSystem: React.FC<LootboxSystemProps> = ({ channelName }) => {
    const { isLoading, imageLootboxes, gameFieldData, setGameFieldData } = useLootboxData(channelName);
    const [selectedPlatform, setSelectedPlatform] = useState<'twitch' | 'vk'>('twitch');
    const [openingLootboxId, setOpeningLootboxId] = useState<string | number | null>(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const [lootboxResult] = useState<LootboxResult | null>(null);

    const handleLootboxOpen = (lootboxId: string | number) => {
        setOpeningLootboxId(lootboxId);
        const element = document.getElementById(`image-lootbox-${lootboxId}`);
        if (element) createSparkleEffect(element);
        setTimeout(() => setOpeningLootboxId(null), 3000);
    };

    const openImageLootbox = (lootboxId: string | number) => {
        const element = document.getElementById(`image-lootbox-${lootboxId}`);
        if (element) animateLootboxOpening(element, () => {});
    };

    const handleDayClick = (dayNumber: number, currentViewerName: string | null) => {
        const newViewerName = prompt(
            `Редактировать день ${dayNumber}:\nВведите никнейм зрителя (или оставьте пустым для удаления):`,
            currentViewerName || ''
        );
        if (newViewerName !== null) {
            setGameFieldData((prev) =>
                prev.map((day) =>
                    day.day === dayNumber
                        ? {
                              ...day,
                              viewerName: newViewerName.trim() || null,
                              isActive: !!newViewerName.trim(),
                              hasViewer: !!newViewerName.trim(),
                          }
                        : day
                )
            );
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-8 p-6">
                <div className="space-y-4">
                    <div className="h-8 w-48 bg-muted animate-pulse rounded"></div>
                    <div className="h-4 w-96 bg-muted animate-pulse rounded"></div>
                </div>
                <div className="grid grid-cols-3 gap-3 min-[1280px]:gap-4">
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6">
            <LootboxHeader selectedPlatform={selectedPlatform} onPlatformChange={setSelectedPlatform} />

            <Tabs defaultValue="image-lootboxes" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="image-lootboxes">Анимированные лутбоксы</TabsTrigger>
                    <TabsTrigger value="calendar">Календарь</TabsTrigger>
                    <TabsTrigger value="donation-lootboxes">Донатные лутбоксы</TabsTrigger>
                    <TabsTrigger value="achievement-lootboxes">Лутбоксы за ачивки</TabsTrigger>
                    <TabsTrigger value="settings">Настройки</TabsTrigger>
                    <TabsTrigger value="history">История</TabsTrigger>
                </TabsList>

                <TabsContent value="image-lootboxes" className="space-y-6">
                    <ImageLootboxTab
                        imageLootboxes={imageLootboxes}
                        openingLootboxId={openingLootboxId}
                        onLootboxOpen={handleLootboxOpen}
                        onOpenImageLootbox={openImageLootbox}
                    />
                </TabsContent>

                <TabsContent value="calendar" className="space-y-6">
                    <CalendarTab gameFieldData={gameFieldData} onDayClick={handleDayClick} />
                </TabsContent>

                <TabsContent value="donation-lootboxes" className="space-y-6">
                    <div className="bg-gray-800 rounded-lg p-6">
                        <p className="text-gray-400">Донатные лутбоксы - в разработке</p>
                    </div>
                </TabsContent>

                <TabsContent value="achievement-lootboxes" className="space-y-6">
                    <div className="bg-gray-800 rounded-lg p-6">
                        <p className="text-gray-400">Лутбоксы за достижения - в разработке</p>
                    </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-6">
                    <div className="bg-gray-800 rounded-lg p-6">
                        <p className="text-gray-400">Настройки - в разработке</p>
                    </div>
                </TabsContent>

                <TabsContent value="history" className="space-y-6">
                    <div className="bg-gray-800 rounded-lg p-6">
                        <p className="text-gray-400">История - в разработке</p>
                    </div>
                </TabsContent>
            </Tabs>

            <LootboxResultModal
                open={showResultModal}
                result={lootboxResult}
                onClose={() => setShowResultModal(false)}
            />
        </div>
    );
};

export default LootboxSystem;
