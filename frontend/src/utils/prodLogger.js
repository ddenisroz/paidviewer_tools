// frontend/src/utils/prodLogger.js
/**
 * Production-ready logging wrapper
 * 
 * Автоматически отключает console.log в production,
 * но оставляет console.error для критических ошибок
 * 
 * Usage:
 *   import { logger } from '@/utils/prodLogger';
 *   
 *   logger.log('Debug info');     // Только в DEV
 *   logger.info('Info message');  // Только в DEV
 *   logger.warn('Warning');       // Всегда (важные предупреждения)
 *   logger.error('Error');        // Всегда (критические ошибки)
 */

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

/**
 * Production-safe logger
 */
export const logger = {
    /**
     * Debug logging - только в development
     */
    log: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },
    
    /**
     * Info logging - только в development
     */
    info: (...args) => {
        if (isDevelopment) {
            console.info(...args);
        }
    },
    
    /**
     * Warning logging - всегда (может быть важно в production)
     */
    warn: (...args) => {
        console.warn(...args);
    },
    
    /**
     * Error logging - всегда (критично для debugging production)
     */
    error: (...args) => {
        console.error(...args);
    },
    
    /**
     * Debug logging - только в development
     */
    debug: (...args) => {
        if (isDevelopment) {
            console.debug(...args);
        }
    },
    
    /**
     * Table logging - только в development
     */
    table: (...args) => {
        if (isDevelopment) {
            console.table(...args);
        }
    },
    
    /**
     * Group logging - только в development
     */
    group: (...args) => {
        if (isDevelopment) {
            console.group(...args);
        }
    },
    
    groupEnd: () => {
        if (isDevelopment) {
            console.groupEnd();
        }
    },
    
    /**
     * Time logging - только в development
     */
    time: (label) => {
        if (isDevelopment) {
            console.time(label);
        }
    },
    
    timeEnd: (label) => {
        if (isDevelopment) {
            console.timeEnd(label);
        }
    }
};

/**
 * Утилита для conditional logging в одну строку
 * 
 * Usage:
 *   devLog('This only shows in development');
 */
export const devLog = (...args) => {
    if (isDevelopment) {
        console.log(...args);
    }
};

/**
 * Production error reporter (можно позже интегрировать с Sentry)
 */
export const reportError = (error, context = {}) => {
    console.error('[ERROR]', error, context);
    
    // TODO: В будущем можно добавить отправку в Sentry
    // if (isProduction && window.Sentry) {
    //     window.Sentry.captureException(error, { extra: context });
    // }
};

/**
 * Performance logging - только в development
 */
export const perfLog = (label, startTime) => {
    if (isDevelopment) {
        const duration = performance.now() - startTime;
        console.log(`⏱️ [PERF] ${label}: ${duration.toFixed(2)}ms`);
    }
};

/**
 * Модульный Logger класс для совместимости с кодом, использующим new Logger()
 * @example
 * import Logger from './prodLogger';
 * const logger = new Logger('MODULE');
 * logger.info('Message');
 */
class Logger {
  constructor(module) {
    this.module = module;
  }

  _log(level, emoji, ...args) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const prefix = `[${timestamp}] ${emoji} [${this.module}]`;
    
    // В production отключаем DEBUG и INFO
    if (isProduction && (level === 'DEBUG' || level === 'INFO')) {
      return;
    }
    
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

  log(...args) {
    this.info(...args);
  }
}

// Экспортируем Logger класс как default для совместимости
export default Logger;

// Экспортируем предустановленные логгеры для разных модулей (совместимость с logger.js)
export const authLogger = new Logger('AUTH');
export const ttsLogger = new Logger('TTS');
export const chatLogger = new Logger('CHAT');
export const streamLogger = new Logger('STREAM');
export const youtubeLogger = new Logger('YOUTUBE');
export const dropsLogger = new Logger('DROPS');
export const commandsLogger = new Logger('COMMANDS');
export const apiLogger = new Logger('API');
export const wsLogger = new Logger('WEBSOCKET');

// Логируем текущий режим при первом импорте
if (isDevelopment) {
    console.log('🔓 Development mode: Full logging enabled');
} else {
    console.log('🔒 Production mode: Limited logging (errors only)');
}

