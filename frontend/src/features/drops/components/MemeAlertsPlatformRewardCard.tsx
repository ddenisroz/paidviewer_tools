import { Gift } from 'lucide-react';

import { AutomationCard } from '@/features/drops/components/MemeAlertsAutomationCard';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

import { FIELD_CLASS } from './memealertsTypes';

interface MemeAlertsPlatformRewardCardProps {
    platform: 'twitch' | 'vk';
    platformConnected: boolean;
    platformAvailability: Record<'twitch' | 'vk', boolean>;
    title: string;
    cost: number;
    coinsAmount: number;
    canCreateMoreRewards: boolean;
    creating: boolean;
    settingsLoading: boolean;
    editingRewardId: string | null;
    onPlatformChange: (platform: 'twitch' | 'vk') => void;
    onTitleChange: (value: string) => void;
    onCostChange: (value: number) => void;
    onCoinsAmountChange: (value: number) => void;
    onCreate: () => void;
    onCancelEdit: () => void;
}

export const MemeAlertsPlatformRewardCard: React.FC<MemeAlertsPlatformRewardCardProps> = ({
    platform,
    platformConnected,
    platformAvailability,
    title,
    cost,
    coinsAmount,
    canCreateMoreRewards,
    creating,
    settingsLoading,
    editingRewardId,
    onPlatformChange,
    onTitleChange,
    onCostChange,
    onCoinsAmountChange,
    onCreate,
    onCancelEdit,
}) => (
    <AutomationCard icon={Gift} title="Награда за баллы" contentClassName="grid grid-rows-[1fr_auto]">
        <div className="grid content-start gap-3">
            <TooltipProvider delayDuration={150}>
                <div className="grid grid-cols-2 gap-2">
                    {(['twitch', 'vk'] as const).map((option) => {
                        const available = platformAvailability[option];
                        const active = platform === option;
                        const button = (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => available && onPlatformChange(option)}
                                disabled={!available}
                                className={cn(
                                    'h-9 w-full border-border/70',
                                    active
                                        ? option === 'twitch'
                                            ? 'border-[#9146FF] bg-[#9146FF] text-white hover:bg-[#7f3ee8]'
                                            : 'border-[#FF4444] bg-[#FF4444] text-white hover:bg-[#e13d3d]'
                                        : 'bg-card/70 hover:bg-accent',
                                    !available && 'cursor-not-allowed opacity-45'
                                )}
                            >
                                {option === 'twitch' ? 'Twitch' : 'VK Live'}
                            </Button>
                        );

                        if (available) return button;

                        return (
                            <Tooltip key={option}>
                                <TooltipTrigger asChild>
                                    <span>{button}</span>
                                </TooltipTrigger>
                                <TooltipContent>{option === 'vk' ? 'VK Live не подключен' : 'Twitch не подключен'}</TooltipContent>
                            </Tooltip>
                        );
                    })}
                </div>
            </TooltipProvider>

            <div className="space-y-1.5">
                <Label className="text-xs">Название награды</Label>
                <Input value={title} onChange={(event) => onTitleChange(event.target.value)} className={FIELD_CLASS} />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <NumberField label="Баллов" value={cost} onChange={onCostChange} />
                <NumberField label="Мемкоинов" value={coinsAmount} onChange={onCoinsAmountChange} />
            </div>
        </div>
        <div className="flex gap-2">
            <Button
                type="button"
                onClick={onCreate}
                disabled={creating || settingsLoading || !platformConnected || !canCreateMoreRewards}
                className="h-9 flex-1 bg-blue-700 text-white hover:bg-blue-800"
            >
                {creating ? 'Сохраняю...' : editingRewardId ? 'Сохранить' : 'Создать'}
            </Button>
            {editingRewardId ? (
                <Button type="button" variant="outline" onClick={onCancelEdit} className="h-9 border-border/70 bg-card/70">
                    Отмена
                </Button>
            ) : null}
        </div>
    </AutomationCard>
);

const NumberField: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({
    label,
    value,
    onChange,
}) => (
    <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
            type="number"
            min={1}
            value={value}
            onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))}
            className={FIELD_CLASS}
        />
    </div>
);
