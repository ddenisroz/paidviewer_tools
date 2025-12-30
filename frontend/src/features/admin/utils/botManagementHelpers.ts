// Helper functions for BotManagementPage to reduce complexity

import type { ApiResponse } from '@/types';

export interface BotData {
  name: string;
  platform: string;
  status: 'running' | 'stopped' | 'error';
  connected: boolean;
  connected_channels: number;
  is_ready?: boolean;
  is_running?: boolean;
}

export interface TtsStatus {
  status?: string;
  healthy?: boolean;
  available?: boolean;
  error?: string;
  url?: string;
}

interface BotsApiResponse {
  twitch?: {
    connected: boolean;
    is_ready?: boolean;
    channels?: number;
  };
  vk?: {
    connected: boolean;
    is_running?: boolean;
    channels?: number;
  };
}

interface TtsServiceApiResponse {
  healthy?: boolean;
  available?: boolean;
  status?: string;
}

export type BotStatus = 'running' | 'stopped' | 'error';

export const parseTwitchBot = (twitchData: BotsApiResponse['twitch']): BotData | null => {
  if (!twitchData) return null;

  const isRunning = twitchData.connected && twitchData.is_ready;
  const hasError = twitchData.connected && !twitchData.is_ready;

  return {
    name: 'twitch_bot',
    platform: 'twitch',
    status: isRunning ? 'running' : hasError ? 'error' : 'stopped',
    connected: twitchData.connected,
    connected_channels: twitchData.channels || 0,
    is_ready: twitchData.is_ready || false
  };
};

export const parseVkBot = (vkData: BotsApiResponse['vk']): BotData | null => {
  if (!vkData) return null;

  const isRunning = vkData.connected && vkData.is_running;
  const hasError = vkData.connected && !vkData.is_running;

  return {
    name: 'vk_live_bot',
    platform: 'vk_live',
    status: isRunning ? 'running' : hasError ? 'error' : 'stopped',
    connected: vkData.connected,
    connected_channels: vkData.channels || 0,
    is_running: vkData.is_running || false
  };
};

export const parseBotsResponse = (response: ApiResponse<{ bots?: BotsApiResponse }>): BotData[] => {
  const botsData = response.data?.bots || {};
  const botsArray: BotData[] = [];

  const twitchBot = parseTwitchBot(botsData.twitch);
  if (twitchBot) botsArray.push(twitchBot);

  const vkBot = parseVkBot(botsData.vk);
  if (vkBot) botsArray.push(vkBot);

  return botsArray;
};

export const determineTtsHealth = (ttsServiceData: TtsServiceApiResponse): boolean => {
  if (ttsServiceData.healthy !== undefined) {
    return ttsServiceData.healthy;
  }

  const status = (ttsServiceData.status || '').toLowerCase();
  return ttsServiceData.available === true && 
         (status === 'healthy' || status === 'ok' || status === 'up');
};

export const parseTtsResponse = (response: ApiResponse<{ tts_service?: TtsServiceApiResponse }>): TtsStatus => {
  const ttsServiceData = response.data?.tts_service || {};
  const isHealthy = determineTtsHealth(ttsServiceData);

  return {
    ...ttsServiceData,
    healthy: isHealthy,
    status: ttsServiceData.status || (isHealthy ? 'healthy' : 'offline')
  };
};

export const getBotServiceStatus = (bots: BotData[]): BotStatus => {
  if (bots.length === 0) return 'stopped';

  const hasRunningBot = bots.some(bot => bot.status === 'running');
  if (hasRunningBot) return 'running';

  const hasErrorBot = bots.some(bot => bot.status === 'error');
  if (hasErrorBot) return 'error';

  return 'stopped';
};

export const getBotStatusText = (status: BotStatus): string => {
  switch (status) {
    case 'running': return 'работает';
    case 'error': return 'ошибка';
    default: return 'остановлен';
  }
};

export const getBotServiceDescription = (bots: BotData[]): string => {
  if (bots.length === 0) {
    return 'Загрузка статуса...';
  }

  const twitchBot = bots.find(bot => bot.platform === 'twitch');
  const vkBot = bots.find(bot => bot.platform === 'vk_live');

  const twitchStatus = twitchBot ? getBotStatusText(twitchBot.status) : 'не найден';
  const vkStatus = vkBot ? getBotStatusText(vkBot.status) : 'не найден';
  const twitchChannels = twitchBot?.connected_channels || 0;
  const vkChannels = vkBot?.connected_channels || 0;

  return `Twitch: ${twitchStatus} (${twitchChannels} каналов) • VK Live: ${vkStatus} (${vkChannels} каналов)`;
};
