import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';

import {
    MEMEALERTS_PROVIDER_LABELS,
    MEMEALERTS_PROVIDER_OPTIONS,
    SURFACE_CARD_CLASS,
    type MemeAlertsAuthProvider,
    type PopupAuthState,
} from './memealertsTypes';

interface MemeAlertsConnectPanelProps {
    connecting: boolean;
    popupState: PopupAuthState;
    authStatusText: string;
    onConnect: (provider: MemeAlertsAuthProvider) => void;
}

export const MemeAlertsConnectPanel: React.FC<MemeAlertsConnectPanelProps> = ({
    connecting,
    popupState,
    authStatusText,
    onConnect,
}) => (
    <Card className={SURFACE_CARD_CLASS}>
        <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase text-muted-foreground">Войти через</span>
                {MEMEALERTS_PROVIDER_OPTIONS.map((provider) => (
                    <Button
                        key={provider}
                        type="button"
                        onClick={() => onConnect(provider)}
                        disabled={connecting}
                        className="h-8 rounded-md bg-blue-700 px-4 text-xs font-bold text-white hover:bg-blue-800"
                    >
                        {MEMEALERTS_PROVIDER_LABELS[provider]}
                    </Button>
                ))}
                {authStatusText ? (
                    <span className={cn('ml-1 text-xs', popupState === 'error' ? 'text-red-300' : 'text-muted-foreground')}>
                        {authStatusText}
                    </span>
                ) : null}
            </div>
        </CardContent>
    </Card>
);
