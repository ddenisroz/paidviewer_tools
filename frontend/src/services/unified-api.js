/**
 * Унифицированный API клиент
 * Объединяет работу с Bot и TTS сервисами в удобном интерфейсе
 */

import microservicesAPI from './microservices.js';

class UnifiedAPI {
    constructor() {
        this.microservices = microservicesAPI;
    }

    // ========================================
    // СИСТЕМНЫЕ МЕТОДЫ
    // ========================================

    /**
     * Проверка состояния всех сервисов
     */
    async getSystemHealth() {
        const [botHealth, ttsHealth] = await Promise.allSettled([
            this.microservices.getBotHealth(),
            this.microservices.getTtsHealth()
        ]);

        return {
            bot: botHealth.status === 'fulfilled' ? botHealth.value : { status: 'error', error: botHealth.reason },
            tts: ttsHealth.status === 'fulfilled' ? ttsHealth.value : { status: 'error', error: ttsHealth.reason },
            overall: (botHealth.status === 'fulfilled' && ttsHealth.status === 'fulfilled') ? 'healthy' : 'degraded'
        };
    }

    // ========================================
    // TTS МЕТОДЫ
    // ========================================

    /**
     * Синтез речи
     */
    async synthesizeSpeech(text, voiceName, channelName, settings = {}) {
        return await this.microservices.synthesizeSpeech(text, voiceName, channelName, settings);
    }

    /**
     * Получить список голосов
     */
    async getVoices() {
        return await this.microservices.getVoices();
    }

    /**
     * Получить статус TTS сервиса
     */
    async getTtsStatus() {
        return await this.microservices.getTtsServiceStatus();
    }

    /**
     * Получить URL аудио файла
     */
    getAudioUrl(filename) {
        return this.microservices.getAudioUrl(filename);
    }

    // ========================================
    // АДМИН ПАНЕЛЬ
    // ========================================

    /**
     * Получить дашборд админ панели
     */
    async getAdminDashboard() {
        return await this.microservices.getAdminDashboard();
    }

    /**
     * Получить аналитику голосов
     */
    async getVoiceAnalytics() {
        return await this.microservices.getVoiceAnalytics();
    }

    /**
     * Обновить настройки голоса
     */
    async updateVoiceSettings(voiceName, settings) {
        return await this.microservices.updateVoiceSettings(voiceName, settings);
    }

    // ========================================
    // ЧАТ И МОДЕРАЦИЯ
    // ========================================

    /**
     * Получить сообщения чата
     */
    async getChatMessages(limit = 50) {
        return await this.microservices.getChatMessages(limit);
    }

    /**
     * Замутить пользователя
     */
    async muteUser(username) {
        return await this.microservices.muteUser(username);
    }

    /**
     * Размутить пользователя
     */
    async unmuteUser(username) {
        return await this.microservices.unmuteUser(username);
    }

    /**
     * Получить список замученных пользователей
     */
    async getMutedUsers() {
        return await this.microservices.getMutedUsers();
    }

    // ========================================
    // TTS УПРАВЛЕНИЕ
    // ========================================

    /**
     * Включить TTS
     */
    async enableTts() {
        return await this.microservices.enableTts();
    }

    /**
     * Отключить TTS
     */
    async disableTts() {
        return await this.microservices.disableTts();
    }

    /**
     * Получить статус TTS (через Bot сервис)
     */
    async getBotTtsStatus() {
        return await this.microservices.getTtsStatus();
    }

    /**
     * Обновить настройки TTS
     */
    async updateTtsSettings(settings) {
        return await this.microservices.updateTtsSettings(settings);
    }

    // ========================================
    // WEBSOCKET МЕТОДЫ
    // ========================================

    /**
     * Подключиться к WebSocket
     */
    connectWebSocket(onMessage, onConnect, onDisconnect) {
        return this.microservices.connectWebSocket(onMessage, onConnect, onDisconnect);
    }

    /**
     * Отключиться от WebSocket
     */
    disconnectWebSocket() {
        return this.microservices.disconnectWebSocket();
    }

    /**
     * Отправить WebSocket сообщение
     */
    sendWebSocketMessage(type, data) {
        return this.microservices.sendWebSocketMessage(type, data);
    }

    // ========================================
    // УТИЛИТЫ
    // ========================================

    /**
     * Проверка готовности системы к работе
     */
    async isSystemReady() {
        try {
            const health = await this.getSystemHealth();
            return health.overall === 'healthy' && 
                   health.bot.status === 'healthy' && 
                   health.tts.ready === true;
        } catch (error) {
            console.error('System readiness check failed:', error);
            return false;
        }
    }

    /**
     * Получить конфигурацию сервисов
     */
    getServiceConfig() {
        return {
            bot_service_url: this.microservices.botServiceUrl,
            tts_service_url: this.microservices.ttsServiceUrl,
            websocket_url: this.microservices.wsUrl
        };
    }
}

// Создаем единственный экземпляр
const unifiedAPI = new UnifiedAPI();

export default unifiedAPI;
