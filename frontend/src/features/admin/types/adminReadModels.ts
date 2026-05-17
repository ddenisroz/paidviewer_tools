export type AdminPlatform = 'twitch' | 'vk';

export interface RuntimeBotStatus {
    connected: boolean;
    channels: number;
    is_ready?: boolean;
    is_running?: boolean;
}

export interface TokenStatus {
    configured: boolean;
    bot_login?: string;
    seconds_left?: number | null;
    needs_refresh?: boolean;
    has_refresh_token?: boolean;
    scopes?: string[];
    missing_scopes?: string[];
    valid_for_chat?: boolean;
    message?: string;
}

export interface ProviderHealth {
    healthy: boolean;
    status?: string;
    via?: string;
    error_code?: string | null;
    message?: string | null;
}

export interface PlatformConfig {
    display_name?: string;
    capabilities?: Record<string, boolean>;
}

export interface RuntimeWorker {
    worker_key: string;
    label?: string;
    status: string;
    supports_f5?: boolean;
    is_managed?: boolean;
    runtime_metadata?: {
        hostname?: string;
    };
}

export interface OverviewPayload {
    stats?: {
        users?: { total?: number; active_today?: number };
        system?: { errors_24h?: number };
        tts?: { requests_today?: number };
    };
    runtime?: {
        bots?: Record<string, RuntimeBotStatus>;
        tokens?: Record<string, TokenStatus>;
        workers?: {
            summary?: { total?: number; online?: number; offline?: number };
        };
    };
    tts?: {
        providers?: Record<string, ProviderHealth>;
    };
    accounts?: { whitelist_total?: number };
    channels?: { active_total?: number; blocked_total?: number };
    platforms?: Record<string, PlatformConfig>;
    alerts?: Array<{ id: string; title: string; message: string }>;
}

export interface RuntimePayload {
    bots?: Record<AdminPlatform, RuntimeBotStatus>;
    tokens?: Record<AdminPlatform, TokenStatus>;
    workers?: {
        summary?: {
            total?: number;
            online?: number;
            managed?: number;
            self_hosted?: number;
        };
        items?: RuntimeWorker[];
    };
}

export interface ProviderRecord {
    health?: ProviderHealth;
    capabilities?: Record<string, unknown>;
    official_modes?: string[];
}

export interface TtsPayload {
    official_modes?: string[];
    providers?: Record<string, ProviderRecord>;
    workers?: {
        summary?: {
            total?: number;
            online?: number;
            managed?: number;
            self_hosted?: number;
        };
    };
}

export interface ActiveChannel {
    id: number;
    channel_name?: string | null;
    vk_channel_name?: string | null;
    platform: AdminPlatform;
    tts_enabled?: boolean;
}

export interface BlockedChannel {
    id: number;
    channel_name: string;
    reason?: string | null;
}

export interface ChannelsPayload {
    active_channels?: ActiveChannel[];
    blocked_channels?: BlockedChannel[];
    counts?: {
        active_total?: number;
        active_twitch?: number;
        active_vk?: number;
        blocked_total?: number;
    };
}

export interface AdminLogEntry {
    id: number;
    admin_name?: string | null;
    description?: string | null;
    target_user_name?: string | null;
    status: 'success' | 'failed' | 'warning';
    timestamp?: string | null;
    error_message?: string | null;
}

export interface LogsOverviewPayload {
    recent_admin_logs?: AdminLogEntry[];
    stats?: {
        total_logs?: number;
        days?: number;
        actions_by_type?: Array<{ action_type: string }>;
    };
    actions?: string[];
    system_logs_preview?: string[];
}

export const PLATFORM_META: Record<AdminPlatform, { label: string; accent: string }> = {
    twitch: { label: 'Twitch', accent: '#9146ff' },
    vk: { label: 'VK Live', accent: '#0077ff' },
};

export const statusBadgeClass = (enabled: boolean): string =>
    enabled
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
        : 'border-border/70 bg-background/60 text-muted-foreground';

export const logStatusBadgeClass = (status: AdminLogEntry['status']): string => {
    if (status === 'success') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    if (status === 'failed') return 'border-destructive/30 bg-destructive/10 text-destructive';
    return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
};

export const formatTokenLifetime = (secondsLeft?: number | null): string => {
    if (typeof secondsLeft !== 'number') return 'срок неизвестен';
    if (secondsLeft <= 0) return 'токен истёк';

    const days = Math.floor(secondsLeft / 86400);
    const hours = Math.floor((secondsLeft % 86400) / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);

    if (days > 0) return `${days} д ${hours} ч`;
    if (hours > 0) return `${hours} ч ${minutes} мин`;
    return `${Math.max(minutes, 1)} мин`;
};
