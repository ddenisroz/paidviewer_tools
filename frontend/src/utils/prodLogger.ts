/* eslint-disable no-console */
// src/utils/prodLogger.ts
/**
 * Production-safe logger that only logs in development mode.
 */

const isDev = import.meta.env.DEV;

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

const createLogger = () => {
    const log = (level: LogLevel, ...args: unknown[]) => {
        if (isDev || level === 'error' || level === 'warn') {
            console[level](`[${new Date().toISOString()}]`, ...args);
        }
    };

    return {
        log: (...args: unknown[]) => log('log', ...args),
        info: (...args: unknown[]) => log('info', ...args),
        warn: (...args: unknown[]) => log('warn', ...args),
        error: (...args: unknown[]) => log('error', ...args),
        debug: (...args: unknown[]) => {
            if (isDev) {
                console.debug(`[DEBUG ${new Date().toISOString()}]`, ...args);
            }
        },
    };
};

export const logger = createLogger();
export default logger;
