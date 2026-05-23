import { MemeAlertsMark } from '@/shared/components/icons/FeatureMarks';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

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
    <AutomationCard icon={MemeAlertsMark} title="Выдача за донаты" disabled={!donationAlertsConnected}>
        {!donationAlertsConnected ? (
            <div className="space-y-1.5">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onConnectDonationAlerts}
                    className="h-9 w-full border-orange-500/35 bg-orange-500/10 text-orange-100 hover:bg-orange-500/15"
                >
                    Подключить DonationAlerts
                </Button>
                {authStarted ? <p className="text-xs text-muted-foreground">Запущена авторизация...</p> : null}
            </div>
        ) : null}
        <div className="space-y-1.5">
            <Label className="text-xs">Курс, ₽ за 1 мемкоин</Label>
            <Input
                type="number"
                min={1}
                value={courseRub}
                onChange={(event) => onCourseRubChange(Math.max(1, Number(event.target.value) || 1))}
                className={FIELD_CLASS}
            />
        </div>
        <Button
            type="button"
            variant="outline"
            disabled={!donationAlertsConnected}
            onClick={onToggleEnabled}
            className={`h-9 w-full border-border/70 ${
                enabled ? 'bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20' : 'bg-card/70 hover:bg-accent'
            }`}
        >
            {enabled ? 'Выдача включена' : 'Выдача выключена'}
        </Button>
        <Button
            type="button"
            onClick={onSave}
            disabled={saving || !donationAlertsConnected}
            className="mt-auto h-9 w-full bg-blue-700 text-white hover:bg-blue-800"
        >
            {saving ? 'Сохраняю...' : 'Сохранить'}
        </Button>
    </AutomationCard>
);
