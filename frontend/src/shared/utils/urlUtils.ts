/**
 * URL utilities
 */

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

const getBrowserOrigin = (): string => {
  if (typeof window === 'undefined' || !window.location?.origin || window.location.origin === 'null') {
    return '';
  }
  return trimTrailingSlashes(window.location.origin);
};

export const getApiBaseUrl = (): string => {
  const browserOrigin = getBrowserOrigin();
  if (browserOrigin) {
    return browserOrigin;
  }

  throw new Error('Unable to resolve API base URL from window.location.origin');
};

export const getWebSocketBaseUrl = (): string => {
  const apiUrl = getApiBaseUrl();
  const wsProtocol = apiUrl.startsWith('https://') ? 'wss' : 'ws';
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


