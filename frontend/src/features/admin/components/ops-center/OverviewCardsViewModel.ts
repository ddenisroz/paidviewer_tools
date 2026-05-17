import { statusBadgeClass } from '@/features/admin/types/adminReadModels';

import type { PlatformConfig, RuntimeBotStatus, TokenStatus } from '@/features/admin/types/adminReadModels';

export const getMissingScopes = (token?: TokenStatus): string[] => token?.missing_scopes?.filter(Boolean) ?? [];

export const buildRuntimePlatformCardModel = (
    config: PlatformConfig,
    runtime?: RuntimeBotStatus,
    token?: TokenStatus
) => {
    const tokenScopesMissing = getMissingScopes(token);
    const runtimeOnline = Boolean(runtime?.connected && (runtime?.is_ready !== false || runtime?.is_running));
    const ready = runtimeOnline && tokenScopesMissing.length === 0;
    const tokenLabel =
        tokenScopesMissing.length > 0 ? 'нет прав чата' : token?.configured ? 'подключён' : 'не настроен';
    const badgeLabel = tokenScopesMissing.length > 0 ? 'нет прав чата' : ready ? 'бот готов' : 'нужна проверка';

    return {
        ready,
        tokenLabel,
        badgeLabel,
        tokenScopesMissing,
        displayName: config.display_name,
        badgeClass:
            tokenScopesMissing.length > 0
                ? 'border-amber-500/35 bg-amber-500/10 text-amber-200'
                : statusBadgeClass(ready),
    };
};
