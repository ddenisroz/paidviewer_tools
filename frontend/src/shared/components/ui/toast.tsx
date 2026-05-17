/* eslint-disable react-refresh/only-export-components */
import React, { createContext, ReactNode, useCallback, useContext } from 'react';

import { toast } from 'sonner';

interface ToastOptions {
    id?: number | string;
    type?: 'success' | 'error' | 'warning' | 'info';
    title?: string;
    message: string;
    autoClose?: boolean;
    duration?: number;
}

interface ToastContextType {
    addToast: (toast: Omit<ToastOptions, 'id'>) => number | string;
    removeToast: (id: number | string) => void;
    clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

interface ToastProviderProps {
    children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const addToast = useCallback((options: Omit<ToastOptions, 'id'>) => {
        const { type = 'info', message, title, duration } = options;

        // Map to sonner
        const toastFn =
            type === 'error'
                ? toast.error
                : type === 'success'
                  ? toast.success
                  : type === 'warning'
                    ? toast.warning
                    : type === 'info'
                      ? toast.info
                      : toast;

        // Sonner signature: toast(message, data)
        // If we have a title, we usually make it the main text and message the description,
        // OR we can just join them.
        // Best practice for sonner: `toast.success('Title', { description: 'Message' })`

        const toastId = toastFn(title || message, {
            description: title ? message : undefined,
            duration: duration || 4000,
        });

        return toastId;
    }, []);

    const removeToast = useCallback((id: number | string) => {
        toast.dismiss(id);
    }, []);

    const clearAllToasts = useCallback(() => {
        toast.dismiss();
    }, []);

    const value: ToastContextType = {
        addToast,
        removeToast,
        clearAllToasts,
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* No internal rendering of toasts, App.tsx handles the Toaster */}
        </ToastContext.Provider>
    );
};
