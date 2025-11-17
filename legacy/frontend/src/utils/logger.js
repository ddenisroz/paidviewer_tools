/**
 * Централизованная система логирования для фронтенда
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const CURRENT_LOG_LEVEL = LOG_LEVELS.DEBUG; // Включаем все логи для отладки

class Logger {
  constructor(module) {
    this.module = module;
  }

  _log(level, emoji, ...args) {
    if (LOG_LEVELS[level] < CURRENT_LOG_LEVEL) return;
    
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const prefix = `[${timestamp}] ${emoji} [${this.module}]`;
    
    switch(level) {
      case 'DEBUG':
        console.log(prefix, ...args);
        break;
      case 'INFO':
        console.info(prefix, ...args);
        break;
      case 'WARN':
        console.warn(prefix, ...args);
        break;
      case 'ERROR':
        console.error(prefix, ...args);
        break;
    }
  }

  debug(...args) {
    this._log('DEBUG', '🔍', ...args);
  }

  info(...args) {
    this._log('INFO', 'ℹ️', ...args);
  }

  warn(...args) {
    this._log('WARN', '⚠️', ...args);
  }

  error(...args) {
    this._log('ERROR', '❌', ...args);
  }

  success(...args) {
    this._log('INFO', '✅', ...args);
  }

  api(method, endpoint, data) {
    this._log('DEBUG', '📡', `${method} ${endpoint}`, data);
  }

  apiResponse(status, endpoint, data) {
    const emoji = status < 400 ? '✅' : '❌';
    this._log('DEBUG', emoji, `[${status}] ${endpoint}`, data);
  }

  ws(event, data) {
    this._log('DEBUG', '🔌', `WS: ${event}`, data);
  }
}

// Создаем логгеры для разных модулей
export const authLogger = new Logger('AUTH');
export const ttsLogger = new Logger('TTS');
export const chatLogger = new Logger('CHAT');
export const streamLogger = new Logger('STREAM');
export const youtubeLogger = new Logger('YOUTUBE');
export const dropsLogger = new Logger('DROPS');
export const commandsLogger = new Logger('COMMANDS');
export const apiLogger = new Logger('API');
export const wsLogger = new Logger('WEBSOCKET');

export default Logger;
