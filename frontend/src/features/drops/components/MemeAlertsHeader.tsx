import { CheckCircle2, XCircle } from 'lucide-react';

import { MemeAlertsMark } from '@/shared/components/icons/FeatureMarks';
import { Button } from '@/shared/components/ui/button';

interface MemeAlertsHeaderProps {
    isConnected: boolean;
    connectedProviderLabel: string | null;
    connecting: boolean;
    onDisconnect: () => void;
}

export const MemeAlertsHeader: React.FC<MemeAlertsHeaderProps> = ({
    isConnected,
    connectedProviderLabel,
    connecting,
    onDisconnect,
}) => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex min-w-0 items-center gap-3">
            <MemeAlertsMark className="h-8 w-8 text-base" />
            <div className="min-w-0">
                <p className="font-brand text-sm font-bold tracking-wide text-foreground">MemeAlerts</p>
                {isConnected ? (
                    <p className="truncate text-xs text-muted-foreground">
                        {connectedProviderLabel ? `Вход через ${connectedProviderLabel}` : 'Способ входа не сохранён'}
                    </p>
                ) : null}
            </div>
        </div>
        <div className="flex items-center gap-2">
            <div
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                    isConnected ? 'text-emerald-300' : 'text-red-300'
                }`}
            >
                {isConnected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {isConnected ? 'Токен активен' : 'Токен не подключён'}
            </div>
            {isConnected ? (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onDisconnect}
                    disabled={connecting}
                    className="h-8 border-border/60 bg-card/70 hover:bg-accent"
                >
                    Отключить
                </Button>
            ) : null}
        </div>
    </div>
);
