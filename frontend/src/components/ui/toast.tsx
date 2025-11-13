import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, LucideIcon } from 'lucide-react';

interface Toast {
    id: number;
    type?: 'success' | 'error' | 'warning' | 'info';
    title?: string;
    message: string;
    autoClose?: boolean;
    duration?: number;
}

interface ToastContextType {
    addToast: (toast: Omit<Toast, 'id'>) => number;
    removeToast: (id: number) => void;
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

interface ToastProps {
    toast: Toast;
    onRemove: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
    const [isLeaving, setIsLeaving] = useState(false);

    const handleRemove = useCallback(() => {
        setIsLeaving(true);
        setTimeout(() => {
            onRemove(toast.id);
        }, 300); // Animation duration
    }, [toast.id, onRemove]);

    React.useEffect(() => {
        if (toast.autoClose !== false) {
            const timer = setTimeout(handleRemove, toast.duration || 4000);
            return () => clearTimeout(timer);
        }
    }, [handleRemove, toast.autoClose, toast.duration]);

    const getIcon = (): React.ReactNode => {
        switch (toast.type) {
            case 'success': return <CheckCircle className="h-5 w-5" />;
            case 'error': return <AlertCircle className="h-5 w-5" />;
            case 'warning': return <AlertTriangle className="h-5 w-5" />;
            case 'info':
            default: return <Info className="h-5 w-5" />;
        }
    };

    const getStyling = (): string => {
        switch (toast.type) {
            case 'success': return 'bg-green-600 border-green-500';
            case 'error': return 'bg-red-600 border-red-500';
            case 'warning': return 'bg-yellow-600 border-yellow-500';
            case 'info':
            default: return 'bg-blue-600 border-blue-500';
        }
    };

    return (
        <div
            className={`
                relative flex items-center gap-4 max-w-sm w-full text-white rounded-lg shadow-lg p-4 mb-2
                transform transition-all duration-300 ease-in-out border
                ${isLeaving ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
                ${getStyling()}
            `}
        >
            <div className="flex-shrink-0">
                {getIcon()}
            </div>
            <div className="flex-1">
                {toast.title && <p className="font-bold">{toast.title}</p>}
                <p className="text-sm">{toast.message}</p>
            </div>
            <button onClick={handleRemove} className="absolute top-1 right-1 p-1 rounded-full hover:bg-white/10">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
};

interface ToastProviderProps {
    children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Date.now() + Math.random();
        const newToast: Toast = {
            id,
            type: 'info',
            autoClose: true,
            ...toast,
        };
        setToasts(prev => [...prev, newToast]);
        return id;
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const clearAllToasts = useCallback(() => {
        setToasts([]);
    }, []);

    const value: ToastContextType = {
        addToast,
        removeToast,
        clearAllToasts,
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        toast={toast}
                        onRemove={removeToast}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

