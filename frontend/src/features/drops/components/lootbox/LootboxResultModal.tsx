// src/components/lootbox/LootboxResultModal.tsx
import React from 'react';

import { Coins, Gift, Sparkles, Star, Trophy } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';

interface LootboxResult {
    rarity?: string;
    type?: string;
    name?: string;
    description?: string;
    value?: number;
}

interface LootboxResultModalProps {
    open: boolean;
    result: LootboxResult | null;
    onClose: () => void;
}

const getRarityColor = (rarity: string): string => {
    const colors: { [key: string]: string } = {
        common: 'text-gray-500',
        rare: 'text-blue-500',
        epic: 'text-purple-500',
        legendary: 'text-yellow-500',
        mythical: 'text-pink-500',
    };
    return colors[rarity] || 'text-gray-500';
};

const getRewardIcon = (rewardType: string) => {
    const icons: { [key: string]: typeof Coins } = {
        coins: Coins,
        items: Gift,
        special: Star,
        exclusive: Trophy,
    };
    return icons[rewardType] || Gift;
};

const LootboxResultModal: React.FC<LootboxResultModalProps> = ({ open, result, onClose }) => {
    if (!result) return null;

    const Icon = getRewardIcon(result.type || 'items');

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse" />
                        Поздравляем!
                    </DialogTitle>
                    <DialogDescription>Вы получили награду из лутбокса</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex flex-col items-center justify-center space-y-3">
                        <div className={`text-6xl ${getRarityColor(result.rarity || 'common')}`}>
                            <Icon className="w-20 h-20 animate-bounce" />
                        </div>

                        <Badge
                            variant="outline"
                            className={`text-lg px-4 py-1 ${getRarityColor(result.rarity || 'common')}`}
                        >
                            {(result.rarity || 'common').toUpperCase()}
                        </Badge>
                    </div>

                    <div className="bg-muted p-4 rounded-lg space-y-2">
                        <h3 className="font-semibold text-lg text-center">{result.name || 'Неизвестная награда'}</h3>

                        {result.description && (
                            <p className="text-sm text-muted-foreground text-center">{result.description}</p>
                        )}

                        {result.value && (
                            <div className="flex items-center justify-center gap-2 text-sm">
                                <Coins className="h-4 w-4 text-yellow-500" />
                                <span className="font-medium">{result.value} монет</span>
                            </div>
                        )}
                    </div>

                    <Button className="w-full" onClick={onClose}>
                        Отлично!
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default LootboxResultModal;
