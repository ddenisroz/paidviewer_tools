/**
 * useDashboardInit - хук для загрузки данных дашборда одним запросом
 *
 * Заменяет множественные запросы при загрузке главной страницы:
 * - /api/auth/status
 * - /api/integrations
 * - /api/tts/platform-settings
 * - /api/chat/history
 *
 * Теперь всё загружается одним запросом: GET /api/dashboard/init
 */
import { useQuery } from '@tanstack/react-query';

import api from '@/services/api/client';
import { logger } from '@/shared/utils/prodLogger';

interface DashboardUser {
    id: number;
    twitch_username: string | null;
    vk_username: string | null;
    vk_channel_name: string | null;
    is_admin: boolean;
    created_at: string | null;
}

interface Integration {
    connected: boolean;
    enabled: boolean;
    username: string | null;
    platform_user_id: string | null;
    avatar_url: string | null;
}

interface TtsSettings {
    enabled: boolean;
    enabled_platforms: string[];
    global_enabled: boolean;
    volume: number;
    voice_id: number | null;
}

interface ChatMessage {
    id: number;
    author: string;
    author_name: string;
    content: string;
    message: string;
    platform: string;
    timestamp: string | null;
    channel: string;
    role: string | null;
    badges: unknown[] | null;
}

interface DashboardInitResponse {
    success: boolean;
    user: DashboardUser | null;
    integrations: Record<string, Integration>;
    tts: TtsSettings | null;
    chat_history: ChatMessage[];
}

export const useDashboardInit = (enabled: boolean = true) => {
    return useQuery<DashboardInitResponse>({
        queryKey: ['dashboard-init'],
        queryFn: async () => {
            logger.log('[DASHBOARD] Loading init data...');
            const response = await api.get<DashboardInitResponse>('/api/dashboard/init');
            logger.log('[DASHBOARD] Init data loaded:', {
                user: response.data.user?.id,
                integrations: Object.keys(response.data.integrations || {}),
                chatMessages: response.data.chat_history?.length || 0,
            });
            return response.data;
        },
        enabled,
        staleTime: 30 * 1000, // 30 секунд
        refetchOnWindowFocus: false,
        retry: 1,
    });
};

export type { DashboardUser, Integration, TtsSettings, ChatMessage, DashboardInitResponse };
