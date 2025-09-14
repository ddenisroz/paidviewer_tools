// src/services/twitchApi.js
import api from './api';

export const twitchApi = {
    // Получить информацию о стриме
    async getStreamInfo() {
        try {
            const response = await api.get('/api/twitch/stream-info');
            return response.data;
        } catch (error) {
            console.error('Error fetching Twitch stream info:', error);
            return null;
        }
    },

    // Получить количество зрителей
    async getViewerCount() {
        try {
            const response = await api.get('/api/twitch/viewers');
            return response.data;
        } catch (error) {
            console.error('Error fetching Twitch viewers:', error);
            return 0;
        }
    },

    // Обновить название стрима
    async updateStreamTitle(title) {
        try {
            const response = await api.post('/api/twitch/update-title', {
                title
            });
            return response.data;
        } catch (error) {
            console.error('Error updating Twitch title:', error);
            throw error;
        }
    },

    // Получить категории
    async getCategories(search = '') {
        try {
            const response = await api.get(`/api/twitch/categories?search=${search}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching Twitch categories:', error);
            return [];
        }
    },

    // Обновить категорию
    async updateCategory(categoryId) {
        try {
            const response = await api.post('/api/twitch/update-category', {
                category_id: categoryId
            });
            return response.data;
        } catch (error) {
            console.error('Error updating Twitch category:', error);
            throw error;
        }
    }
};
