/**
 * Типы для Drops (Лутбоксы)
 */

/**
 * Конфигурация Drops
 */
export interface DropsConfig {
    channel_name: string;
    platform?: 'twitch' | 'vk';
    streak_enabled_twitch?: boolean;
    streak_enabled_vk?: boolean;
    streak_days_common?: number;
    streak_days_rare?: number;
    streak_days_epic?: number;
    streak_days_legendary?: number;
    streak_messages_required?: number;
    streak_reset_on_skip?: boolean;
    donation_enabled?: boolean;
    donation_amount_common?: number;
    donation_amount_rare?: number;
    donation_amount_epic?: number;
    donation_amount_legendary?: number;
    mythical_enabled?: boolean;
    mythical_min_interval_hours?: number;
    mythical_max_interval_hours?: number;
    mythical_window_duration_minutes?: number;
    mythical_donation_amount?: number;
    widget_spinning_duration_ms?: number;
    widget_opening_duration_ms?: number;
    widget_result_duration_ms?: number;
    widget_spin_sound_file?: string;
    widget_start_sound_file?: string;
    widget_reveal_sound_file?: string;
    widget_sound_volume?: number;
    widget_frame_color?: string;
    widget_text_color?: string;
    widget_background_color?: string;
    widget_font_scale?: number;
    [key: string]: string | number | boolean | undefined;
}

/**
 * Награда Drops
 */
export interface DropsReward {
    id: number;
    name: string;
    description?: string;
    quality: 'common' | 'rare' | 'epic' | 'legendary' | 'mythical';
    probability?: number;
    platform?: 'twitch' | 'vk';
    is_active?: boolean;
    channel_name?: string;
    created_at?: string;
}

/**
 * История Drops
 */
export interface DropsHistory {
    id: number;
    channel_name: string;
    platform: 'twitch' | 'vk';
    user_id: number;
    username: string;
    viewer_name: string;
    reward_id?: number;
    reward_name?: string;
    reward_quality?: string;
    quality?: {
        name?: string;
        color?: string;
    };
    drops_type?: string;
    donation_amount?: number;
    streak_days?: number;
    messages_count?: number;
    opened_at: string;
    created_at: string;
}

/**
 * Алиасы для обратной совместимости
 */
export type DonationEntry = DropsHistory;
export type HistoryEntry = DropsHistory;

/**
 * Статистика стрика
 */
export interface StreakStats {
    channel_name: string;
    platform: 'twitch' | 'vk';
    user_id: number;
    username: string;
    current_streak: number;
    longest_streak: number;
    last_message_date?: string;
    messages_count: number;
}

/**
 * Стрик для Drops
 */
export interface DropsStreak {
    channel_name: string;
    platform: 'twitch' | 'vk';
    user_id: number;
    username: string;
    viewer_name: string;
    current_streak: number;
    max_streak: number;
    longest_streak: number;
    messages_this_stream: number;
    last_message_date?: string;
    last_activity?: string;
    messages_count: number;
}

/**
 * Алиас для обратной совместимости
 */
export type Streak = DropsStreak;

/**
 * Форма данных для донатов
 */
export interface DonationFormData {
    donation_enabled: boolean;
    donation_amount_common: number;
    donation_amount_rare: number;
    donation_amount_epic: number;
    donation_amount_legendary: number;
    [key: string]: number | boolean;
}

/**
 * Форма данных для стриков
 */
export interface StreakFormData {
    streak_enabled_twitch: boolean;
    streak_enabled_vk: boolean;
    streak_days_common: number;
    streak_days_rare: number;
    streak_days_epic: number;
    streak_days_legendary: number;
    streak_messages_required: number;
    streak_reset_on_skip: boolean;
    [key: string]: number | boolean;
}

/**
 * Форма данных для сетки донатов (с массивами для слайдеров)
 */
export interface DonationGridFormData {
    donation_amount_common: number[];
    donation_amount_rare: number[];
    donation_amount_epic: number[];
    donation_amount_legendary: number[];
    [key: string]: number[];
}

/**
 * Форма данных для настроек донатов (расширенная)
 */
export interface DonationSettingsFormData {
    donation_enabled: boolean;
    donation_amount_common: number[];
    donation_amount_rare: number[];
    donation_amount_epic: number[];
    donation_amount_legendary: number[];
    mythical_enabled: boolean;
    mythical_min_interval_hours: number[];
    mythical_max_interval_hours: number[];
    mythical_window_duration_minutes: number[];
    mythical_donation_amount: number[];
    [key: string]: number[] | boolean;
}

/**
 * Форма данных для календаря стриков (с массивами для слайдеров)
 */
export interface StreakCalendarFormData {
    streak_days_common: number[];
    streak_days_rare: number[];
    streak_days_epic: number[];
    streak_days_legendary: number[];
    [key: string]: number[];
}

/**
 * Форма данных для настроек стриков (расширенная)
 */
export interface StreakSettingsFormData {
    streak_enabled_twitch: boolean;
    streak_enabled_vk: boolean;
    streak_days_common: number[];
    streak_days_rare: number[];
    streak_days_epic: number[];
    streak_days_legendary: number[];
    streak_messages_required: number[];
    streak_reset_on_skip: boolean;
    [key: string]: number[] | boolean;
}
