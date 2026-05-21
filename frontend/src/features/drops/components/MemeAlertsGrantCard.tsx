import { HandCoins } from 'lucide-react';

import { AutomationCard } from '@/features/drops/components/MemeAlertsAutomationCard';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

import { FIELD_CLASS } from './memealertsTypes';

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
    <AutomationCard icon={HandCoins} title="Ручная выдача">
        <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
            <Input
                placeholder="nickname"
                value={grantTarget}
                onChange={(event) => onGrantTargetChange(event.target.value)}
                className={FIELD_CLASS}
            />
            <Input
                type="number"
                min={1}
                max={1_000_000}
                value={grantValue}
                onChange={(event) => onGrantValueChange(Math.max(1, Number(event.target.value) || 1))}
                className={FIELD_CLASS}
            />
        </div>
        <Button onClick={onGrant} disabled={granting} className="h-9 w-full bg-blue-700 text-white hover:bg-blue-800">
            {granting ? 'Выдаю...' : 'Выдать мемкоины'}
        </Button>
    </AutomationCard>
);
