/**
 * URL utilities
 */

export const getApiBaseUrl = (): string => {
  const url = import.meta.env.VITE_BOT_SERVICE_URL as string | undefined;
  if (!url) {
    throw new Error('VITE_BOT_SERVICE_URL environment variable is required');
  }
  return url.replace(/\/+$/, '');
};

export const getWebSocketBaseUrl = (): string => {
  const apiUrl = getApiBaseUrl();
  const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
  const wsBaseUrl = apiUrl.replace(/^https?:\/\//, '');
  return `${wsProtocol}://${wsBaseUrl}`;
};

export const getTtsWebSocketUrl = (token: string): string => {
  const wsBaseUrl = getWebSocketBaseUrl();
  return `${wsBaseUrl}/ws/tts/${token}`;
};

export const getChatWebSocketUrl = (userId: string | number): string => {
  const wsBaseUrl = getWebSocketBaseUrl();
  return `${wsBaseUrl}/ws/chat/${userId}`;
};

export const getObsWebSocketUrl = (token: string): string => {
  const wsBaseUrl = getWebSocketBaseUrl();
  return `${wsBaseUrl}/ws/obs/${token}`;
};

export const getChatWidgetWebSocketUrl = (userId: string | number): string => {
  const wsBaseUrl = getWebSocketBaseUrl();
  return `${wsBaseUrl}/ws/chat-widget/${userId}`;
};

export const getLootboxWidgetWebSocketUrl = (userId: string | number): string => {
  const wsBaseUrl = getWebSocketBaseUrl();
  return `${wsBaseUrl}/ws/lootbox-widget/${userId}`;
};

export const getYoutubeObsWebSocketUrl = (token: string): string => {
  const wsBaseUrl = getWebSocketBaseUrl();
  return `${wsBaseUrl}/ws/youtube-obs/${token}`;
};

export const getAudioUrl = (filename: string): string => {
  const apiUrl = getApiBaseUrl();
  return `${apiUrl}/audio/${filename}`;
};

export const resolveAudioUrl = (audioUrl: string, apiBaseUrl?: string): string => {
  const normalized = (audioUrl || '').trim();
  if (!normalized) {
    return normalized;
  }
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }
  const apiUrl = (apiBaseUrl || getApiBaseUrl()).replace(/\/+$/, '');
  if (normalized.startsWith('/')) {
    return `${apiUrl}${normalized}`;
  }
  return `${apiUrl}/${normalized.replace(/^\/+/, '')}`;
};

export const getTtsApiUrl = (endpoint: string): string => {
  const apiUrl = getApiBaseUrl();
  return `${apiUrl}/api/tts/${endpoint}`;
};

export const getAuthUrl = (endpoint: string): string => {
  const apiUrl = getApiBaseUrl();
  return `${apiUrl}/auth/${endpoint}`;
};

export const getApiUrl = (endpoint: string): string => {
  const apiUrl = getApiBaseUrl();
  return `${apiUrl}/api/${endpoint}`;
};


