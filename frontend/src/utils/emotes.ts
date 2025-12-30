import { API_BASE_URL } from '../constants';

import { logger } from "./prodLogger";

const SEVENTV_GQL_ENDPOINT = 'https://api.7tv.app/v4/gql';
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
    if (!url || url.startsWith('/api/proxy/')) {
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

export async function getChannelEmotes(channelName: string): Promise<EmoteMap> {
  try {
    if (emotesCache.has(channelName)) {
      return emotesCache.get(channelName)!;
    }

    logger.debug(`[DEBUG] [7TV] Searching for Twitch user: ${channelName}`);

    const searchQuery = `
      query SearchUser($username: String!) {
        users(query: $username, filter: { platform: TWITCH }) {
          items {
            id
            username
            connections {
              platform
              username
              emote_set_id
            }
          }
        }
      }
    `;

    const response = await fetchWithTimeout(SEVENTV_GQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchQuery, variables: { username: channelName } }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        logger.debug(`[INFO] [7TV] Channel "${channelName}" not found on 7TV`);
      } else {
        logger.debug(`[WARN] [7TV] API returned status ${response.status}`);
      }
      return new Map();
    }

    const result = await response.json() as { data?: { users?: { items?: User[] } } };
    const users = result?.data?.users?.items ?? [];

    if (users.length === 0) {
      logger.debug(`[INFO] [7TV] No 7TV user found for "${channelName}"`);
      return new Map();
    }

    const user = users[0];
    const twitchConn = user.connections?.find((c) => c.platform === 'TWITCH');

    if (!twitchConn?.emote_set_id) {
      logger.debug(`[INFO] [7TV] User "${channelName}" has no emote set`);
      return new Map();
    }

    logger.debug(`[OK] [7TV] Found emote set: ${twitchConn.emote_set_id}`);

    const emoteSetQuery = `
      query EmoteSet($id: String!) {
        emoteSet(id: $id) {
          emotes {
            id
            name
            data {
              animated
              host {
                url
                files {
                  name
                  format
                }
              }
            }
          }
        }
      }
    `;

    const emoteSetResponse = await fetchWithTimeout(SEVENTV_GQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: emoteSetQuery, variables: { id: twitchConn.emote_set_id } }),
    });

    if (!emoteSetResponse.ok) {
      logger.debug('[WARN] [7TV] Failed to fetch emote set');
      return new Map();
    }

    const emoteSetResult = await emoteSetResponse.json() as { data?: { emoteSet?: { emotes?: Emote[] } } };
    const emotes = emoteSetResult?.data?.emoteSet?.emotes ?? [];

    logger.debug(`[OK] [7TV] Loaded ${emotes.length} channel emotes for ${channelName}`);

    const emotesMap: EmoteMap = new Map();
    emotes.forEach((emote) => {
      const host = emote.data?.host;
      if (host?.url) {
        // Используем статичную версию (1x.webp) вместо анимированной
        const file = host.files?.find((f) => f.name === '1x.webp') ?? host.files?.[0];
        const url = `https:${host.url}/${file?.name ?? '1x.webp'}`;
        emotesMap.set(emote.name, {
          id: emote.id,
          name: emote.name,
          url: proxy7tvUrl(url) ?? url,
          animated: false, // Всегда используем статичную версию
        });
      }
    });

    emotesCache.set(channelName, emotesMap);
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

    const query = `
      query GlobalEmotes {
        emoteSet(id: "global") {
          emotes {
            id
            name
            data {
              animated
              host {
                url
                files {
                  name
                  format
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetchWithTimeout(SEVENTV_GQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      logger.debug(`[WARN] [7TV] Global emotes API returned status ${response.status}`);
      return new Map();
    }

    const result = await response.json() as { data?: { emoteSet?: { emotes?: Emote[] } } };
    const emotes = result?.data?.emoteSet?.emotes ?? [];

    logger.debug(`[OK] [7TV] Loaded ${emotes.length} global emotes`);

    const emotesMap: EmoteMap = new Map();
    emotes.forEach((emote) => {
      const host = emote.data?.host;
      if (host?.url) {
        // Используем статичную версию (1x.webp) вместо анимированной
        const file = host.files?.find((f) => f.name === '1x.webp') ?? host.files?.[0];
        const url = `https:${host.url}/${file?.name ?? '1x.webp'}`;
        emotesMap.set(emote.name, {
          id: emote.id,
          name: emote.name,
          url,
          animated: false, // Всегда используем статичную версию
        });
      }
    });

    emotesCache.set('global', emotesMap);
    return emotesMap;
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
  const emoteNames = Array.from(allEmotes.keys())
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  if (emoteNames.length === 0) {
    return message;
  }

  const emoteRegex = new RegExp(`\\b(${emoteNames})\\b`, 'gi');

  return message.replace(emoteRegex, (match) => {
    const emoteName = match.toLowerCase();
    const emote = allEmotes.get(emoteName) || allEmotes.get(match);
    if (emote) {
      const safeUrl = escapeHtml(emote.url);
      const safeName = escapeHtml(emote.name);
      return `<img src="${safeUrl}" alt="${safeName}" class="inline-block w-6 h-6 align-middle" title="${safeName}" />`;
    }
    return match;
  });
}

export function clearEmotesCache(): void {
  emotesCache.clear();
}

export async function getAllEmotesForChannel(channelName: string): Promise<{ channelEmotes: EmoteMap; globalEmotes: EmoteMap }> {
  const [channelEmotes, globalEmotes] = await Promise.all([getChannelEmotes(channelName), getGlobalEmotes()]);
  return { channelEmotes, globalEmotes };
}


