// src/utils/toastManager.ts
/**
 * Toast notification manager using sonner.
 */

import { toast as sonnerToast } from 'sonner';

export interface ToastOptions {
    duration?: number;
    description?: string;
    action?: {
        label: string;
        onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    };
}

export const toast = {
    success: (message: string, options?: ToastOptions) => {
        sonnerToast.success(message, {
            duration: options?.duration ?? 3000,
            description: options?.description,
            action: options?.action,
        });
    },

    error: (message: string, options?: ToastOptions) => {
        sonnerToast.error(message, {
            duration: options?.duration ?? 5000,
            description: options?.description,
            action: options?.action,
        });
    },

    warning: (message: string, options?: ToastOptions) => {
        sonnerToast.warning(message, {
            duration: options?.duration ?? 4000,
            description: options?.description,
            action: options?.action,
        });
    },

    info: (message: string, options?: ToastOptions) => {
        sonnerToast.info(message, {
            duration: options?.duration ?? 3000,
            description: options?.description,
            action: options?.action,
        });
    },

    loading: (message: string) => {
        return sonnerToast.loading(message);
    },

    dismiss: (toastId?: string | number) => {
        sonnerToast.dismiss(toastId);
    },
};

export default toast;
