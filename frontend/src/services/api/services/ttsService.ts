/**
 * TTS Service - инкапсуляция всех TTS API вызовов
 * Использует единый API клиент
 */
import { logger } from '@/shared/utils/prodLogger';

import { apiClient } from '../client';

import type {
    ApiResponse,
    BlockedUser,
    FilteredWord,
    LocalTtsConfig,
    TtsSettings,
    TtsStatus,
    TtsVoice,
} from '../../../types';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * TTS Service
 */
export const ttsService = {
    /**
     * Получить статус TTS
     * @param channelName - Имя канала (опционально)
     * @returns Promise с ответом API
     */
    async getStatus(channelName: string | null = null): Promise<AxiosResponse<ApiResponse<TtsStatus>>> {
        const params = channelName ? { channel_name: channelName } : {};
        return apiClient.get('/api/tts/status', { params });
    },

    /**
     * Включить TTS
     * @returns Promise с ответом API
     */
    async enable(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/enable');
    },

    /**
     * Выключить TTS
     * @returns Promise с ответом API
     */
    async disable(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/disable');
    },

    /**
     * Получить настройки TTS
     * @returns Promise с ответом API
     */
    async getSettings(): Promise<AxiosResponse<ApiResponse<TtsSettings>>> {
        return apiClient.get('/api/tts/settings');
    },

    /**
     * Сохранить настройки TTS
     * @param settings - Настройки TTS
     * @returns Promise с ответом API
     */
    async saveSettings(settings: Partial<TtsSettings>): Promise<AxiosResponse<ApiResponse<TtsSettings>>> {
        return apiClient.post('/api/tts/settings', settings);
    },

    /**
     * Получить список голосов Google Cloud TTS
     */
    async getGcloudVoices(language = 'ru-RU'): Promise<AxiosResponse<ApiResponse<{ voices: unknown[] }>>> {
        return apiClient.get('/api/tts/gcloud/voices', { params: { language } });
    },

    /**
     * Сохранить выбранные голоса Google Cloud TTS
     */
    async saveGcloudVoices(voices: string[]): Promise<AxiosResponse<ApiResponse<{ voices: string[] }>>> {
        return apiClient.post('/api/tts/gcloud/voices', { voices });
    },

    /**
     * Предпрослушка голоса Google Cloud TTS
     */
    async previewGcloudVoice(payload: {
        voice_name: string;
        text?: string;
        mood?: 'neutral' | 'sad' | 'happy';
        model_name?: string;
    }): Promise<AxiosResponse<ApiResponse<{ audio_url?: string }>>> {
        return apiClient.post('/api/tts/gcloud/preview', payload);
    },

    /**
     * Получить аудио настройки TTS
     * @returns Promise с ответом API
     */
    async getAudioSettings(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/tts/audio-settings');
    },

    /**
     * Сохранить аудио настройки TTS
     * @param settings - Аудио настройки
     * @returns Promise с ответом API
     */
    async saveAudioSettings(settings: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/audio-settings', settings);
    },

    /**
     * Получить настройки платформы TTS
     * @returns Promise с ответом API
     */
    async getPlatformSettings(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/tts/platform-settings');
    },

    /**
     * Сохранить настройки платформы TTS
     * @param settings - Настройки платформы
     * @returns Promise с ответом API
     */
    async savePlatformSettings(settings: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/platform-settings', settings);
    },

    /**
     * Получить настройки режима TTS
     * @returns Promise с ответом API
     */
    async getModeSettings(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/tts/mode-settings');
    },

    /**
     * Сохранить настройки режима TTS
     * @param settings - Настройки режима
     * @returns Promise с ответом API
     */
    async saveModeSettings(settings: Record<string, unknown>): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/mode-settings', settings);
    },

    /**
     * Сгенерировать OBS URL для TTS
     * @returns Promise с ответом API
     */
    async generateObsUrl(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/generate-obs-url');
    },

    /**
     * Регенерировать OBS URL для TTS
     * @returns Promise с ответом API
     */
    async regenerateObsUrl(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/regenerate-obs-url');
    },

    async regenerateObsLinks(target: 'dock' | 'source' | 'both' = 'both'): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/obs-links/regenerate', { target });
    },

    /**
     * Получить OBS URL для TTS
     * @returns Promise с ответом API
     */
    async getObsUrl(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/tts/obs-url');
    },

    async getObsLinks(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/tts/obs-links');
    },

    async getObsStatus(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/tts/obs-status');
    },

    /**
     * Установить режим прослушивания TTS
     * @param data - Данные режима
     * @returns Promise с ответом API
     */
    async setListeningMode(data: { listeningMode: string }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/listening-mode', data);
    },

    /**
     * Установить движок TTS
     * @param data - Данные движка
     * @returns Promise с ответом API
     */
    async setEngine(data: { engine_type: string }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/engine', data);
    },

    /**
     * Получить health статус TTS сервиса
     * @returns Promise с ответом API
     */
    async getHealth(provider: 'f5' | 'gcloud' = 'f5', mode?: 'cloud' | 'local'): Promise<AxiosResponse<ApiResponse>> {
        try {
            return await apiClient.get('/api/tts/health', {
                params: { provider, mode },
                timeout: 3000,
                skipRetry: true,
            } as AxiosRequestConfig & { skipRetry: boolean });
        } catch (error) {
            logger.error('Error fetching TTS health:', error);
            return {
                data: {
                    success: false,
                    data: {
                        status: 'unhealthy',
                        healthy: false,
                        provider,
                        mode,
                    },
                },
                status: 500,
                statusText: 'Internal Server Error',
                headers: {},
                config: {} as unknown,
            } as AxiosResponse<ApiResponse>;
        }
    },

    async getProviderCapabilities(): Promise<AxiosResponse<ApiResponse<Record<string, unknown>>>> {
        return apiClient.get('/api/voices/providers/capabilities');
    },

    /**
     * Получить глобальные голоса
     * @returns Promise с ответом API
     */
    async getGlobalVoices(provider: 'f5' = 'f5'): Promise<AxiosResponse<ApiResponse<TtsVoice[]>>> {
        return apiClient.get('/api/voices/global', { params: { provider } });
    },

    /**
     * Получить голоса пользователя
     * @param userId - ID пользователя
     * @returns Promise с ответом API
     */
    async getUserVoices(userId: number, provider: 'f5' = 'f5'): Promise<AxiosResponse<ApiResponse<TtsVoice[]>>> {
        return apiClient.get(`/api/user/voices/${userId}`, { params: { provider } });
    },

    /**
     * Загрузить голос пользователя
     * @param userId - ID пользователя
     * @param formData - FormData с файлом голоса
     * @returns Promise с ответом API
     */
    async uploadUserVoice(
        userId: number,
        formData: FormData,
        provider: 'f5' = 'f5'
    ): Promise<AxiosResponse<ApiResponse<TtsVoice>>> {
        const payload = new FormData();
        formData.forEach((value, key) => {
            payload.append(key, value);
        });

        if (!payload.get('name')) {
            const fallbackName = payload.get('voice_name');
            if (fallbackName) {
                payload.append('name', fallbackName);
            }
        }

        return apiClient.post('/api/user/voices/upload', payload, {
            params: { user_id: userId, provider },
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },

    /**
     * Загрузить голос (глобальный)
     * @param formData - FormData с файлом голоса
     * @returns Promise с ответом API
     */
    async uploadVoice(formData: FormData, provider: 'f5' = 'f5'): Promise<AxiosResponse<ApiResponse<TtsVoice>>> {
        return apiClient.post('/api/voices/admin/upload', formData, {
            params: { provider },
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },

    /**
     * Удалить голос пользователя
     * @param voiceId - ID голоса
     * @param userId - ID пользователя
     * @returns Promise с ответом API
     */
    async deleteUserVoice(voiceId: string, userId: number, provider: 'f5' = 'f5'): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.delete(`/api/voices/user/custom/${voiceId}`, {
            params: { user_id: userId, provider },
        });
    },

    /**
     * Удалить голос (глобальный)
     * @param voiceId - ID голоса
     * @returns Promise с ответом API
     */
    async deleteVoice(voiceId: number, provider: 'f5' = 'f5'): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.delete(`/api/voices/admin/global/${voiceId}`, { params: { provider } });
    },

    /**
     * Создать TTS награду для платформы
     * @param data - Данные награды
     * @returns Promise с ответом API
     */
    async createTtsReward(data: {
        platform: string;
        title: string;
        cost: number;
        cooldown: number;
    }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/rewards/create', data);
    },

    /**
     * Привязать существующую TTS награду платформы
     * @param data - Платформа и ID существующей награды
     * @returns Promise с ответом API
     */
    async attachTtsReward(data: { platform: string; reward_id: string }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/rewards/attach', data);
    },

    /**
     * Удалить TTS награду для платформы
     * @param platform - Платформа (twitch/vk)
     * @returns Promise с ответом API
     */
    async deleteTtsReward(platform: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.delete(`/api/tts/rewards/${platform}`);
    },

    /**
     * Тестировать голос
     * @param voiceId - ID голоса
     * @param text - Текст для тестирования
     * @returns Promise с ответом API
     */
    async testVoice(
        voiceId: number,
        text: string,
        provider: 'f5' = 'f5',
        options?: { cfg_strength?: number; speed_preset?: string; reference_text?: string }
    ): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post(
            `/api/voices/${voiceId}/test`,
            {
                text,
                ...(options?.cfg_strength !== undefined ? { cfg_strength: options.cfg_strength } : {}),
                ...(options?.speed_preset ? { speed_preset: options.speed_preset } : {}),
                ...(options?.reference_text ? { reference_text: options.reference_text } : {}),
            },
            { params: { provider } }
        );
    },

    /**
     * Получить отфильтрованные слова
     * @returns Promise с ответом API
     */
    async getFilteredWords(): Promise<AxiosResponse<ApiResponse<FilteredWord[]>>> {
        return apiClient.get('/api/tts/filtered-words');
    },

    /**
     * Добавить отфильтрованное слово
     * @param data - Данные слова
     * @returns Promise с ответом API
     */
    async addFilteredWord(data: {
        word: string;
        channel_name?: string;
    }): Promise<AxiosResponse<ApiResponse<FilteredWord>>> {
        return apiClient.post('/api/tts/filtered-words', data);
    },

    /**
     * Удалить отфильтрованное слово
     * @param wordId - ID слова
     * @returns Promise с ответом API
     */
    async deleteFilteredWord(wordId: number): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.delete(`/api/tts/filtered-words/${wordId}`);
    },

    /**
     * Получить заблокированных пользователей
     * @returns Promise с ответом API
     */
    async getBlockedUsers(): Promise<AxiosResponse<ApiResponse<BlockedUser[]>>> {
        return apiClient.get('/api/tts/blocked-users');
    },

    /**
     * Заблокировать пользователя
     * @param data - Данные для блокировки
     * @returns Promise с ответом API
     */
    async blockUser(data: {
        username: string;
        platform: 'twitch' | 'vk' | 'youtube';
        channel_name?: string;
        reason?: string;
    }): Promise<AxiosResponse<ApiResponse<BlockedUser>>> {
        return apiClient.post('/api/tts/block', data);
    },

    /**
     * Разблокировать пользователя
     * @param data - Данные для разблокировки
     * @returns Promise с ответом API
     */
    async unblockUser(data: {
        username: string;
        platform: 'twitch' | 'vk' | 'youtube';
        channel_name?: string;
    }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/unblock', data);
    },

    /**
     * Получить локальную конфигурацию TTS
     * @returns Promise с ответом API
     */
    async getLocalTtsConfig(provider: 'f5' = 'f5'): Promise<AxiosResponse<ApiResponse<LocalTtsConfig>>> {
        return apiClient.get('/api/local-tts/config', { params: { provider } });
    },

    /**
     * Сохранить локальную конфигурацию TTS
     * @param config - Конфигурация
     * @returns Promise с ответом API
     */
    async saveLocalTtsConfig(config: Partial<LocalTtsConfig>): Promise<AxiosResponse<ApiResponse<LocalTtsConfig>>> {
        return apiClient.post('/api/local-tts/config', config);
    },

    /**
     * Тестировать подключение к локальному TTS
     * @param params - Параметры подключения
     * @returns Promise с ответом API
     */
    async testLocalTtsConnection(params: {
        endpoint_url: string;
        api_key?: string;
        provider?: 'f5';
        use_local?: boolean;
    }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/local-tts/test-connection', params, { skipRetry: true } as AxiosRequestConfig & {
            skipRetry: boolean;
        });
    },

    /**
     * Переключить локальный TTS
     * @returns Promise с ответом API
     */
    async toggleLocalTts(provider: 'f5' = 'f5'): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/local-tts/toggle', null, { params: { provider } });
    },

    async getWorkerAgents(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/tts/workers');
    },

    async createWorkerProvisioning(payload: {
        label_hint?: string;
        provider_hint?: 'f5';
    }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/workers/provisioning', payload);
    },

    async createWorkerPairingToken(payload: {
        label_hint?: string;
        provider_hint?: 'f5';
    }): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post('/api/tts/workers/pairing-tokens', payload);
    },

    async disableWorkerAgent(workerKey: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post(`/api/tts/workers/${encodeURIComponent(workerKey)}/disable`);
    },

    async deleteWorkerAgent(workerKey: string): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.delete(`/api/tts/workers/${encodeURIComponent(workerKey)}`);
    },

    /**
     * Получить статус whitelist
     * @returns Promise с ответом API
     */
    async getWhitelistStatus(): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.get('/api/voices/whitelist-status');
    },

    /**
     * Получить включенные голоса пользователя
     * @param userId - ID пользователя
     * @returns Promise с ответом API
     */
    async getEnabledVoices(userId: number, provider: 'f5' = 'f5'): Promise<AxiosResponse<ApiResponse<number[]>>> {
        return apiClient.get(`/api/user/voices/enabled/${userId}`, { params: { provider } });
    },

    /**
     * Сохранить включенные голоса пользователя
     * @param userId - ID пользователя
     * @param voiceIds - Массив ID голосов
     * @returns Promise с ответом API
     */
    async saveEnabledVoices(
        userId: number,
        voiceIds: number[],
        provider: 'f5' = 'f5'
    ): Promise<AxiosResponse<ApiResponse>> {
        return apiClient.post(`/api/user/voices/enabled/${userId}`, voiceIds, { params: { provider } });
    },
};
