import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const Toast = ({ toast, onRemove }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isLeaving, setIsLeaving] = useState(false);

    const handleRemove = useCallback(() => {
        setIsLeaving(true);
        setTimeout(() => {
            setIsVisible(false);
            onRemove(toast.id);
        }, 300);
    }, [toast.id, onRemove]);

    // Автоматическое удаление через 4 секунды
    React.useEffect(() => {
        if (toast.autoClose !== false) {
            const timer = setTimeout(handleRemove, 4000);
            return () => clearTimeout(timer);
        }
    }, [handleRemove, toast.autoClose]);

    if (!isVisible) return null;

    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return <CheckCircle className="h-5 w-5 text-green-600" />;
            case 'error':
                return <AlertCircle className="h-5 w-5 text-red-600" />;
            case 'warning':
                return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
            case 'info':
            default:
                return <Info className="h-5 w-5 text-blue-600" />;
        }
    };

    const getBackgroundColor = () => {
        switch (toast.type) {
            case 'success':
                return 'bg-green-50 border-green-200';
            case 'error':
                return 'bg-red-50 border-red-200';
            case 'warning':
                return 'bg-yellow-50 border-yellow-200';
            case 'info':
            default:
                return 'bg-blue-50 border-blue-200';
        }
    };

    const getTextColor = () => {
        switch (toast.type) {
            case 'success':
                return 'text-green-800';
            case 'error':
                return 'text-red-800';
            case 'warning':
                return 'text-yellow-800';
            case 'info':
            default:
                return 'text-blue-800';
        }
    };

    return (
        <div
            className={`
                relative max-w-sm w-full ${getBackgroundColor()} border rounded-lg shadow-lg p-4 mb-2
                transform transition-all duration-300 ease-in-out
                ${isLeaving ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
                hover:shadow-xl hover:scale-105
            `}
        >
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    {getIcon()}
                </div>
                <div className="ml-3 flex-1">
                    {toast.title && (
                        <p className={`text-sm font-medium ${getTextColor()}`}>
                            {toast.title}
                        </p>
                    )}
                    <p className={`text-sm ${toast.title ? 'mt-1' : ''} ${getTextColor()}`}>
                        {toast.message}
                    </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                    <button
                        onClick={handleRemove}
                        className={`
                            inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2
                            ${toast.type === 'success' ? 'text-green-500 hover:text-green-600 focus:ring-green-500' :
                              toast.type === 'error' ? 'text-red-500 hover:text-red-600 focus:ring-red-500' :
                              toast.type === 'warning' ? 'text-yellow-500 hover:text-yellow-600 focus:ring-yellow-500' :
                              'text-blue-500 hover:text-blue-600 focus:ring-blue-500'}
                        `}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((toast) => {
        const id = Date.now() + Math.random();
        const newToast = {
            id,
            type: 'info',
            autoClose: true,
            ...toast,
        };
        setToasts(prev => [...prev, newToast]);
        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const clearAllToasts = useCallback(() => {
        setToasts([]);
    }, []);

    const value = {
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
