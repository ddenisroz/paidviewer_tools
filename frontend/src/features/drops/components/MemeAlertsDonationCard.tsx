import { MemeAlertsMark } from '@/shared/components/icons/FeatureMarks';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';

import { AutomationCard } from './MemeAlertsAutomationCard';
import { FIELD_CLASS } from './memealertsTypes';

interface MemeAlertsDonationCardProps {
    donationAlertsConnected: boolean;
    enabled: boolean;
    courseRub: number;
    saving: boolean;
    authStarted: boolean;
    onConnectDonationAlerts: () => void;
    onCourseRubChange: (value: number) => void;
    onToggleEnabled: () => void;
    onSave: () => void;
}

export const MemeAlertsDonationCard: React.FC<MemeAlertsDonationCardProps> = ({
    donationAlertsConnected,
    enabled,
    courseRub,
    saving,
    authStarted,
    onConnectDonationAlerts,
    onCourseRubChange,
    onToggleEnabled,
    onSave,
}) => (
    <AutomationCard icon={MemeAlertsMark} title="Выдача за донаты" disabled={!donationAlertsConnected} contentClassName="grid grid-rows-[1fr_auto]">
        <div className="grid content-start gap-3">
            <div className="space-y-1.5">
                <Label className="text-xs">₽ за 1 мемкоин</Label>
                <Input
                    type="number"
                    min={1}
                    value={courseRub}
                    disabled={!donationAlertsConnected}
                    onChange={(event) => onCourseRubChange(Math.max(1, Number(event.target.value) || 1))}
                    className={`${FIELD_CLASS} h-10 w-full rounded-lg px-3 text-base font-semibold`}
                />
            </div>
            <div className="flex h-10 items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/45 px-3">
                <span className="min-w-0 text-xs font-semibold text-foreground">Выдача за донаты</span>
                <Switch checked={enabled && donationAlertsConnected} disabled={!donationAlertsConnected} onCheckedChange={onToggleEnabled} />
            </div>
        </div>
        <Button
            type="button"
            onClick={donationAlertsConnected ? onSave : onConnectDonationAlerts}
            disabled={saving || authStarted}
            className="h-9 w-full overflow-hidden text-ellipsis whitespace-nowrap bg-blue-700 px-2 text-white hover:bg-blue-800"
        >
            {donationAlertsConnected
                ? saving
                    ? 'Сохраняю...'
                    : 'Сохранить'
                : authStarted
                  ? 'Запущена авторизация...'
                  : 'Подключить DA'}
        </Button>
    </AutomationCard>
);
