import { CheckCircle2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
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
    connectedProvider?: MemeAlertsAuthProvider | null;
    popupState: PopupAuthState;
    authStatusText: string;
    onConnect: (provider: MemeAlertsAuthProvider) => void;
}

const ProviderIcon: React.FC<{ provider: MemeAlertsAuthProvider }> = ({ provider }) => {
    if (provider === 'google') {
        return (
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
        );
    }

    if (provider === 'twitch') {
        return <TwitchIcon className="h-4 w-4 text-[#9146FF]" />;
    }

    return <VKIcon className="h-4 w-4 text-[#FF3347]" />;
};

const PROVIDER_ROW_CLASS: Record<MemeAlertsAuthProvider, string> = {
    twitch: 'border-[#9146ff]/45 bg-[linear-gradient(90deg,rgba(145,70,255,0.16),rgba(145,70,255,0.05))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
    google: 'border-white/15 bg-[linear-gradient(90deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
    vk: 'border-[#ff3347]/45 bg-[linear-gradient(90deg,rgba(255,51,71,0.16),rgba(255,51,71,0.05))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
};

const PROVIDER_ACTION_CLASS: Record<MemeAlertsAuthProvider, string> = {
    twitch: 'border-[#9146ff]/45 bg-[#9146ff] text-white hover:bg-[#7d35e8]',
    google: 'border-white/20 bg-white text-slate-900 hover:bg-slate-100',
    vk: 'border-[#ff3347]/45 bg-[#ff3347] text-white hover:bg-[#e52a3d]',
};

const PROVIDER_SUBTITLE: Record<MemeAlertsAuthProvider, string> = {
    twitch: 'Вход через Twitch',
    google: 'Вход через Google',
    vk: 'Подключение VK Live',
};

const PROVIDER_ICON_SHELL_CLASS: Record<MemeAlertsAuthProvider, string> = {
    twitch: 'bg-[#9146ff]/18 text-[#c7a7ff] ring-1 ring-[#9146ff]/25',
    google: 'bg-white/90 text-slate-900 ring-1 ring-white/20',
    vk: 'bg-[#ff3347]/18 text-[#ff8d9a] ring-1 ring-[#ff3347]/25',
};

export const MemeAlertsConnectPanel: React.FC<MemeAlertsConnectPanelProps> = ({
    connecting,
    connectedProvider,
    popupState,
    authStatusText,
    onConnect,
}) => (
    <Card className={SURFACE_CARD_CLASS}>
        <CardContent className="space-y-3 p-4">
            <div className="space-y-1">
                <span className="text-xs font-medium uppercase text-muted-foreground">Подключение платформ</span>
                <div className="space-y-2">
                    {MEMEALERTS_PROVIDER_OPTIONS.map((provider) => (
                        <div
                            key={provider}
                            className={cn(
                                'flex items-center justify-between gap-3 rounded-xl border px-3 py-3',
                                PROVIDER_ROW_CLASS[provider]
                            )}
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <div
                                    className={cn(
                                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                                        PROVIDER_ICON_SHELL_CLASS[provider]
                                    )}
                                >
                                    <ProviderIcon provider={provider} />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-semibold text-foreground">
                                            {MEMEALERTS_PROVIDER_LABELS[provider]}
                                        </span>
                                        {connectedProvider === provider ? (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Подключено
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{PROVIDER_SUBTITLE[provider]}</div>
                                </div>
                            </div>
                            <Button
                                type="button"
                                onClick={() => onConnect(provider)}
                                disabled={connecting}
                                className={cn(
                                    'h-9 rounded-md border px-4 text-xs font-bold opacity-100 shadow-sm disabled:opacity-55',
                                    PROVIDER_ACTION_CLASS[provider]
                                )}
                            >
                                {connectedProvider === provider ? 'Повторить' : 'Подключить'}
                            </Button>
                        </div>
                    ))}
                </div>
                {authStatusText ? (
                    <span className={cn('block text-xs', popupState === 'error' ? 'text-red-300' : 'text-muted-foreground')}>
                        {authStatusText}
                    </span>
                ) : null}
            </div>
        </CardContent>
    </Card>
);
