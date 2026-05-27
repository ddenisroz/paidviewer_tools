import { API_BASE_URL } from '@/constants';
import { logger } from '@/shared/utils/prodLogger';

const SEVENTV_REST_BASE = `${API_BASE_URL}/api/proxy/7tv/7tv.io/v3`;
const SEVENTV_REST_API_BASE = `${API_BASE_URL}/api/proxy/7tv/api.7tv.app/v3`;
const REQUEST_TIMEOUT = 3500;
const EMOTES_CACHE_TTL_MS = 15 * 60 * 1000;
const EMPTY_CACHE_TTL_MS = 90 * 1000;
const INLINE_EMOTE_CLASS = 'chat-inline-emote';

export interface EmoteData {
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

export type EmoteMap = Map<string, EmoteData>;

export const SEVENTV_FALLBACK_EMOTES: EmoteData[] = [
    {
        id: '01KRN36SDPJ4FJ30EA2XDMQMY2',
        name: 'HYPE',
        url: 'https://cdn.7tv.app/emote/01KRN36SDPJ4FJ30EA2XDMQMY2/4x.webp',
        animated: true,
    },
    {
        id: '01KQJHKKN4049035GPNSK9W7QB',
        name: 'JustAnotherDay',
        url: 'https://cdn.7tv.app/emote/01KQJHKKN4049035GPNSK9W7QB/4x.webp',
        animated: false,
    },
    {
        id: '01KJR2MTWYRBJVCS5H5WEK9VN1',
        name: 'Obsent',
        url: 'https://cdn.7tv.app/emote/01KJR2MTWYRBJVCS5H5WEK9VN1/4x.webp',
        animated: false,
    },
    {
        id: '01GHQ9FYY8000A4BTSHDYK8Z2H',
        name: 'imNOTcrying',
        url: 'https://cdn.7tv.app/emote/01GHQ9FYY8000A4BTSHDYK8Z2H/4x.webp',
        animated: false,
    },
];

const emotesCache = new Map<string, EmoteMap>();
const emotesCacheExpiry = new Map<string, number>();
const emotesInFlight = new Map<string, Promise<EmoteMap>>();

async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit = {},
    timeout: number = REQUEST_TIMEOUT
): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
}

function getCachedEmotes(cacheKey: string): EmoteMap | null {
    const cached = emotesCache.get(cacheKey);
    if (!cached) return null;

    const expiresAt = emotesCacheExpiry.get(cacheKey) ?? 0;
    if (expiresAt > Date.now()) {
        return cached;
    }

    emotesCache.delete(cacheKey);
    emotesCacheExpiry.delete(cacheKey);
    return null;
}

function setCachedEmotes(cacheKey: string, data: EmoteMap): void {
    const ttl = data.size > 0 ? EMOTES_CACHE_TTL_MS : EMPTY_CACHE_TTL_MS;
    emotesCache.set(cacheKey, data);
    emotesCacheExpiry.set(cacheKey, Date.now() + ttl);
}

export function registerEmoteAliases(target: EmoteMap, emote: EmoteData): void {
    const aliases = new Set([
        emote.name,
        emote.name.toLowerCase(),
        `:${emote.name}:`,
        `:${emote.name.toLowerCase()}:`,
    ]);
    aliases.forEach((alias) => target.set(alias, emote));
}

async function runWithInFlightDedup(cacheKey: string, loader: () => Promise<EmoteMap>): Promise<EmoteMap> {
    const inFlight = emotesInFlight.get(cacheKey);
    if (inFlight) {
        return inFlight;
    }

    const promise = loader().finally(() => {
        emotesInFlight.delete(cacheKey);
    });
    emotesInFlight.set(cacheKey, promise);
    return promise;
}

async function fetchEmotesFromSetEndpoint(endpoint: string): Promise<EmoteMap> {
    const response = await fetchWithTimeout(endpoint);
    if (!response.ok) {
        return new Map();
    }
    const emoteSet = (await response.json()) as { emotes?: Emote[] };
    return buildEmoteMap(emoteSet?.emotes || []);
}

async function resolveFirstNonEmptyEmotes(fetchers: Array<() => Promise<EmoteMap>>): Promise<EmoteMap> {
    if (fetchers.length === 0) return new Map();

    return new Promise<EmoteMap>((resolve) => {
        let pending = fetchers.length;
        let resolved = false;

        const completeIfDone = () => {
            pending -= 1;
            if (!resolved && pending <= 0) {
                resolve(new Map());
            }
        };

        fetchers.forEach((fetcher) => {
            fetcher()
                .then((result) => {
                    if (!resolved && result.size > 0) {
                        resolved = true;
                        resolve(result);
                        return;
                    }
                    completeIfDone();
                })
                .catch(() => {
                    completeIfDone();
                });
        });
    });
}

export function proxy7tvUrl(url: string | undefined): string | undefined {
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

export function getSevenTvFallbackEmotes(): EmoteData[] {
    return SEVENTV_FALLBACK_EMOTES.map((emote) => ({
        ...emote,
        url: proxy7tvUrl(emote.url) ?? emote.url,
    }));
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
            const file =
                files.find((f) => f.name === '4x.avif') ||
                files.find((f) => f.name === '4x.webp') ||
                files.find((f) => f.name === '3x.avif') ||
                files.find((f) => f.name === '3x.webp') ||
                files.find((f) => f.name === '2x.webp') ||
                files.find((f) => f.name === '2x.avif') ||
                files.find((f) => f.name === '1x.webp') ||
                files.find((f) => f.name === '1x.avif') ||
                files[0];
            const url = `${hostUrl}/${file?.name ?? '4x.webp'}`;
            const emoteName = (emote as Emote).name || (emote as { name?: string }).name || '';
            if (!emoteName) return;
            const id = (emote as Emote).id || (emote as { id?: string }).id || '';
            const entry: EmoteData = {
                id,
                name: emoteName,
                url,
                animated: !!data?.animated,
            };
            registerEmoteAliases(emotesMap, entry);
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
        const user = (await response.json()) as {
            emote_set?: { id?: string; emotes?: Emote[] };
            emote_set_id?: string;
        };
        if (user?.emote_set?.emotes?.length) {
            return buildEmoteMap(user.emote_set.emotes);
        }
        const emoteSetId = user?.emote_set?.id || user?.emote_set_id;
        if (!emoteSetId) {
            return new Map();
        }
        const emoteSetEndpoints = [
            `${SEVENTV_REST_API_BASE}/emote-sets/${emoteSetId}`,
            `${SEVENTV_REST_BASE}/emote-sets/${emoteSetId}`,
        ];
        return resolveFirstNonEmptyEmotes(
            emoteSetEndpoints.map((emoteSetEndpoint) => () => fetchEmotesFromSetEndpoint(emoteSetEndpoint))
        );
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
        `${SEVENTV_REST_API_BASE}/users/twitch/${encoded}`,
    ];
    return resolveFirstNonEmptyEmotes(endpoints.map((endpoint) => () => fetchEmotesFromUserEndpoint(endpoint)));
}

export async function getChannelEmotes(channelName: string, twitchUserId?: string | null): Promise<EmoteMap> {
    try {
        const normalizedChannel = (channelName || '').trim().toLowerCase();
        const canUseChannelName = !!normalizedChannel && !normalizedChannel.includes(' ');
        if (!twitchUserId && !canUseChannelName) {
            return new Map();
        }
        const cacheKey = twitchUserId ? `twitch:${twitchUserId}` : normalizedChannel;
        const cached = getCachedEmotes(cacheKey);
        if (cached) return cached;

        return runWithInFlightDedup(cacheKey, async () => {
            let emotesMap = new Map<string, EmoteData>();

            if (twitchUserId) {
                const emotesById = await getChannelEmotesByUserId(twitchUserId);
                if (emotesById.size > 0) {
                    emotesMap = emotesById;
                }
            }

            if (emotesMap.size === 0 && canUseChannelName) {
                logger.debug(`[DEBUG] [7TV] Fetching emotes for Twitch user: ${normalizedChannel}`);
                emotesMap = await getChannelEmotesByUsername(normalizedChannel);
            }

            emotesMap.forEach((value) => {
                if (value.url) {
                    value.url = proxy7tvUrl(value.url) ?? value.url;
                }
            });

            setCachedEmotes(cacheKey, emotesMap);
            return emotesMap;
        });
    } catch (error: unknown) {
        const err = error as Error;
        if (err?.name === 'AbortError') {
            logger.debug('[WARN] [7TV] Request timeout (3.5s exceeded)');
        } else {
            logger.debug('[WARN] [7TV] Error fetching channel emotes:', err?.message || error);
        }
        return new Map();
    }
}

export async function getGlobalEmotes(): Promise<EmoteMap> {
    try {
        const cached = getCachedEmotes('global');
        if (cached) return cached;

        return runWithInFlightDedup('global', async () => {
            logger.debug('[DEBUG] [7TV] Fetching global emotes');

            const globalEndpoints = [
                `${SEVENTV_REST_API_BASE}/emote-sets/global`,
                `${SEVENTV_REST_BASE}/emote-sets/global`,
            ];
            const emotesMap = await resolveFirstNonEmptyEmotes(
                globalEndpoints.map((endpoint) => () => fetchEmotesFromSetEndpoint(endpoint))
            );
            getSevenTvFallbackEmotes().forEach((emote) => registerEmoteAliases(emotesMap, emote));

            emotesMap.forEach((value) => {
                if (value.url) {
                    value.url = proxy7tvUrl(value.url) ?? value.url;
                }
            });

            setCachedEmotes('global', emotesMap);
            return emotesMap;
        });
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

function normalizeInlineEmoteUrl(url: string): string {
    if (!url) return url;
    if (url.includes('images.live.vkvideo.ru') && url.includes('/size/small')) {
        return url.replace('/size/small', '/size/large');
    }
    if (url.includes('static-cdn.jtvnw.net/emoticons/v2/')) {
        return url.replace(/\/(?:1|2)\.0$/, '/3.0');
    }
    if (url.includes('cdn.7tv.app/emote/')) {
        return url
            .replace(/\/1x\.(avif|webp|gif)$/i, '/4x.$1')
            .replace(/\/2x\.(avif|webp|gif)$/i, '/4x.$1')
            .replace(/\/3x\.(avif|webp|gif)$/i, '/4x.$1');
    }
    return url;
}

export function processEmotes(
    message: string,
    channelEmotes: EmoteMap = new Map(),
    globalEmotes: EmoteMap = new Map()
): string {
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
            const safeUrl = escapeHtml(normalizeInlineEmoteUrl(emote.url));
            const safeName = escapeHtml(emote.name);
            return `${leading}<img src="${safeUrl}" alt="${safeName}" class="${INLINE_EMOTE_CLASS}" title="${safeName}" />`;
        }
        return match;
    });
}

export function clearEmotesCache(): void {
    emotesCache.clear();
    emotesCacheExpiry.clear();
    emotesInFlight.clear();
}

export async function getAllEmotesForChannel(
    channelName: string,
    twitchUserId?: string | null
): Promise<{ channelEmotes: EmoteMap; globalEmotes: EmoteMap }> {
    const [channelEmotes, globalEmotes] = await Promise.all([
        getChannelEmotes(channelName, twitchUserId),
        getGlobalEmotes(),
    ]);
    return { channelEmotes, globalEmotes };
}
