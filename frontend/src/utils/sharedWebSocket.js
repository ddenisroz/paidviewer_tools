// frontend/src/utils/sharedWebSocket.js
/**
 * Shared WebSocket Manager
 * Использует Leader Election для управления одним WebSocket соединением между вкладками
 */

import Logger from './logger';
import { WS_BASE_URL } from '../constants';

const logger = new Logger('SHARED_WS');

class SharedWebSocketManager {
    constructor() {
        this.ws = null;
        this.isLeader = false;
        this.tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.channel = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimeout = null;
        this.messageHandlers = new Set();
        this.leaderHeartbeatInterval = null;
        this.leaderCheckInterval = null;
        this.lastLeaderHeartbeat = Date.now();
        this.leaderResponseReceived = false; // 🚀 ANTI-FLASH: флаг для быстрого определения активного лидера
        
        logger.info(`[${this.tabId}] Tab initialized`);
    }

    /**
     * Инициализация BroadcastChannel и Leader Election
     */
    init(userId) {
        if (this.channel) {
            logger.warn(`[${this.tabId}] Already initialized`);
            return;
        }

        this.userId = userId;
        this.channel = new BroadcastChannel(`ws_chat_${userId}`);
        
        // Слушаем сообщения от других вкладок
        this.channel.onmessage = (event) => {
            this._handleChannelMessage(event.data);
        };

        // Проверяем, есть ли уже лидер
        this._electLeader();

        // Периодически проверяем состояние лидера
        this.leaderCheckInterval = setInterval(() => {
            this._checkLeaderHealth();
        }, 3000);

        logger.info(`[${this.tabId}] BroadcastChannel initialized for user ${userId}`);
    }

    /**
     * Выборы лидера
     */
    _electLeader() {
        // Сбрасываем флаг ответа
        this.leaderResponseReceived = false;
        
        // Отправляем запрос: кто-нибудь уже лидер?
        this.channel.postMessage({
            type: 'leader_ping',
            tabId: this.tabId
        });

        // 🚀 ANTI-FLASH: Ждём ответа 200ms (быстрее, чем 5-6 секунд)
        // Если лидер живой - он ответит мгновенно
        setTimeout(() => {
            if (!this.isLeader && !this.leaderResponseReceived) {
                // Никто не ответил быстро - становимся лидером
                logger.info(`[${this.tabId}] No leader response, becoming leader`);
                this._becomeLeader();
            }
        }, 200);
    }

    /**
     * Стать лидером
     */
    _becomeLeader() {
        if (this.isLeader) return;

        this.isLeader = true;
        logger.info(`[${this.tabId}] 👑 Became LEADER - opening WebSocket`);

        // Открываем WebSocket
        this._connectWebSocket();

        // Отправляем heartbeat каждые 2 секунды
        this.leaderHeartbeatInterval = setInterval(() => {
            this.channel.postMessage({
                type: 'leader_heartbeat',
                tabId: this.tabId,
                timestamp: Date.now()
            });
        }, 2000);

        // Уведомляем другие вкладки
        this.channel.postMessage({
            type: 'leader_elected',
            tabId: this.tabId
        });
    }

    /**
     * Отказаться от лидерства (при закрытии вкладки)
     */
    _resignLeader() {
        if (!this.isLeader) return;

        this.isLeader = false;
        logger.info(`[${this.tabId}] Resigned as leader`);

        if (this.leaderHeartbeatInterval) {
            clearInterval(this.leaderHeartbeatInterval);
            this.leaderHeartbeatInterval = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Уведомляем другие вкладки
        this.channel.postMessage({
            type: 'leader_resigned',
            tabId: this.tabId
        });
    }

    /**
     * Проверка здоровья лидера
     */
    _checkLeaderHealth() {
        if (this.isLeader) return; // Лидер сам себя не проверяет

        const timeSinceLastHeartbeat = Date.now() - this.lastLeaderHeartbeat;
        
        // Ждем 5 секунд перед выборами - защита от перезагрузки страницы
        if (timeSinceLastHeartbeat > 5000) {
            logger.warn(`[${this.tabId}] Leader seems dead (no heartbeat for ${timeSinceLastHeartbeat}ms), starting election`);
            this._electLeader();
        }
    }

    /**
     * Обработка сообщений от других вкладок
     */
    _handleChannelMessage(data) {
        switch (data.type) {
            case 'leader_ping':
                // Кто-то спрашивает, есть ли лидер
                if (this.isLeader) {
                    this.channel.postMessage({
                        type: 'leader_pong',
                        tabId: this.tabId
                    });
                }
                break;

            case 'leader_pong':
                // Лидер существует
                if (data.tabId !== this.tabId) {
                    this.lastLeaderHeartbeat = Date.now();
                    this.leaderResponseReceived = true; // 🚀 ANTI-FLASH: помечаем что лидер активен
                    logger.debug(`[${this.tabId}] Leader ${data.tabId} is active`);
                }
                break;

            case 'leader_heartbeat':
                // Heartbeat от лидера
                if (data.tabId !== this.tabId) {
                    this.lastLeaderHeartbeat = data.timestamp;
                }
                break;

            case 'leader_elected':
                // Новый лидер выбран
                if (data.tabId !== this.tabId) {
                    this.isLeader = false;
                    this.lastLeaderHeartbeat = Date.now();
                    logger.info(`[${this.tabId}] New leader elected: ${data.tabId}`);
                }
                break;

            case 'leader_resigned':
                // Лидер отказался от полномочий
                if (data.tabId !== this.tabId) {
                    logger.info(`[${this.tabId}] Leader resigned, starting election`);
                    setTimeout(() => this._electLeader(), 50);
                }
                break;

            case 'ws_message':
                // Сообщение от WebSocket (от лидера)
                if (!this.isLeader) {
                    this._notifyHandlers(data.message);
                }
                break;

            default:
                logger.debug(`[${this.tabId}] Unknown message type: ${data.type}`);
        }
    }

    /**
     * Подключение WebSocket (только лидер)
     */
    _connectWebSocket() {
        if (!this.isLeader) {
            logger.warn(`[${this.tabId}] Not a leader, cannot connect WebSocket`);
            return;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            logger.debug(`[${this.tabId}] WebSocket already connected`);
            return;
        }

        try {
            // Используем WS_BASE_URL из констант (настраивается через env переменные)
            // WS_BASE_URL уже импортирован в начале файла
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // Если WS_BASE_URL не определен, используем hostname с портом 8000 (fallback)
            const wsBaseUrl = WS_BASE_URL || `${protocol}//${window.location.hostname}:8000`;
            const wsUrl = `${wsBaseUrl}/ws/chat/${this.userId}`;
            
            logger.info(`[${this.tabId}] 🔌 Connecting WebSocket: ${wsUrl}`);
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                logger.info(`[${this.tabId}] ✅ WebSocket connected`);
                this.reconnectAttempts = 0;
                
                // Уведомляем другие вкладки
                this.channel.postMessage({
                    type: 'ws_connected',
                    tabId: this.tabId
                });
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    // Локальная обработка
                    this._notifyHandlers(data);
                    
                    // Отправляем другим вкладкам
                    this.channel.postMessage({
                        type: 'ws_message',
                        message: data,
                        tabId: this.tabId
                    });
                } catch (error) {
                    logger.error(`[${this.tabId}] Failed to parse message:`, error);
                }
            };

            this.ws.onerror = (error) => {
                logger.error(`[${this.tabId}] ❌ WebSocket error:`, error);
            };

            this.ws.onclose = () => {
                logger.warn(`[${this.tabId}] WebSocket closed`);
                this.ws = null;

                // Пытаемся переподключиться, если всё ещё лидер
                if (this.isLeader && this.reconnectAttempts < this.maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                    this.reconnectAttempts++;
                    
                    logger.info(`[${this.tabId}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    
                    this.reconnectTimeout = setTimeout(() => {
                        if (this.isLeader) {
                            this._connectWebSocket();
                        }
                    }, delay);
                }
            };

        } catch (error) {
            logger.error(`[${this.tabId}] Failed to create WebSocket:`, error);
        }
    }

    /**
     * Добавить обработчик сообщений
     */
    addMessageHandler(handler) {
        this.messageHandlers.add(handler);
    }

    /**
     * Удалить обработчик сообщений
     */
    removeMessageHandler(handler) {
        this.messageHandlers.delete(handler);
    }

    /**
     * Уведомить все обработчики о новом сообщении
     */
    _notifyHandlers(message) {
        this.messageHandlers.forEach(handler => {
            try {
                handler(message);
            } catch (error) {
                logger.error(`[${this.tabId}] Handler error:`, error);
            }
        });
    }

    /**
     * Отправить сообщение (только лидер)
     */
    send(data) {
        if (!this.isLeader) {
            logger.warn(`[${this.tabId}] Not a leader, cannot send message`);
            return;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
        } else {
            logger.warn(`[${this.tabId}] WebSocket not connected, cannot send message`);
        }
    }

    /**
     * Очистка ресурсов
     */
    cleanup() {
        logger.info(`[${this.tabId}] Cleaning up...`);

        if (this.leaderCheckInterval) {
            clearInterval(this.leaderCheckInterval);
        }

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        this._resignLeader();

        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }

        this.messageHandlers.clear();
    }
}

// 🔒 Singleton Pattern - глобальный менеджер для ВСЕХ вкладок и контекстов
// Один экземпляр на весь браузер (все вкладки синхронизируются через BroadcastChannel)
let globalInstance = null;

/**
 * Получить глобальный экземпляр SharedWebSocketManager (Singleton)
 * @param {string|number} userId - ID пользователя для подключения
 * @returns {SharedWebSocketManager}
 */
export const getSharedWebSocket = (userId) => {
    // Если экземпляр уже существует И userId не изменился - возвращаем его
    if (globalInstance && globalInstance.userId === userId) {
        return globalInstance;
    }
    
    // Если userId изменился - чистим старый экземпляр и создаём новый
    if (globalInstance && globalInstance.userId !== userId) {
        logger.warn(`[SINGLETON] User changed from ${globalInstance.userId} to ${userId}, recreating manager`);
        globalInstance.cleanup();
        globalInstance = null;
    }
    
    // Создаём новый экземпляр
    if (!globalInstance) {
        logger.info(`[SINGLETON] Creating new global SharedWebSocketManager for user ${userId}`);
        globalInstance = new SharedWebSocketManager();
        globalInstance.init(userId);
    }
    
    return globalInstance;
};

export default getSharedWebSocket;

