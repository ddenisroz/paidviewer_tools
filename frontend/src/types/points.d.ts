/**
 * Типы для наград за баллы канала
 */

/**
 * Награда за баллы платформы
 */
export interface PlatformReward {
  id: number;
  name: string;
  description?: string;
  cost: number;
  platform: 'twitch' | 'vk';
  channel_name?: string;
  enabled: boolean;
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

