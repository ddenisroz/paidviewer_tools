// src/components/lootbox/ImageLootboxTab.tsx
import React from 'react';

import { Gift, Star, X } from 'lucide-react';

import { createLootboxImageConfig } from '@/features/drops/utils/lootboxImages';
import { Button } from '@/shared/components/ui/button';

import ImageLootbox from '../ImageLootbox';

interface ImageLootbox {
    id: string | number;
    rarity?: string;
    [key: string]: unknown;
}

interface ImageLootboxTabProps {
    imageLootboxes: ImageLootbox[];
    openingLootboxId: string | number | null;
    onLootboxOpen: (id: string | number) => void;
    onOpenImageLootbox: (id: string | number) => void;
}

const ImageLootboxTab: React.FC<ImageLootboxTabProps> = ({
    imageLootboxes,
    openingLootboxId,
    onLootboxOpen,
    onOpenImageLootbox,
}) => {
    return (
        <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Анимированные лутбоксы</h3>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => imageLootboxes.forEach((lb) => onLootboxOpen(lb.id))}
                    >
                        <Gift className="w-4 h-4 mr-2" />
                        Открыть все
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onLootboxOpen(null as unknown as string | number)}
                    >
                        <X className="w-4 h-4 mr-2" />
                        Сбросить
                    </Button>
                </div>
            </div>

            <div className="mb-6">
                <p className="text-gray-400 text-sm">
                    Нажмите на лутбокс, чтобы увидеть анимацию открытия. Картинки будут сменяться, создавая эффект
                    открытия.
                </p>
            </div>

            <div className="grid grid-cols-4 gap-3 min-[1280px]:gap-6">
                {imageLootboxes.map((lootbox) => {
                    const lootboxForConfig = {
                        ...lootbox,
                        id: typeof lootbox.id === 'number' ? lootbox.id : undefined,
                    };
                    const config = createLootboxImageConfig(lootboxForConfig, 'grid');
                    return (
                        <div key={lootbox.id} id={`image-lootbox-${lootbox.id}`} className="animate-lootbox-appear">
                            <ImageLootbox
                                images={config.images}
                                title={config.title}
                                rarity={config.rarity}
                                size={config.size}
                                isOpening={openingLootboxId === lootbox.id}
                                onOpen={() => onLootboxOpen(lootbox.id)}
                                className={`${config.effects} cursor-pointer`}
                            />

                            <div className="mt-2 text-center">
                                <Button
                                    onClick={() => onOpenImageLootbox(lootbox.id)}
                                    className="w-full bg-purple-600 hover:bg-purple-700"
                                    size="sm"
                                    variant="outline"
                                >
                                    <Star className="w-4 h-4 mr-2" />
                                    Анимация открытия
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 p-4 bg-gray-700 rounded-lg">
                <h4 className="text-sm font-semibold text-white mb-2">О системе анимации</h4>
                <p className="text-sm text-gray-300">
                    Система использует смену картинок для создания эффекта открытия лутбокса. Каждый лутбокс имеет набор
                    картинок: закрытый → этапы открытия → открытый. Добавьте свои картинки в папку{' '}
                    <code className="bg-gray-800 px-1 rounded">/src/images/lootboxes/</code>
                </p>
            </div>
        </div>
    );
};

export default ImageLootboxTab;
