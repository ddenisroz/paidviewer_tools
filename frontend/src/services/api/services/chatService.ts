/**
 * Chat service API wrapper.
 */
import { apiClient } from '../client';

import type { ApiResponse } from '../../../types';
import type { AxiosResponse } from 'axios';

interface ChatAnalysisResponse {
    result?: string;
    channel_name?: string;
}

export const chatService = {
    async connectBot(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/chat/connect');
    },

    async disconnectBot(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/chat/disconnect');
    },

    async getBotStatus(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/chat/status');
    },

    async getChatHistory(params: Record<string, unknown> = {}): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/chat/history', { params });
    },

    async analyzeUser(data: {
        username: string;
        platform: 'twitch' | 'vk';
        channel_name?: string;
    }): Promise<AxiosResponse<ApiResponse<ChatAnalysisResponse>>> {
        return apiClient.post('/api/chat/analysis', data);
    },

    async toggleMute(data: {
        username: string;
        platform: string;
        channel_name?: string;
    }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/moderation/toggle-mute', data);
    },

    async getMutedUsers(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/moderation/muted-users');
    },

    async getBotStatusForUser(username: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get(`/api/status/${username}`);
    },

    async toggleBotTts(data: { is_enabled: boolean }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/bot/tts/toggle', data);
    },
};
