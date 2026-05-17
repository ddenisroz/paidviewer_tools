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
    className = '',
}) => {
    const getStatusConfig = (): StatusConfig => {
        switch (status) {
            case 'success':
                return {
                    icon: CheckCircle,
                    color: 'text-emerald-300',
                    bgColor: 'bg-emerald-500/15',
                    message: message || 'Готово',
                };
            case 'error':
                return {
                    icon: AlertCircle,
                    color: 'text-red-300',
                    bgColor: 'bg-red-500/15',
                    message: message || 'Ошибка',
                };
            case 'loading':
                return {
                    icon: Loader2,
                    color: 'text-blue-300',
                    bgColor: 'bg-blue-500/15',
                    message: message || 'Загрузка...',
                };
            case 'pending':
                return {
                    icon: Clock,
                    color: 'text-yellow-300',
                    bgColor: 'bg-yellow-500/15',
                    message: message || 'Ожидание',
                };
            default:
                return {
                    icon: Clock,
                    color: 'text-muted-foreground',
                    bgColor: 'bg-muted/60',
                    message: message || 'Неизвестно',
                };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    const sizeClasses: Record<string, string> = {
        xs: 'h-3 w-3',
        sm: 'h-4 w-4',
        md: 'h-5 w-5',
        lg: 'h-6 w-6',
    };

    return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
            <div className={`inline-flex items-center justify-center rounded-full p-1 ${config.bgColor}`}>
                <Icon
                    className={`${sizeClasses[size]} ${config.color} ${status === 'loading' ? 'animate-spin' : ''}`}
                />
            </div>
            {showMessage && <span className={`text-sm font-medium ${config.color}`}>{config.message}</span>}
        </div>
    );
};

export default StatusIndicator;
