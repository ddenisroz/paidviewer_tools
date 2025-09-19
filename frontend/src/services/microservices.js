/**
 * Микросервисы API клиент
 * Работает с отдельными сервисами Bot и TTS
 */

// Конфигурация сервисов
const BOT_SERVICE_URL = import.meta.env.VITE_BOT_SERVICE_URL || 'http://localhost:8000';
const TTS_SERVICE_URL = import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost:8001';

// WebSocket для Bot сервиса
const BOT_WS_URL = import.meta.env.VITE_BOT_WS_URL || 'ws://localhost:8000/ws';

class MicroservicesAPI {
    constructor() {
        this.botServiceUrl = BOT_SERVICE_URL;
        this.ttsServiceUrl = TTS_SERVICE_URL;
        this.wsUrl = BOT_WS_URL;
        this.ws = null;
        this.isConnected = false;
        this.pingInterval = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    // Bot Service API
    async getBotHealth() {
        try {
            const response = await fetch(`${this.botServiceUrl}/health`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Bot сервис недоступен: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Если TTS недоступен, добавляем информацию об ошибке
            if (data.status === 'degraded' && data.tts_error) {
                data.tts_available = false;
                data.tts_ready = false;
                data.tts_error = data.tts_error;
            }
            
            return data;
        } catch (error) {
            console.error('Bot Health check failed:', error);
            return {
                status: 'unhealthy',
                tts_available: false,
                tts_ready: false,
                tts_error: error.message || 'Bot сервис недоступен'
            };
        }
    }

    async getChatMessages(limit = 50) {
        const response = await fetch(`${this.botServiceUrl}/api/chat/messages?limit=${limit}`, {
            credentials: 'include'
        });
        return response.json();
    }

    async muteUser(username) {
        const response = await fetch(`${this.botServiceUrl}/chat/mute/${username}`, {
            method: 'POST',
            credentials: 'include'
        });
        return response.json();
    }

    async unmuteUser(username) {
        const response = await fetch(`${this.botServiceUrl}/chat/unmute/${username}`, {
            method: 'POST',
            credentials: 'include'
        });
        return response.json();
    }

    async getMutedUsers() {
        const response = await fetch(`${this.botServiceUrl}/chat/muted`, {
            credentials: 'include'
        });
        return response.json();
    }

    async enableTts() {
        const response = await fetch(`${this.botServiceUrl}/tts/enable`, {
            method: 'POST',
            credentials: 'include'
        });
        return response.json();
    }

    async disableTts() {
        const response = await fetch(`${this.botServiceUrl}/tts/disable`, {
            method: 'POST',
            credentials: 'include'
        });
        return response.json();
    }

    async getTtsStatus() {
        const response = await fetch(`${this.botServiceUrl}/tts/status`, {
            credentials: 'include'
        });
        return response.json();
    }

    async getTtsVoicesStatus() {
        const response = await fetch(`${this.botServiceUrl}/api/voices/tts/status`, {
            credentials: 'include'
        });
        return response.json();
    }

    async updateTtsSettings(settings) {
        const response = await fetch(`${this.botServiceUrl}/tts/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(settings)
        });
        return response.json();
    }

    // TTS Service API
    async getTtsHealth() {
        try {
            const response = await fetch(`${this.ttsServiceUrl}/health`);
            if (!response.ok) {
                throw new Error(`TTS сервис недоступен: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            console.error('TTS Health check failed:', error);
            return {
                ready: false,
                engine_type: 'none',
                error: error.message || 'TTS сервис недоступен'
            };
        }
    }

    async synthesizeSpeech(text, voiceName, channelName, settings = {}) {
        const response = await fetch(`${this.ttsServiceUrl}/api/tts/synthesize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text,
                voice_name: voiceName,
                channel_name: channelName,
                settings
            })
        });
        return response.json();
    }

    async getVoices() {
        const response = await fetch(`${this.ttsServiceUrl}/api/voices`);
        return response.json();
    }

    async getTtsServiceStatus() {
        const response = await fetch(`${this.ttsServiceUrl}/api/tts/status`);
        return response.json();
    }

    // Админ панель API
    async getAdminDashboard() {
        const response = await fetch(`${this.ttsServiceUrl}/api/admin/dashboard`);
        return response.json();
    }

    async getVoiceAnalytics() {
        const response = await fetch(`${this.ttsServiceUrl}/api/admin/voices/analytics`);
        return response.json();
    }

    async updateVoiceSettings(voiceName, settings) {
        const response = await fetch(`${this.ttsServiceUrl}/api/admin/voices/settings/${voiceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        return response.json();
    }

    getAudioUrl(filename) {
        return `${this.ttsServiceUrl}/audio/${filename}`;
    }

    // WebSocket для Bot сервиса
    connectWebSocket(onMessage, onConnect, onDisconnect) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        // Закрываем существующее соединение если есть
        if (this.ws) {
            this.ws.close();
        }

        console.log('Подключение к WebSocket:', this.wsUrl);
        this.ws = new WebSocket(this.wsUrl);
        
        this.ws.onopen = () => {
            this.isConnected = true;
            this.reconnectAttempts = 0; // Сбрасываем счетчик при успешном подключении
            console.log('WebSocket подключен к Bot сервису');
            
            // Отправляем ping сообщение для поддержания соединения
            this.ws.send(JSON.stringify({ type: 'ping' }));
            
            // Запускаем периодический ping каждые 60 секунд
            this.pingInterval = setInterval(() => {
                if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: 'ping' }));
                }
            }, 60000);
            
            if (onConnect) onConnect();
        };

        this.ws.onmessage = (event) => {
            try {
                // Пытаемся парсить как JSON
                const message = JSON.parse(event.data);
                
                // Обрабатываем ping сообщения
                if (message.type === 'ping' || message.type === 'echo') {
                    console.log('WebSocket ping получен');
                    return;
                }
                
                console.log('WebSocket сообщение получено:', message);
                
                if (onMessage) onMessage(message);
            } catch (error) {
                // Если не JSON, обрабатываем как текстовое сообщение
                if (event.data === 'ping') {
                    console.log('WebSocket ping получен');
                    return;
                }
                console.log('WebSocket текстовое сообщение:', event.data);
            }
        };

        this.ws.onclose = () => {
            this.isConnected = false;
            console.log('WebSocket отключен от Bot сервиса');
            if (onDisconnect) onDisconnect();
            
            // Переподключение только если не превышен лимит попыток
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Экспоненциальная задержка
                console.log(`Попытка переподключения WebSocket... (${this.reconnectAttempts}/${this.maxReconnectAttempts}) через ${delay}мс`);
                
                setTimeout(() => {
                    this.connectWebSocket(onMessage, onConnect, onDisconnect);
                }, delay);
            } else {
                console.log('Превышен лимит попыток переподключения WebSocket');
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
        };
    }

    disconnectWebSocket() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
        }
    }

    sendWebSocketMessage(type, data) {
        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify({ type, data }));
        }
    }
}

// Создаем единственный экземпляр
const microservicesAPI = new MicroservicesAPI();

export default microservicesAPI;
