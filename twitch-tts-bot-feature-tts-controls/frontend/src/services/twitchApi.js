// src/services/twitchApi.js
import api from './api';

const twitchApi = {
    // Получить информацию о стриме
    async getStreamInfo(forceRefresh = false) {
        try {
            const response = await api.get(`/api/twitch/stream-info?force=${forceRefresh}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching Twitch stream info:', error);
            return null;
        }
    },

    // Обновить название стрима
    async updateStreamTitle(title) {
        try {
            const response = await api.post('/api/twitch/stream/title', { title });
            return response.data;
        } catch (error) {
            console.error('API Error updating stream title:', error.response?.data || error);
            throw error;
        }
    },

    // Получить категории
    async getCategories(search = '', forceRefresh = false) {
        try {
            const response = await api.get(`/api/twitch/categories?search=${search}`);
            return response.data; // Теперь API возвращает массив напрямую
        } catch (error) {
            console.error('Error fetching Twitch categories:', error);
            return [];
        }
    },

    // Обновить категорию
    async updateCategory(categoryId) {
        try {
            const response = await api.post('/api/twitch/category', { categoryId: categoryId });
            return response.data;
        } catch (error) {
            console.error('API Error updating stream category:', error.response?.data || error);
            throw error;
        }
    }
};

export { twitchApi };
