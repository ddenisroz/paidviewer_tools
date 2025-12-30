import React from 'react';

import { AlertCircle, CheckCircle, Clock, Loader2, LucideIcon } from 'lucide-react';

interface StatusIndicatorProps {
    status?: 'success' | 'error' | 'loading' | 'pending';
    message?: string;
    showMessage?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    className?: string;
}

interface StatusConfig {
    icon: LucideIcon;
    color: string;
    bgColor: string;
    message: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ 
    status, 
    message, 
    showMessage = true, 
    size = 'sm',
    className = '' 
}) => {
    const getStatusConfig = (): StatusConfig => {
        switch (status) {
            case 'success':
                return {
                    icon: CheckCircle,
                    color: 'text-green-600',
                    bgColor: 'bg-green-100',
                    message: message || 'Готово'
                };
            case 'error':
                return {
                    icon: AlertCircle,
                    color: 'text-red-600',
                    bgColor: 'bg-red-100',
                    message: message || 'Ошибка'
                };
            case 'loading':
                return {
                    icon: Loader2,
                    color: 'text-blue-600',
                    bgColor: 'bg-blue-100',
                    message: message || 'Загрузка...'
                };
            case 'pending':
                return {
                    icon: Clock,
                    color: 'text-yellow-600',
                    bgColor: 'bg-yellow-100',
                    message: message || 'Ожидание'
                };
            default:
                return {
                    icon: Clock,
                    color: 'text-gray-600',
                    bgColor: 'bg-gray-100',
                    message: message || 'Неизвестно'
                };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;
    
    const sizeClasses: Record<string, string> = {
        xs: 'h-3 w-3',
        sm: 'h-4 w-4',
        md: 'h-5 w-5',
        lg: 'h-6 w-6'
    };

    return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
            <div className={`inline-flex items-center justify-center rounded-full p-1 ${config.bgColor}`}>
                <Icon className={`${sizeClasses[size]} ${config.color} ${status === 'loading' ? 'animate-spin' : ''}`} />
            </div>
            {showMessage && (
                <span className={`text-sm font-medium ${config.color}`}>
                    {config.message}
                </span>
            )}
        </div>
    );
};

export default StatusIndicator;

