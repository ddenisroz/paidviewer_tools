import { logger } from '../utils/prodLogger';
import { API_BASE_URL } from '../constants';

// frontend/src/utils/emotes.js
// Утилиты для обработки эмодзи и смайлов

// 7TV GraphQL API v4 для получения смайлов
const SEVENTV_GQL_ENDPOINT = 'https://api.7tv.app/v4/gql';

// Кэш для смайлов
const emotesCache = new Map();

/**
 * Проксирует URL 7TV эмодзи через backend для обхода блокировок
 */
function proxy7tvUrl(url) {
    try {
        // Если URL уже проксированный или не является 7TV URL, возвращаем как есть
        if (!url || url.startsWith('/api/proxy/')) {
            return url;
        }
        
        // Извлекаем путь из URL (например, из https://cdn.7tv.app/emotes/... получаем cdn.7tv.app/emotes/...)
        const urlObj = new URL(url);
        const proxyPath = `${urlObj.host}${urlObj.pathname}${urlObj.search}`;
        
        // Формируем проксированный URL
        return `${API_BASE_URL}/api/proxy/7tv/${proxyPath}`;
    } catch (error) {
        logger.error('Error proxying 7TV URL:', error);
        return url; // Возвращаем оригинальный URL в случае ошибки
    }
}

/**
 * Получает смайлы канала с 7TV через GraphQL API v4
 */
export async function getChannelEmotes(channelName) {
    try {
        if (emotesCache.has(channelName)) {
            return emotesCache.get(channelName);
        }

        logger.debug(`🔍 [7TV] Searching for Twitch user: ${channelName}`);

        // GraphQL запрос для поиска пользователя Twitch
        const query = `
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

        const response = await fetch(SEVENTV_GQL_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { username: channelName } }),
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            if (response.status === 404) {
                logger.debug(`ℹ️ [7TV] Channel "${channelName}" not found on 7TV`);
            } else {
                logger.debug(`⚠️ [7TV] API returned status ${response.status}`);
            }
            return new Map();
        }

        const result = await response.json();
        const users = result?.data?.users?.items || [];
        
        if (users.length === 0) {
            logger.debug(`ℹ️ [7TV] No 7TV user found for "${channelName}"`);
            return new Map();
        }

        // Находим Twitch connection
        const user = users[0];
        const twitchConn = user.connections?.find(c => c.platform === 'TWITCH');
        
        if (!twitchConn?.emote_set_id) {
            logger.debug(`ℹ️ [7TV] User "${channelName}" has no emote set`);
            return new Map();
        }

        logger.debug(`✅ [7TV] Found emote set: ${twitchConn.emote_set_id}`);

        // Получаем эмоуты из emote set
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

        const emoteSetResponse = await fetch(SEVENTV_GQL_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: emoteSetQuery, 
                variables: { id: twitchConn.emote_set_id } 
            }),
            signal: AbortSignal.timeout(5000)
        });

        if (!emoteSetResponse.ok) {
            logger.debug(`⚠️ [7TV] Failed to fetch emote set`);
            return new Map();
        }

        const emoteSetResult = await emoteSetResponse.json();
        const emotes = emoteSetResult?.data?.emoteSet?.emotes || [];

        logger.debug(`✅ [7TV] Loaded ${emotes.length} channel emotes for ${channelName}`);

        // Создаем мапу смайлов
        const emotesMap = new Map();
        emotes.forEach(emote => {
            const host = emote.data?.host;
            if (host?.url) {
                // Используем 4x размер для лучшего качества
                const file = host.files?.find(f => f.name === '4x.webp') || host.files?.[0];
                const url = `https:${host.url}/${file?.name || '4x.webp'}`;
                
                emotesMap.set(emote.name, {
                    id: emote.id,
                    name: emote.name,
                    url: proxy7tvUrl(url),
                    animated: emote.data?.animated || false
                });
            }
        });

        emotesCache.set(channelName, emotesMap);
        return emotesMap;
    } catch (error) {
        if (error.name === 'TimeoutError') {
            logger.debug('⚠️ [7TV] Request timeout (5s exceeded)');
        } else {
            logger.debug('⚠️ [7TV] Error fetching channel emotes:', error.message);
        }
        return new Map();
    }
}

/**
 * Получает глобальные смайлы 7TV через GraphQL API v4
 */
export async function getGlobalEmotes() {
    try {
        if (emotesCache.has('global')) {
            return emotesCache.get('global');
        }

        logger.debug('🔍 [7TV] Fetching global emotes');

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

        const response = await fetch(SEVENTV_GQL_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            logger.debug(`⚠️ [7TV] Global emotes API returned status ${response.status}`);
            return new Map();
        }

        const result = await response.json();
        const emotes = result?.data?.emoteSet?.emotes || [];

        logger.debug(`✅ [7TV] Loaded ${emotes.length} global emotes`);

        const emotesMap = new Map();
        emotes.forEach(emote => {
            const host = emote.data?.host;
            if (host?.url) {
                const file = host.files?.find(f => f.name === '4x.webp') || host.files?.[0];
                const url = `https:${host.url}/${file?.name || '4x.webp'}`;
                
                emotesMap.set(emote.name, {
                    id: emote.id,
                    name: emote.name,
                    url: url,
                    animated: emote.data?.animated || false
                });
            }
        });

        emotesCache.set('global', emotesMap);
        return emotesMap;
    } catch (error) {
        if (error.name === 'TimeoutError') {
            logger.debug('⚠️ [7TV] Global emotes request timeout');
        } else {
            logger.debug('⚠️ [7TV] Error fetching global emotes:', error.message);
        }
        return new Map();
    }
}

/**
 * Экранирует HTML для предотвращения XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Обрабатывает сообщение и заменяет смайлы на изображения
 */
export function processEmotes(message, channelEmotes = new Map(), globalEmotes = new Map()) {
    if (!message || typeof message !== 'string') {
        return message;
    }

    // Объединяем канальные и глобальные смайлы
    const allEmotes = new Map([...channelEmotes, ...globalEmotes]);
    
    // Создаем регулярное выражение для поиска смайлов
    const emoteNames = Array.from(allEmotes.keys()).map(name => 
        name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('|');
    
    if (emoteNames.length === 0) {
        return message;
    }

    const emoteRegex = new RegExp(`\\b(${emoteNames})\\b`, 'gi');
    
    return message.replace(emoteRegex, (match) => {
        const emoteName = match.toLowerCase();
        const emote = allEmotes.get(emoteName) || allEmotes.get(match);
        
        if (emote) {
            // Создаем безопасный HTML для эмодзи
            const safeUrl = escapeHtml(emote.url);
            const safeName = escapeHtml(emote.name);
            return `<img src="${safeUrl}" alt="${safeName}" class="inline-block w-6 h-6 align-middle" title="${safeName}" />`;
        }
        
        return match;
    });
}

/**
 * Очищает кэш смайлов
 */
export function clearEmotesCache() {
    emotesCache.clear();
}

/**
 * Получает все смайлы для канала (канальные + глобальные)
 */
export async function getAllEmotesForChannel(channelName) {
    const [channelEmotes, globalEmotes] = await Promise.all([
        getChannelEmotes(channelName),
        getGlobalEmotes()
    ]);
    
    return { channelEmotes, globalEmotes };
}
