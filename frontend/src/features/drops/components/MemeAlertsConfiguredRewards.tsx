import { CheckCircle2, Pencil, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import {
    MUTED_PANEL_CLASS,
    SURFACE_CARD_CLASS,
    getPlatformLabel,
    type PlatformRewardSettings,
} from './memealertsTypes';

interface MemeAlertsConfiguredRewardsProps {
    rewards: PlatformRewardSettings[];
    settingsSaving: boolean;
    deletingId: string | null;
    onToggle: (reward: PlatformRewardSettings, enabled: boolean) => void;
    onEdit: (reward: PlatformRewardSettings) => void;
    onDelete: (reward: PlatformRewardSettings) => void;
}

export const MemeAlertsConfiguredRewards: React.FC<MemeAlertsConfiguredRewardsProps> = ({
    rewards,
    settingsSaving,
    deletingId,
    onToggle,
    onEdit,
    onDelete,
}) => (
    <Card className={SURFACE_CARD_CLASS}>
        <CardHeader className="px-4 pb-2 pt-4">
            <CardTitle className="text-sm">Созданные награды</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4 pt-0">
            {rewards.length === 0 ? (
                <p className="rounded-lg border border-border/70 bg-card/60 px-3 py-3 text-xs text-muted-foreground">
                    Наград пока нет.
                </p>
            ) : (
                rewards.map((reward, index) => (
                    <ConfiguredRewardRow
                        key={reward.local_id || `${reward.platform}-${index}`}
                        reward={reward}
                        settingsSaving={settingsSaving}
                        deletingId={deletingId}
                        onToggle={onToggle}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                ))
            )}
        </CardContent>
    </Card>
);

type ConfiguredRewardRowProps = Omit<MemeAlertsConfiguredRewardsProps, 'rewards'> & {
    reward: PlatformRewardSettings;
};

const ConfiguredRewardRow: React.FC<ConfiguredRewardRowProps> = ({
    reward,
    settingsSaving,
    deletingId,
    onToggle,
    onEdit,
    onDelete,
}) => (
    <div className={cn(MUTED_PANEL_CLASS, 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3')}>
        <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{reward.reward_title || 'MemeCoins'}</span>
                <span className="rounded-md border border-border/60 bg-background/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {getPlatformLabel(reward.platform)}
                </span>
                <span
                    className={cn(
                        'rounded-md px-2 py-0.5 text-[11px]',
                        reward.enabled ? 'bg-emerald-500/15 text-emerald-200' : 'bg-muted/40 text-muted-foreground'
                    )}
                >
                    {reward.enabled ? 'Включена' : 'Выключена'}
                </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
                {reward.reward_cost} баллов {'->'} {reward.coins_amount} мемкоинов
            </p>
        </div>
        <div className="flex gap-2">
            <IconButton
                title={reward.enabled ? 'Выключить' : 'Включить'}
                disabled={settingsSaving}
                onClick={() => onToggle(reward, !reward.enabled)}
            >
                <CheckCircle2 className={cn('h-4 w-4', reward.enabled ? 'text-emerald-300' : 'text-muted-foreground')} />
            </IconButton>
            <IconButton title="Редактировать" onClick={() => onEdit(reward)}>
                <Pencil className="h-4 w-4" />
            </IconButton>
            <IconButton title="Удалить" destructive disabled={deletingId === reward.local_id} onClick={() => onDelete(reward)}>
                <Trash2 className="h-4 w-4" />
            </IconButton>
        </div>
    </div>
);

const IconButton: React.FC<{
    title: string;
    disabled?: boolean;
    destructive?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ title, disabled, destructive, onClick, children }) => (
    <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onClick}
        disabled={disabled}
        className={
            destructive
                ? 'h-8 w-8 border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/15'
                : 'h-8 w-8 border-border/60 bg-card/70'
        }
        title={title}
    >
        {children}
    </Button>
);
