// frontend/src/lib/sentry.ts
/**
 * Sentry Configuration for Frontend Error Tracking
 *
 * Features:
 * - Automatic error capture
 * - Performance monitoring
 * - Session replay
 * - User context
 * - Breadcrumbs
 */

import * as Sentry from '@sentry/react';

import { logger } from '@/shared/utils/prodLogger';

/**
 * Initialize Sentry for error tracking.
 *
 * Call this once at application startup (in main.tsx).
 */
export function initSentry() {
    // Only initialize in production or if explicitly enabled
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    const environment = import.meta.env.MODE;

    if (!dsn) {
        logger.info('[Sentry] DSN not configured, error tracking disabled');
        return;
    }

    if (environment === 'development' && !import.meta.env.VITE_SENTRY_DEBUG) {
        logger.info('[Sentry] Disabled in development');
        return;
    }

    try {
        Sentry.init({
            dsn,

            // Environment
            environment,

            // Release tracking
            release: import.meta.env.VITE_SENTRY_RELEASE || 'frontend@0.03',

            // Performance Monitoring
            integrations: [
                Sentry.browserTracingIntegration(),
                Sentry.replayIntegration({
                    // Mask all text and input content
                    maskAllText: true,
                    blockAllMedia: true,
                }),
            ],

            // Performance monitoring sample rate (10% of transactions)
            tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'),

            // Session Replay
            replaysSessionSampleRate: 0.1, // 10% of sessions
            replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

            // Filter events before sending
            beforeSend(event, hint) {
                // Don't send events in development unless debug enabled
                if (environment === 'development' && !import.meta.env.VITE_SENTRY_DEBUG) {
                    return null;
                }

                // Filter out specific errors
                if (event.exception) {
                    const error = hint.originalException;

                    // Skip network errors (handled by retry logic)
                    if (error instanceof Error && error.message.includes('Network Error')) {
                        return null;
                    }

                    // Skip 4xx errors (client errors, not bugs)
                    if (error instanceof Error && /4\d{2}/.test(error.message)) {
                        return null;
                    }
                }

                // Remove sensitive data
                if (event.request) {
                    // Remove authorization headers
                    if (event.request.headers) {
                        delete event.request.headers['Authorization'];
                        delete event.request.headers['Cookie'];
                    }

                    // Mask sensitive query params
                    if (event.request.query_string) {
                        event.request.query_string = event.request.query_string
                            // @ts-expect-error - query_string.replace exists at runtime but type definitions are incomplete
                            .replace(/token=[^&]+/g, 'token=[FILTERED]')
                            .replace(/key=[^&]+/g, 'key=[FILTERED]');
                    }
                }

                return event;
            },

            // Additional options
            attachStacktrace: true,
            maxBreadcrumbs: 50,
            debug: environment === 'development' && import.meta.env.VITE_SENTRY_DEBUG === 'true',
        });

        logger.info(`[Sentry] Initialized successfully (environment=${environment})`);
    } catch (error) {
        logger.error('[Sentry] Failed to initialize:', error);
    }
}

/**
 * Set user context for error tracking.
 *
 * Call this after user authentication.
 */
export function setUserContext(user: { id: number; username?: string; email?: string; [key: string]: unknown }) {
    Sentry.setUser({
        id: user.id.toString(),
        username: user.username,
        email: user.email,
    });
}

/**
 * Clear user context (on logout).
 */
export function clearUserContext() {
    Sentry.setUser(null);
}

/**
 * Add custom context to error reports.
 */
export function setContext(key: string, data: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Sentry.setContext(key, data as Record<string, any>);
}

/**
 * Add breadcrumb to track user actions.
 */
export function addBreadcrumb(
    message: string,
    category: string = 'default',
    level: Sentry.SeverityLevel = 'info',
    data?: Record<string, unknown>
) {
    Sentry.addBreadcrumb({
        message,
        category,
        level,
        data,
    });
}

/**
 * Manually capture an exception.
 */
export function captureException(error: Error, context?: Record<string, unknown>) {
    if (context) {
        Sentry.withScope((scope) => {
            Object.entries(context).forEach(([key, value]) => {
                scope.setExtra(key, value);
            });
            Sentry.captureException(error);
        });
    } else {
        Sentry.captureException(error);
    }
}

/**
 * Capture a message (not an exception).
 */
export function captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: Record<string, unknown>
) {
    if (context) {
        Sentry.withScope((scope) => {
            Object.entries(context).forEach(([key, value]) => {
                scope.setExtra(key, value);
            });
            Sentry.captureMessage(message, level);
        });
    } else {
        Sentry.captureMessage(message, level);
    }
}

/**
 * Start a performance transaction.
 *
 * Usage:
 *   const transaction = startTransaction('load_dashboard');
 *   // ... do work ...
 *   transaction.finish();
 */
export function startTransaction(name: string, op: string = 'custom') {
    const span = Sentry.startInactiveSpan({ name, op });

    return {
        setStatus(status: string) {
            // Sentry span status typing differs across SDK versions.
            if (span && typeof span.setStatus === 'function') {
                span.setStatus(status as never);
            }
        },
        finish() {
            if (span && typeof span.end === 'function') {
                span.end();
            }
        },
    };
}

/**
 * Measure performance of an async function.
 *
 * Usage:
 *   await measurePerformance('fetch_users', async () => {
 *     return await api.getUsers();
 *   });
 */
export async function measurePerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const transaction = startTransaction(name);
    try {
        const result = await fn();
        transaction.setStatus('ok');
        return result;
    } catch (error) {
        transaction.setStatus('internal_error');
        throw error;
    } finally {
        transaction.finish();
    }
}

// Export Sentry for advanced usage
export { Sentry };
