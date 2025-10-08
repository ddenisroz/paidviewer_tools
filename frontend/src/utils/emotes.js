// frontend/src/utils/emotes.js
// Утилиты для обработки эмодзи и смайлов

// 7TV API для получения смайлов
const SEVENTV_API_BASE = 'https://7tv.io/v3';

// Кэш для смайлов
const emotesCache = new Map();

/**
 * Получает смайлы канала с 7TV
 */
export async function getChannelEmotes(channelName) {
    try {
        if (emotesCache.has(channelName)) {
            return emotesCache.get(channelName);
        }

        const response = await fetch(`${SEVENTV_API_BASE}/users/twitch/${channelName}`);
        if (!response.ok) {
            throw new Error('Failed to fetch 7TV emotes');
        }

        const data = await response.json();
        const emotes = data.emote_set?.emotes || [];
        
        // Создаем мапу смайлов для быстрого поиска
        const emotesMap = new Map();
        emotes.forEach(emote => {
            emotesMap.set(emote.name, {
                id: emote.id,
                name: emote.name,
                url: `https://cdn.7tv.app/emote/${emote.id}/4x.webp`,
                animated: emote.animated || false
            });
        });

        emotesCache.set(channelName, emotesMap);
        return emotesMap;
    } catch (error) {
        console.error('Error fetching 7TV emotes:', error);
        return new Map();
    }
}

/**
 * Получает глобальные смайлы 7TV
 */
export async function getGlobalEmotes() {
    try {
        if (emotesCache.has('global')) {
            return emotesCache.get('global');
        }

        const response = await fetch(`${SEVENTV_API_BASE}/emote-sets/global`);
        if (!response.ok) {
            throw new Error('Failed to fetch global 7TV emotes');
        }

        const data = await response.json();
        const emotes = data.emotes || [];
        
        const emotesMap = new Map();
        emotes.forEach(emote => {
            emotesMap.set(emote.name, {
                id: emote.id,
                name: emote.name,
                url: `https://cdn.7tv.app/emote/${emote.id}/4x.webp`,
                animated: emote.animated || false
            });
        });

        emotesCache.set('global', emotesMap);
        return emotesMap;
    } catch (error) {
        console.error('Error fetching global 7TV emotes:', error);
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

    // Сначала экранируем весь HTML для безопасности
    const escapedMessage = escapeHtml(message);

    // Объединяем канальные и глобальные смайлы
    const allEmotes = new Map([...channelEmotes, ...globalEmotes]);
    
    // Создаем регулярное выражение для поиска смайлов
    const emoteNames = Array.from(allEmotes.keys()).map(name => 
        name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('|');
    
    if (emoteNames.length === 0) {
        return escapedMessage;
    }

    const emoteRegex = new RegExp(`\\b(${emoteNames})\\b`, 'gi');
    
    return escapedMessage.replace(emoteRegex, (match) => {
        const emoteName = match.toLowerCase();
        const emote = allEmotes.get(emoteName) || allEmotes.get(match);
        
        if (emote) {
            // Дополнительно экранируем атрибуты для безопасности
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
