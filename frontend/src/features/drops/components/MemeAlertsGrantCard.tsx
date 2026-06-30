import { HandCoins } from 'lucide-react';

import { AutomationCard } from '@/features/drops/components/MemeAlertsAutomationCard';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { FIELD_CLASS } from './memealertsTypes';

const MANUAL_FIELD_CLASS = `${FIELD_CLASS} h-10 w-full rounded-lg px-3 text-base font-semibold leading-none placeholder:text-muted-foreground`;

interface MemeAlertsGrantCardProps {
    grantTarget: string;
    grantValue: number;
    granting: boolean;
    onGrantTargetChange: (value: string) => void;
    onGrantValueChange: (value: number) => void;
    onGrant: () => void;
}

export const MemeAlertsGrantCard: React.FC<MemeAlertsGrantCardProps> = ({
    grantTarget,
    grantValue,
    granting,
    onGrantTargetChange,
    onGrantValueChange,
    onGrant,
}) => (
    <AutomationCard icon={HandCoins} title="Ручная выдача" contentClassName="grid grid-rows-[1fr_auto]">
        <div className="grid content-start gap-3">
            <div className="space-y-1.5">
                <Label className="text-xs">Никнейм MemeAlerts</Label>
                <Input
                    placeholder="nickname"
                    value={grantTarget}
                    onChange={(event) => onGrantTargetChange(event.target.value)}
                    className={MANUAL_FIELD_CLASS}
                />
            </div>
            <NumberField label="Мемкоинов" value={grantValue} onChange={onGrantValueChange} />
        </div>
        <Button
            type="button"
            onClick={onGrant}
            disabled={granting}
            className="h-9 w-full bg-blue-700 text-white hover:bg-blue-800"
        >
            {granting ? 'Выдаю...' : 'Выдать мемкоины'}
        </Button>
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
            max={1_000_000}
            value={value}
            onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))}
            className={MANUAL_FIELD_CLASS}
        />
    </div>
);
