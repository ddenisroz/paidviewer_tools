import api from './api';
import { logger } from '../utils/prodLogger';

export const getActiveChannels = async () => {
    try {
        const response = await api.get('/api/active-channels');
        return response.data;
    } catch (error) {
        logger.error('Failed to fetch active channels:', error);
        // Возвращаем пустой массив при ошибке
        return [];
    }
};

// Кэш для аватарок
const avatarCache = new Map();

export const getChannelAvatar = (username, platform) => {
    // Просто используем ui-avatars для всех платформ
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=1f2937&color=ffffff&size=48`;
};
