/**
 * Типы для наград за баллы канала
 */

/**
 * Награда за баллы платформы
 */
export interface PlatformReward {
    id: string | number;
    name?: string;
    title?: string;
    description?: string;
    prompt?: string;
    cost: number;
    price?: number;
    platform: 'twitch' | 'vk';
    channel_name?: string;
    enabled?: boolean;
    is_enabled?: boolean;
    background_color?: string;
    // VK Live специфичные поля
    repair_timeout?: number;
    max_uses_count?: number;
    max_uses_count_per_user?: number;
    is_message_required?: boolean;
    // Twitch специфичные поля
    is_user_input_required?: boolean;
    global_cooldown?: { seconds: number };
    global_cooldown_seconds?: number;
    max_per_stream?: number;
    max_per_user_per_stream?: number;
    should_redemptions_skip_request_queue?: boolean;
    created_at?: string;
}

/**
 * Транзакция баллов
 */
export interface PointsTransaction {
    id: number;
    user_id: number;
    username: string;
    platform: 'twitch' | 'vk';
    channel_name?: string;
    amount: number;
    type: 'earned' | 'spent' | 'reward';
    reward_id?: number;
    reward_name?: string;
    created_at: string;
}

/**
 * Запрос на награду (Demand/Redemption)
 */
export interface RewardDemand {
    id: string;
    reward?: {
        id: string;
        name?: string;
        title?: string;
    };
    user?: {
        nick?: string;
        name?: string;
    };
    message?: string | { text?: string; content?: string };
    message_parts?: Array<
        | string
        | {
              text?: { content: string };
              mention?: { nick: string };
              link?: { content: string };
              smile?: { name: string };
              content?: string;
          }
    >;
    created_at?: number | string;
    status?: string;
}
