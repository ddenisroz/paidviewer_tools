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

// Экспортируем по умолчанию logger
export default logger;

// Логируем текущий режим при первом импорте
if (isDevelopment) {
    console.log('🔓 Development mode: Full logging enabled');
} else {
    console.log('🔒 Production mode: Limited logging (errors only)');
}

