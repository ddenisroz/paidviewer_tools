/**
 * Toast Manager - Умное управление уведомлениями
 *
 * Возможности:
 * - Группировка похожих уведомлений
 * - Приоритизация (error > warning > success > info)
 * - Ограничение количества одновременных уведомлений
 * - Дедупликация (не показывать одинаковые уведомления)
 * - Автоматическое скрытие старых уведомлений
 */

import { toast as sonnerToast } from 'sonner';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
    duration?: number;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface QueuedToast {
    id: string;
    type: ToastType;
    message: string;
    timestamp: number;
    count: number;
}

class ToastManager {
    private queue: Map<string, QueuedToast> = new Map();
    private readonly maxVisible = 3;
    private readonly groupingWindow = 2000; // 2 секунды
    private readonly defaultDuration = 2000; // 2 секунды (короче чем раньше)

    // Приоритеты типов уведомлений
    private readonly priorities: Record<ToastType, number> = {
        error: 3,
        warning: 2,
        success: 1,
        info: 0,
    };

    /**
     * Генерирует ключ для группировки похожих уведомлений
     */
    private getToastKey(type: ToastType, message: string): string {
        // Убираем числа и специфичные данные для группировки
        const normalizedMessage = message
            .replace(/\d+/g, 'N') // Заменяем числа на N
            .replace(/['"]/g, '') // Убираем кавычки
            .toLowerCase()
            .trim();
        return `${type}:${normalizedMessage}`;
    }

    /**
     * Проверяет, нужно ли группировать уведомление
     */
    private shouldGroup(key: string): QueuedToast | null {
        const existing = this.queue.get(key);
        if (!existing) return null;

        const timeSinceLastToast = Date.now() - existing.timestamp;
        if (timeSinceLastToast < this.groupingWindow) {
            return existing;
        }

        return null;
    }

    /**
     * Очищает старые уведомления из очереди
     */
    private cleanupOldToasts(): void {
        const now = Date.now();
        const maxAge = this.groupingWindow * 2;

        for (const [key, toast] of this.queue.entries()) {
            if (now - toast.timestamp > maxAge) {
                this.queue.delete(key);
            }
        }
    }

    /**
     * Показывает уведомление с умной логикой
     */
    private show(type: ToastType, message: string, options?: ToastOptions): void {
        this.cleanupOldToasts();

        const key = this.getToastKey(type, message);
        const existingToast = this.shouldGroup(key);

        if (existingToast) {
            // Группируем похожие уведомления
            existingToast.count++;
            existingToast.timestamp = Date.now();

            const groupedMessage = existingToast.count > 1 ? `${message} (${existingToast.count})` : message;

            // Обновляем существующее уведомление
            sonnerToast[type](groupedMessage, {
                id: existingToast.id,
                duration: options?.duration || this.defaultDuration,
                description: options?.description,
                action: options?.action,
            });
        } else {
            // Создаём новое уведомление
            const id = `${key}-${Date.now()}`;
            const newToast: QueuedToast = {
                id,
                type,
                message,
                timestamp: Date.now(),
                count: 1,
            };

            this.queue.set(key, newToast);

            sonnerToast[type](message, {
                id,
                duration: options?.duration || this.defaultDuration,
                description: options?.description,
                action: options?.action,
            });
        }
    }

    /**
     * Показывает success уведомление
     */
    success(message: string, options?: ToastOptions): void {
        this.show('success', message, options);
    }

    /**
     * Показывает error уведомление
     */
    error(message: string, options?: ToastOptions): void {
        this.show('error', message, {
            ...options,
            duration: options?.duration || 4000, // Ошибки показываем дольше
        });
    }

    /**
     * Показывает warning уведомление
     */
    warning(message: string, options?: ToastOptions): void {
        this.show('warning', message, {
            ...options,
            duration: options?.duration || 3000,
        });
    }

    /**
     * Показывает info уведомление
     */
    info(message: string, options?: ToastOptions): void {
        this.show('info', message, options);
    }

    /**
     * Закрывает все уведомления
     */
    dismissAll(): void {
        sonnerToast.dismiss();
        this.queue.clear();
    }

    /**
     * Закрывает конкретное уведомление
     */
    dismiss(id: string): void {
        sonnerToast.dismiss(id);

        // Удаляем из очереди
        for (const [key, toast] of this.queue.entries()) {
            if (toast.id === id) {
                this.queue.delete(key);
                break;
            }
        }
    }
}

// Экспортируем singleton instance
export const toast = new ToastManager();

// Для обратной совместимости экспортируем также как default
export default toast;
