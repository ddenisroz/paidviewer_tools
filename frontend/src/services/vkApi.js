// src/services/vkApi.js
import api from './api';
import { logger } from '../utils/prodLogger';

export const vkApi = {
    // Получить информацию о стриме
    async getStreamInfo() {
        try {
            const response = await api.get('/api/vk/stream-info');
            return response.data;
        } catch (error) {
            logger.error('Error fetching VK stream info:', error);
            return null;
        }
    },

    // Получить количество зрителей
    async getViewerCount() {
        try {
            const response = await api.get('/api/vk/viewers');
            return response.data;
        } catch (error) {
            logger.error('Error fetching VK viewers:', error);
            return 0;
        }
    },

    // Обновить название стрима
    async updateStreamTitle(title) {
        try {
            const response = await api.post('/api/vk/update-title', {
                title
            });
            return response.data;
        } catch (error) {
            logger.error('Error updating VK title:', error);
            throw error;
        }
    },

    // Получить категории
    async getCategories() {
        try {
            const response = await api.get('/api/vk/categories');
            return response.data;
        } catch (error) {
            logger.error('Error fetching VK categories:', error);
            return [];
        }
    },

    // Обновить категорию
    async updateCategory(categoryId) {
        try {
            const response = await api.post('/api/vk/update-category', {
                categoryId
            });
            return response.data;
        } catch (error) {
            logger.error('Error updating VK category:', error);
            throw error;
        }
    }
};
