/**
 * Performance Monitoring Utility
 * Tracks and logs performance metrics
 */

import { logger } from '@/utils/prodLogger';

interface PerformanceMetric {
    name: string;
    duration: number;
    timestamp: number;
}

class PerformanceMonitor {
    private metrics: PerformanceMetric[] = [];
    private readonly MAX_METRICS = 100;

    /**
     * Measure the duration of an async operation
     */
    async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
        const startTime = performance.now();

        try {
            const result = await operation();
            const duration = performance.now() - startTime;

            this.recordMetric(name, duration);

            // Log slow operations in development
            if (import.meta.env.DEV && duration > 1000) {
                console.warn(`[Performance] Slow operation: ${name} took ${duration.toFixed(2)}ms`);
            }

            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            this.recordMetric(`${name} (error)`, duration);
            throw error;
        }
    }

    /**
     * Record a performance metric
     */
    private recordMetric(name: string, duration: number): void {
        this.metrics.push({
            name,
            duration,
            timestamp: Date.now(),
        });

        // Keep only the last MAX_METRICS entries
        if (this.metrics.length > this.MAX_METRICS) {
            this.metrics.shift();
        }
    }

    /**
     * Get all recorded metrics
     */
    getMetrics(): PerformanceMetric[] {
        return [...this.metrics];
    }

    /**
     * Get average duration for a specific operation
     */
    getAverageDuration(name: string): number {
        const relevantMetrics = this.metrics.filter((m) => m.name === name);
        if (relevantMetrics.length === 0) return 0;

        const total = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
        return total / relevantMetrics.length;
    }

    /**
     * Get slowest operations
     */
    getSlowestOperations(limit: number = 10): PerformanceMetric[] {
        return [...this.metrics].sort((a, b) => b.duration - a.duration).slice(0, limit);
    }

    /**
     * Clear all metrics
     */
    clear(): void {
        this.metrics = [];
    }

    /**
     * Log performance summary
     */
    logSummary(): void {
        if (this.metrics.length === 0) {
            logger.debug('[Performance] No metrics recorded');
            return;
        }

        const slowest = this.getSlowestOperations(5);
        logger.debug('[Performance] Summary');
        logger.debug(`Total operations: ${this.metrics.length}`);
        logger.debug('Slowest operations:');
        slowest.forEach((metric, index) => {
            logger.debug(`  ${index + 1}. ${metric.name}: ${metric.duration.toFixed(2)}ms`);
        });
    }
}

export const performanceMonitor = new PerformanceMonitor();

// Expose to window for debugging in development
if (import.meta.env.DEV) {
    (window as Window & { performanceMonitor?: PerformanceMonitor }).performanceMonitor = performanceMonitor;
}
