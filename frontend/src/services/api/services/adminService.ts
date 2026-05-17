import { apiClient } from '../client';

import type { ApiResponse } from '../../../types';
import type { AxiosResponse } from 'axios';

export const adminService = {
    async getOverview(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/overview');
    },

    async getRuntimeOverview(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/runtime');
    },

    async getTtsOverview(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/tts');
    },

    async getAccountsOverview(params: Record<string, unknown> = {}): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/accounts', { params });
    },

    async getChannelsOverview(params: Record<string, unknown> = {}): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/channels', { params });
    },

    async getLogsOverview(params: Record<string, unknown> = {}): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/logs/overview', { params });
    },

    async getAdminList(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/list');
    },

    async getWhitelist(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/whitelist');
    },

    async getCacheStats(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/monitoring/cache/stats');
    },

    async clearCache(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/monitoring/cache/clear');
    },

    async cleanupExpiredCache(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/monitoring/cache/cleanup');
    },

    async getBotsStatus(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/bots/status');
    },

    async getSystemLogs(params: Record<string, unknown> = {}): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/system/logs', { params });
    },

    async getMonitoringMetrics(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/monitoring/metrics');
    },

    async getBlockedChannels(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/blocked-channels');
    },

    async blockChannel(data: { channel_name: string; reason?: string }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/admin/blocked-channels', data, { params: data });
    },

    async unblockChannel(channelId: number): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.delete(`/api/admin/blocked-channels/${channelId}`);
    },

    async getAdminLogs(params: Record<string, unknown> = {}): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/logs', { params });
    },

    async getLogsStats(daysRange: number = 7): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get(`/api/admin/logs/stats?days=${daysRange}`);
    },

    async getLogsActions(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/logs/actions');
    },

    async getDatabaseStats(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/database/stats');
    },

    async cleanupDatabase(data: { cleanup_type: string }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/database/cleanup', data);
    },

    async getBackups(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/database/backups');
    },

    async deleteBackup(filename: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.delete(`/api/database/backups/${filename}`);
    },

    async restoreBackup(filename: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post(`/api/database/backups/${filename}/restore`);
    },

    async getUsers(params: Record<string, unknown> = {}): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/users', { params });
    },

    async getSessions(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/sessions');
    },

    async updateUser(userId: number, data: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.put(`/api/admin/users/${userId}`, data);
    },

    async blockUser(userId: number, data: { reason?: string }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post(`/api/admin/users/${userId}/block`, data, {
            params: data.reason ? { reason: data.reason } : undefined,
        });
    },

    async unblockUser(userId: number): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post(`/api/admin/users/${userId}/unblock`);
    },

    async deleteUser(userId: number): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.delete(`/api/admin/users/${userId}`);
    },

    async addToWhitelist(data: { username: string; platform: string }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/admin/whitelist/add', data);
    },

    async removeFromWhitelist(channelName: string, platform: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.delete(`/api/admin/whitelist/${channelName}`, { params: { platform } });
    },

    async getTtsStatus(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/admin/tts/status');
    },

    async getTtsWorkers(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/tts/admin/workers');
    },

    async restartBotService(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/admin/bot-service/restart');
    },

    async restartTtsEngine(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/admin/tts/restart');
    },

    async getBotTokenStatus(platform: 'twitch' | 'vk'): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get(`/api/admin/bot/${platform}/token-status`);
    },

    async refreshBotToken(platform: 'twitch' | 'vk'): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post(`/api/admin/bot/${platform}/refresh-token`);
    },

    async createBotLoginLink(platform: 'twitch' | 'vk'): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get(`/api/admin/bot/${platform}/login-link`);
    },
};
