import { Gift } from 'lucide-react';

import { AutomationCard } from '@/features/drops/components/MemeAlertsAutomationCard';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { FIELD_CLASS } from './memealertsTypes';

interface MemeAlertsPlatformRewardCardProps {
    platform: 'twitch' | 'vk';
    platformConnected: boolean;
    platformName: string;
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
    platformName,
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
    <AutomationCard icon={Gift} title="Награда на платформе">
        <div className="grid grid-cols-2 gap-2">
            {(['twitch', 'vk'] as const).map((option) => (
                <Button
                    key={option}
                    variant="outline"
                    size="sm"
                    onClick={() => onPlatformChange(option)}
                    className={cn(
                        'h-8 border-border/70',
                        platform === option
                            ? option === 'twitch'
                                ? 'border-[#9146FF] bg-[#9146FF] text-white hover:bg-[#7f3ee8]'
                                : 'border-[#FF4444] bg-[#FF4444] text-white hover:bg-[#e13d3d]'
                            : 'bg-card/70 hover:bg-accent'
                    )}
                >
                    {option === 'twitch' ? 'Twitch' : 'VK Live'}
                </Button>
            ))}
        </div>
        {!platformConnected ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                Подключите {platformName}, чтобы создать награду.
            </div>
        ) : null}
        <div className="space-y-1.5">
            <Label className="text-xs">Название награды</Label>
            <Input value={title} onChange={(event) => onTitleChange(event.target.value)} className={FIELD_CLASS} />
        </div>
        <div className="grid grid-cols-2 gap-2">
            <NumberField label="Баллов" value={cost} onChange={onCostChange} />
            <NumberField label="Мемкоинов" value={coinsAmount} onChange={onCoinsAmountChange} />
        </div>
        <div className="flex gap-2">
            <Button
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
        {!canCreateMoreRewards ? <p className="text-xs text-amber-200">Уже создано 3 награды.</p> : null}
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
