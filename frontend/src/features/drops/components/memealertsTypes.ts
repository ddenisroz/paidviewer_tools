import { formatAppDateTime } from '@/shared/utils/dateTime';

export const MEMEALERTS_API_BASE = '/api/memealerts';
export const POPUP_STATUS_POLL_MS = 2_000;
export const POPUP_STATUS_TIMEOUT_MS = 120_000;

export type MemeAlertsAuthProvider = 'twitch' | 'google' | 'vk';
export type PopupAuthState = 'idle' | 'redirecting' | 'sign_in' | 'saving' | 'success' | 'error';
export type MemeAlertsProxyState =
    | PopupAuthState
    | 'token_found'
    | 'storage_scanned'
    | 'connect_posted'
    | 'proxy_timeout';

export type MemeAlertsConnectionInfo = {
    authProvider?: MemeAlertsAuthProvider | null;
    streamerId?: string | null;
    tokenId?: string | null;
};

export type MemeAlertsHistoryItem = {
    id?: string | number;
    user_name?: string;
    user_id?: string | number;
    memealerts_name?: string | null;
    platform_user_name?: string | null;
    platform?: string | null;
    source?: string | null;
    created_at?: string;
    amount?: number;
    type?: string;
};

export type MemeAlertsBalanceItem = {
    id?: string | number | null;
    user_id?: string | number | null;
    memealerts_name?: string | null;
    amount?: number | null;
    spent?: number | null;
    purchased?: number | null;
    last_grant_at?: string | null;
    source?: string | null;
};

export type PlatformRewardSettings = {
    local_id?: string;
    platform?: 'twitch' | 'vk';
    enabled: boolean;
    reward_id: string | null;
    reward_title: string | null;
    coins_amount: number;
    reward_cost: number;
    cooldown_seconds?: number;
};

export type MemeAlertsAutomationSettings = {
    points_reward: {
        twitch: PlatformRewardSettings;
        vk: PlatformRewardSettings;
    };
    points_rewards: PlatformRewardSettings[];
    donation_auto: {
        enabled: boolean;
        coins_per_currency: number;
        min_donation_amount: number;
    };
};

export const DEFAULT_AUTOMATION_SETTINGS: MemeAlertsAutomationSettings = {
    points_reward: {
        twitch: { enabled: false, reward_id: null, reward_title: null, coins_amount: 10, reward_cost: 500 },
        vk: { enabled: false, reward_id: null, reward_title: null, coins_amount: 10, reward_cost: 500 },
    },
    points_rewards: [],
    donation_auto: {
        enabled: false,
        coins_per_currency: 0.01,
        min_donation_amount: 1,
    },
};

export const SURFACE_CARD_CLASS = 'border-border/70 bg-card/90 shadow-sm';
export const FIELD_CLASS = 'h-9 border-border/60 bg-background/80 text-foreground placeholder:text-muted-foreground';
export const MUTED_PANEL_CLASS = 'rounded-md border border-border/60 bg-background/45';

export const MEMEALERTS_PROVIDER_LABELS: Record<MemeAlertsAuthProvider, string> = {
    twitch: 'Twitch',
    google: 'Google',
    vk: 'VK Live',
};
export const MEMEALERTS_PROVIDER_OPTIONS: MemeAlertsAuthProvider[] = ['twitch', 'google', 'vk'];

export const normalizeAutomationSettings = (
    settings: Partial<MemeAlertsAutomationSettings> | null | undefined
): MemeAlertsAutomationSettings => ({
    ...DEFAULT_AUTOMATION_SETTINGS,
    ...(settings || {}),
    points_reward: {
        ...DEFAULT_AUTOMATION_SETTINGS.points_reward,
        ...(settings?.points_reward || {}),
    },
    points_rewards: Array.isArray(settings?.points_rewards) ? settings.points_rewards.slice(0, 3) : [],
    donation_auto: {
        ...DEFAULT_AUTOMATION_SETTINGS.donation_auto,
        ...(settings?.donation_auto || {}),
    },
});

export const getPlatformLabel = (platform?: string | null): string =>
    platform === 'vk' ? 'VK Live' : platform === 'twitch' ? 'Twitch' : 'Платформа';

export const getSourceLabel = (source?: string | null, type?: string | null): string => {
    const value = source || type;
    if (value === 'points_reward') return 'Награда за баллы';
    if (value === 'donation_auto') return 'Донат';
    if (value === 'ui') return 'Ручная выдача';
    if (value === 'purchase') return 'Покупка';
    return 'Выдача';
};

export const getDonationCourseRub = (coinsPerCurrency: number): number => {
    const value = Number(coinsPerCurrency);
    if (!Number.isFinite(value) || value <= 0) return 100;
    return Math.max(1, Math.round(1 / value));
};

export const formatMemeAlertsTimestamp = (value?: string): string => {
    return formatAppDateTime(value);
};

export const formatMemeAlertsAmount = (value?: number | null): string => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '0';
    return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
};
