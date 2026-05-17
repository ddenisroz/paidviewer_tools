import React from 'react';

import { AlertTriangle, Copy, Link as LinkIcon, LogIn, RefreshCw } from 'lucide-react';

import { ADMIN_ACTION_BUTTON_CLASS, ADMIN_CARD_CLASS } from '@/features/admin/components/admin-ui';
import { formatTokenLifetime, PLATFORM_META, statusBadgeClass } from '@/features/admin/types/adminReadModels';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import type { AdminPlatform, RuntimePayload, TokenStatus } from '@/features/admin/types/adminReadModels';

export { RuntimeWorkersCard } from './RuntimeWorkerCards';

const numberValue = (value: number | undefined): number => value ?? 0;

const tokenLoginLabel = (token?: TokenStatus): string => token?.bot_login ?? 'Бот ещё не авторизован';
const tokenLifetimeLabel = (token?: TokenStatus): string =>
    token?.configured ? formatTokenLifetime(token.seconds_left) : 'OAuth нужен перед запуском';
const runtimeReady = (connected?: boolean, isReady?: boolean, isRunning?: boolean): boolean =>
    Boolean(connected && (isReady !== false || isRunning));
const channelSummary = (channels: number, configured: boolean): string =>
    `${channels} каналов, доступ ${configured ? 'настроен' : 'не настроен'}`;
const linkVisible = (platform: AdminPlatform, link: { platform: AdminPlatform; url: string } | null): boolean =>
    link?.platform === platform;
const tokenMissingScopes = (token?: TokenStatus): string[] => token?.missing_scopes?.filter(Boolean) ?? [];

const tokenStateLabel = (token: TokenStatus | undefined, ready: boolean, missingScopes: string[]): string => {
    if (!token?.configured) return 'Нужна авторизация';
    if (missingScopes.length > 0) return 'Нет прав чата';
    if (ready) return 'Подключён и готов';
    if (token.needs_refresh) return 'Нужно обновить токен';
    return 'Требует внимания';
};

const tokenStateDetails = (token: TokenStatus | undefined, missingScopes: string[]): string => {
    if (!token?.configured) return 'Авторизуйте бота перед запуском.';
    if (missingScopes.length > 0) return `Нет прав: ${missingScopes.join(', ')}`;
    return `Обновляемый ключ: ${token.has_refresh_token ? 'есть' : 'нет'}`;
};

const TokenSummary: React.FC<{ token?: TokenStatus; ready: boolean }> = ({ token, ready }) => {
    const missingScopes = tokenMissingScopes(token);

    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-background/55 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Токен</p>
                    <p className="mt-2 text-sm font-medium text-foreground">{tokenLoginLabel(token)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{tokenLifetimeLabel(token)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/55 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Состояние</p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                        {tokenStateLabel(token, ready, missingScopes)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{tokenStateDetails(token, missingScopes)}</p>
                </div>
            </div>
            {missingScopes.length > 0 ? (
                <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-amber-100">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        <p>
                            Twitch бот авторизован, но не может читать и писать в чат. Переавторизуйте бота и выдайте
                            права {missingScopes.join(', ')}.
                        </p>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

const RuntimeActions: React.FC<{
    platform: AdminPlatform;
    configured: boolean;
    needsReauth: boolean;
    accent: string;
    busy: Record<string, boolean>;
    showCopy: boolean;
    onAuthorize: (platform: AdminPlatform) => void;
    onRefreshToken: (platform: AdminPlatform) => Promise<void>;
    onCreateLink: (platform: AdminPlatform) => Promise<void>;
    onCopyLink: () => Promise<void>;
}> = ({
    platform,
    configured,
    needsReauth,
    accent,
    busy,
    showCopy,
    onAuthorize,
    onRefreshToken,
    onCreateLink,
    onCopyLink,
}) => (
    <div className="flex flex-wrap gap-2">
        {configured && needsReauth ? (
            <Button
                size="sm"
                onClick={() => onAuthorize(platform)}
                style={{ backgroundColor: accent, borderColor: accent }}
            >
                <LogIn className="mr-2 h-4 w-4" />
                Переавторизовать бота
            </Button>
        ) : null}
        {configured ? (
            <Button
                variant="outline"
                size="sm"
                className={ADMIN_ACTION_BUTTON_CLASS}
                onClick={() => void onRefreshToken(platform)}
                disabled={busy[`refresh-${platform}`]}
            >
                <RefreshCw className={`mr-2 h-4 w-4 ${busy[`refresh-${platform}`] ? 'animate-spin' : ''}`} />
                Обновить токен
            </Button>
        ) : (
            <Button
                size="sm"
                onClick={() => onAuthorize(platform)}
                style={{ backgroundColor: accent, borderColor: accent }}
            >
                <LogIn className="mr-2 h-4 w-4" />
                Авторизовать бота
            </Button>
        )}
        <Button
            variant="outline"
            size="sm"
            className={ADMIN_ACTION_BUTTON_CLASS}
            onClick={() => void onCreateLink(platform)}
            disabled={busy[`link-${platform}`]}
        >
            <LinkIcon className="mr-2 h-4 w-4" />
            Разовая ссылка
        </Button>
        {showCopy ? (
            <Button variant="outline" size="sm" className={ADMIN_ACTION_BUTTON_CLASS} onClick={() => void onCopyLink()}>
                <Copy className="mr-2 h-4 w-4" />
                Скопировать
            </Button>
        ) : null}
    </div>
);

export const RuntimePlatformCard: React.FC<{
    platform: AdminPlatform;
    data: RuntimePayload;
    busy: Record<string, boolean>;
    oneTimeLink: { platform: AdminPlatform; url: string } | null;
    onAuthorize: (platform: AdminPlatform) => void;
    onRefreshToken: (platform: AdminPlatform) => Promise<void>;
    onCreateLink: (platform: AdminPlatform) => Promise<void>;
    onCopyLink: () => Promise<void>;
}> = ({ platform, data, busy, oneTimeLink, onAuthorize, onRefreshToken, onCreateLink, onCopyLink }) => {
    const runtime = data.bots?.[platform];
    const token = data.tokens?.[platform];
    const meta = PLATFORM_META[platform];
    const missingScopes = tokenMissingScopes(token);
    const ready =
        runtimeReady(runtime?.connected, runtime?.is_ready, runtime?.is_running) && missingScopes.length === 0;
    const configured = Boolean(token?.configured);
    const channels = numberValue(runtime?.channels);
    const hasCopyLink = linkVisible(platform, oneTimeLink);
    const badgeClass =
        missingScopes.length > 0 ? 'border-amber-500/35 bg-amber-500/10 text-amber-200' : statusBadgeClass(ready);
    const badgeLabel = missingScopes.length > 0 ? 'нет прав чата' : ready ? 'бот готов' : 'нужна проверка';

    return (
        <Card className={ADMIN_CARD_CLASS}>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <CardTitle className="text-base" style={{ color: meta.accent }}>
                            {meta.label}
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{channelSummary(channels, configured)}</p>
                    </div>
                    <Badge variant="outline" className={badgeClass}>
                        {badgeLabel}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <TokenSummary token={token} ready={ready} />
                <RuntimeActions
                    platform={platform}
                    configured={configured}
                    needsReauth={missingScopes.length > 0}
                    accent={meta.accent}
                    busy={busy}
                    showCopy={hasCopyLink}
                    onAuthorize={onAuthorize}
                    onRefreshToken={onRefreshToken}
                    onCreateLink={onCreateLink}
                    onCopyLink={onCopyLink}
                />
                {hasCopyLink ? (
                    <div className="rounded-xl border border-border/70 bg-background/55 p-3 text-xs break-all text-muted-foreground">
                        {oneTimeLink?.url}
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
};
