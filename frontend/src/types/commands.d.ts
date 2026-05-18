/**
 * Типы для команд чата
 */

/**
 * Команда чата
 */
export interface ChatCommand {
    id: number;
    name: string;
    command_name?: string;
    description?: string;
    response: string;
    response_text?: string;
    enabled: boolean;
    is_enabled?: boolean;
    cooldown?: number;
    cooldown_seconds?: number;
    alias?: string;
    parent_command_id?: number;
    user_level?: 'everyone' | 'subscriber' | 'moderator' | 'broadcaster';
    allowed_roles?: string;
    platforms?: string;
    platform?: 'twitch' | 'vk' | 'youtube' | 'all';
    channel_name?: string;
    usage_count?: number;
    last_used?: string;
    created_at?: string;
    updated_at?: string;
    tags?: string[];
    command_type?: 'global' | 'override' | 'custom';
    extra_settings?: Record<string, unknown>;
}

/**
 * Алиас для обратной совместимости
 */
export type Command = ChatCommand;

export interface CommandInvocation {
    id: number;
    command_id?: number;
    canonical_command_name: string;
    used_trigger: string;
    viewer_name?: string;
    viewer_id?: string;
    platform?: 'twitch' | 'vk' | 'youtube' | 'all' | string;
    channel_name?: string;
    message_text?: string;
    chat_message_id?: number;
    has_platform_message?: boolean;
    status?: string;
    error?: string;
    created_at?: string;
}

/**
 * Override команды
 */
export interface CommandOverride {
    id: number;
    command_id: number;
    channel_name: string;
    platform: 'twitch' | 'vk' | 'youtube';
    response?: string;
    enabled?: boolean;
    cooldown?: number;
    user_level?: 'everyone' | 'subscriber' | 'moderator' | 'broadcaster';
}
