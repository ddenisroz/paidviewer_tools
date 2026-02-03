import { API_BASE_URL } from '@/constants';
import { logger } from '@/shared/utils/prodLogger';

const SEVENTV_REST_BASE = 'https://7tv.io/v3';
const SEVENTV_REST_API_BASE = 'https://api.7tv.app/v3';
const REQUEST_TIMEOUT = 5000;

interface EmoteData {
  id: string;
  name: string;
  url: string;
  animated: boolean;
}

interface EmoteFile {
  name: string;
  format: string;
}

interface EmoteHost {
  url: string;
  files: EmoteFile[];
}

interface EmoteDataField {
  animated: boolean;
  host: EmoteHost;
}

interface Emote {
  id: string;
  name: string;
  data: EmoteDataField;
}

interface Connection {
  platform: string;
  username: string;
  emote_set_id: string;
}

interface User {
  id: string;
  username: string;
  connections: Connection[];
}

type EmoteMap = Map<string, EmoteData>;

const emotesCache = new Map<string, EmoteMap>();

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeout: number = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function proxy7tvUrl(url: string | undefined): string | undefined {
  try {
    if (!url || url.includes('/api/proxy/7tv/')) {
        return url;
    }
    const urlObj = new URL(url);
    const proxyPath = `${urlObj.host}${urlObj.pathname}${urlObj.search}`;
    return `${API_BASE_URL}/api/proxy/7tv/${proxyPath}`;
  } catch (error) {
    logger.error('Error proxying 7TV URL:', error);
    return url;
  }
}

function normalizeHostUrl(hostUrl: string | undefined): string | undefined {
  if (!hostUrl) return undefined;
  if (hostUrl.startsWith('http')) return hostUrl;
  if (hostUrl.startsWith('//')) return `https:${hostUrl}`;
  return `https://${hostUrl}`;
}

function buildEmoteMap(emotes: Array<Emote | Record<string, unknown>>): EmoteMap {
  const emotesMap: EmoteMap = new Map();
  emotes.forEach((emote) => {
    const data = (emote as Emote).data || (emote as { data?: EmoteDataField }).data;
    const host = data?.host || (emote as { host?: EmoteHost }).host;
    const hostUrl = normalizeHostUrl(host?.url);
    const files = host?.files || [];
    if (hostUrl && files.length > 0) {
      const file = files.find((f) => f.name === '2x.webp')
        || files.find((f) => f.name === '2x.avif')
        || files.find((f) => f.name === '1x.webp')
        || files.find((f) => f.name === '1x.avif')
        || files[0];
      const url = `${hostUrl}/${file?.name ?? '2x.webp'}`;
      const emoteName = (emote as Emote).name || (emote as { name?: string }).name || '';
      if (!emoteName) return;
      const id = (emote as Emote).id || (emote as { id?: string }).id || '';
      const entry: EmoteData = {
        id,
        name: emoteName,
        url,
        animated: !!data?.animated
      };
      emotesMap.set(emoteName, entry);
      emotesMap.set(emoteName.toLowerCase(), entry);
    }
  });
  return emotesMap;
}

async function fetchEmotesFromUserEndpoint(endpoint: string): Promise<EmoteMap> {
  try {
    const response = await fetchWithTimeout(endpoint);
    if (!response.ok) {
      return new Map();
    }
    const user = await response.json() as { emote_set?: { id?: string; emotes?: Emote[] }; emote_set_id?: string };
    if (user?.emote_set?.emotes?.length) {
      return buildEmoteMap(user.emote_set.emotes);
    }
    const emoteSetId = user?.emote_set?.id || user?.emote_set_id;
    if (!emoteSetId) {
      return new Map();
    }
    const emoteSetEndpoints = [
      `${SEVENTV_REST_API_BASE}/emote-sets/${emoteSetId}`,
      `${SEVENTV_REST_BASE}/emote-sets/${emoteSetId}`
    ];
    for (const emoteSetEndpoint of emoteSetEndpoints) {
      const emoteSetResponse = await fetchWithTimeout(emoteSetEndpoint);
      if (!emoteSetResponse.ok) {
        continue;
      }
      const emoteSet = await emoteSetResponse.json() as { emotes?: Emote[] };
      return buildEmoteMap(emoteSet?.emotes || []);
    }
    return new Map();
  } catch (error) {
    logger.debug('[WARN] [7TV] Error fetching channel emotes by user id:', error);
    return new Map();
  }
}

async function getChannelEmotesByUserId(twitchUserId: string): Promise<EmoteMap> {
  return fetchEmotesFromUserEndpoint(`${SEVENTV_REST_BASE}/users/twitch/${twitchUserId}`);
}

async function getChannelEmotesByUsername(channelName: string): Promise<EmoteMap> {
  const encoded = encodeURIComponent(channelName);
  const endpoints = [
    `${SEVENTV_REST_BASE}/users/twitch/${encoded}`,
    `${SEVENTV_REST_API_BASE}/users/twitch/${encoded}`
  ];

  for (const endpoint of endpoints) {
    const emotes = await fetchEmotesFromUserEndpoint(endpoint);
    if (emotes.size > 0) {
      return emotes;
    }
  }
  return new Map();
}

export async function getChannelEmotes(channelName: string, twitchUserId?: string | null): Promise<EmoteMap> {
  try {
    const normalizedChannel = (channelName || '').trim().toLowerCase();
    const canUseChannelName = !!normalizedChannel && !normalizedChannel.includes(' ');
    if (!twitchUserId && !canUseChannelName) {
      return new Map();
    }
    const cacheKey = twitchUserId ? `twitch:${twitchUserId}` : normalizedChannel;
    if (emotesCache.has(cacheKey)) {
      return emotesCache.get(cacheKey)!;
    }

    if (twitchUserId) {
      const emotesById = await getChannelEmotesByUserId(twitchUserId);
      if (emotesById.size > 0) {
        emotesCache.set(cacheKey, emotesById);
        return emotesById;
      }
    }

    if (!canUseChannelName) {
      return new Map();
    }

    logger.debug(`[DEBUG] [7TV] Fetching emotes for Twitch user: ${normalizedChannel}`);
    const emotesMap = await getChannelEmotesByUsername(normalizedChannel);
    emotesMap.forEach((value) => {
      if (value.url) {
        value.url = proxy7tvUrl(value.url) ?? value.url;
      }
    });

    if (emotesMap.size > 0) {
      emotesCache.set(cacheKey, emotesMap);
    }
    return emotesMap;
  } catch (error: unknown) {
    const err = error as Error;
    if (err?.name === 'AbortError') {
      logger.debug('[WARN] [7TV] Request timeout (5s exceeded)');
    } else {
      logger.debug('[WARN] [7TV] Error fetching channel emotes:', err?.message || error);
    }
    return new Map();
  }
}

export async function getGlobalEmotes(): Promise<EmoteMap> {
  try {
    if (emotesCache.has('global')) {
      return emotesCache.get('global')!;
    }

    logger.debug('[DEBUG] [7TV] Fetching global emotes');

    const globalEndpoints = [
      `${SEVENTV_REST_API_BASE}/emote-sets/global`,
      `${SEVENTV_REST_BASE}/emote-sets/global`
    ];

    for (const endpoint of globalEndpoints) {
      const response = await fetchWithTimeout(endpoint);
      if (!response.ok) {
        continue;
      }
      const result = await response.json() as { emotes?: Emote[] };
      const emotes = result?.emotes ?? [];
      const emotesMap = buildEmoteMap(emotes);
      emotesMap.forEach((value) => {
        if (value.url) {
          value.url = proxy7tvUrl(value.url) ?? value.url;
        }
      });
      emotesCache.set('global', emotesMap);
      return emotesMap;
    }

    return new Map();
  } catch (error: unknown) {
    const err = error as Error;
    if (err?.name === 'AbortError') {
      logger.debug('[WARN] [7TV] Global emotes request timeout');
    } else {
      logger.debug('[WARN] [7TV] Error fetching global emotes:', err?.message || error);
    }
    return new Map();
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function processEmotes(message: string, channelEmotes: EmoteMap = new Map(), globalEmotes: EmoteMap = new Map()): string {
  if (!message || typeof message !== 'string') {
    return message;
  }

  const allEmotes: EmoteMap = new Map([...channelEmotes, ...globalEmotes]);
  const emoteNames = Array.from(new Set(allEmotes.keys()))
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  if (emoteNames.length === 0) {
    return message;
  }

  const emoteRegex = new RegExp(`(^|\\s)(:)?(${emoteNames})(:)?(?=\\s|$|[.,!?])`, 'gi');

  return message.replace(emoteRegex, (match, leading, _open, name) => {
    const rawName = String(name);
    const emoteName = rawName.toLowerCase();
    const emote = allEmotes.get(emoteName) || allEmotes.get(rawName);
    if (emote) {
      const safeUrl = escapeHtml(emote.url);
      const safeName = escapeHtml(emote.name);
      return `${leading}<img src="${safeUrl}" alt="${safeName}" class="inline-block w-6 h-6 align-middle object-contain" title="${safeName}" />`;
    }
    return match;
  });
}

export function clearEmotesCache(): void {
  emotesCache.clear();
}

export async function getAllEmotesForChannel(channelName: string, twitchUserId?: string | null): Promise<{ channelEmotes: EmoteMap; globalEmotes: EmoteMap }> {
  const [channelEmotes, globalEmotes] = await Promise.all([getChannelEmotes(channelName, twitchUserId), getGlobalEmotes()]);
  return { channelEmotes, globalEmotes };
}


