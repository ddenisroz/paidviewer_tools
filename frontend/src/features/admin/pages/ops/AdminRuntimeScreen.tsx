import React, { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { API_BASE_URL } from '@/constants';
import { ADMIN_ACTION_BUTTON_CLASS, AdminPageHeader } from '@/features/admin/components/admin-ui';
import { RuntimePlatformCard } from '@/features/admin/components/ops-center/RuntimeSections';
import { getAdminTabHref } from '@/features/admin/utils/adminRoutes';
import { formatBotAuthError } from '@/features/admin/utils/botAuthMessages';
import { queryKeys } from '@/queries/queryKeys';
import { adminService } from '@/services/api/services/adminService';
import { Button } from '@/shared/components/ui/button';
import { getSafeBackendAuthUrl } from '@/shared/utils/navigationSafety';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import type { AdminPlatform, RuntimePayload } from '@/features/admin/types/adminReadModels';

const useBotAuthRedirectNotice = (): void => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const success = searchParams.get('bot_auth_success');
        const errorCode = searchParams.get('bot_auth_error');
        const error = errorCode ? formatBotAuthError(errorCode, 'ru') : null;
        const platform = searchParams.get('platform');

        if (success === 'true') {
            toast.success(`${platform === 'vk' ? 'VK Live' : 'Twitch'} бот авторизован`);
            navigate(getAdminTabHref('runtime'), { replace: true });
            return;
        }

        if (error) {
            toast.error(`Ошибка авторизации: ${error}`);
            navigate(getAdminTabHref('runtime'), { replace: true });
        }
    }, [navigate, searchParams]);
};

const AdminRuntimeScreen: React.FC = () => {
    useBotAuthRedirectNotice();

    const [busy, setBusy] = useState<Record<string, boolean>>({});
    const [oneTimeLink, setOneTimeLink] = useState<{ platform: AdminPlatform; url: string } | null>(null);
    const { data, isLoading, isFetching, refetch } = useQuery<RuntimePayload>({
        queryKey: queryKeys.admin.runtimeOverview(),
        queryFn: async () => {
            const response = await adminService.getRuntimeOverview();
            const payload = response.data as { data?: RuntimePayload };
            return payload.data ?? {};
        },
        refetchInterval: 20_000,
        refetchOnWindowFocus: false,
    });

    const runAction = async (key: string, action: () => Promise<void>): Promise<void> => {
        setBusy((prev) => ({ ...prev, [key]: true }));
        try {
            await action();
        } finally {
            setBusy((prev) => ({ ...prev, [key]: false }));
        }
    };

    const handleAuthorize = (platform: AdminPlatform): void => {
        const safeUrl = getSafeBackendAuthUrl(API_BASE_URL, `/auth/${platform}/bot/login`);
        if (!safeUrl) {
            toast.error('Некорректный URL авторизации бота');
            return;
        }

        window.location.href = safeUrl;
    };

    const handleCreateLink = async (platform: AdminPlatform): Promise<void> =>
        runAction(`link-${platform}`, async () => {
            const response = await adminService.createBotLoginLink(platform);
            const payload = response.data as { url?: string };

            if (!payload.url) {
                toast.error('Backend не вернул ссылку авторизации');
                return;
            }

            setOneTimeLink({ platform, url: payload.url });
            toast.success(`Разовая ссылка для ${platform === 'vk' ? 'VK Live' : 'Twitch'} готова`);
        });

    const handleCopyLink = async (): Promise<void> => {
        if (!oneTimeLink) {
            return;
        }

        try {
            await navigator.clipboard.writeText(oneTimeLink.url);
            toast.success('Ссылка скопирована');
        } catch (error) {
            logger.error('Failed to copy bot login link', error);
            toast.error('Не удалось скопировать ссылку');
        }
    };

    const handleRefreshToken = async (platform: AdminPlatform): Promise<void> =>
        runAction(`refresh-${platform}`, async () => {
            const response = await adminService.refreshBotToken(platform);
            const payload = response.data as { success?: boolean; message?: string };

            if (!payload.success) {
                toast.error(payload.message ?? 'Не удалось обновить токен');
                return;
            }

            toast.success(payload.message ?? 'Токен обновлён');
            await refetch();
        });

    const runtime = data ?? {};

    if (isLoading) {
        return (
            <div className="rounded-lg border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
                Загрузка состояния ботов...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Авторизация ботов"
                description="Twitch и VK Live боты: OAuth, токены, права чата и разовые ссылки."
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        className={ADMIN_ACTION_BUTTON_CLASS}
                        onClick={() => void refetch()}
                        disabled={isFetching}
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                        Обновить
                    </Button>
                }
            />
            <div className="grid gap-4 xl:grid-cols-2">
                {(['twitch', 'vk'] as AdminPlatform[]).map((platform) => (
                    <RuntimePlatformCard
                        key={platform}
                        platform={platform}
                        data={runtime}
                        busy={busy}
                        oneTimeLink={oneTimeLink}
                        onAuthorize={handleAuthorize}
                        onRefreshToken={handleRefreshToken}
                        onCreateLink={handleCreateLink}
                        onCopyLink={handleCopyLink}
                    />
                ))}
            </div>
        </div>
    );
};

export default AdminRuntimeScreen;
