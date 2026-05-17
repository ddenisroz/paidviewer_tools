// src/shared/components/StatusBadge.tsx
import React from 'react';

import { AlertCircle, CheckCircle, Clock, Loader2, LucideIcon, XCircle } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';

interface StatusBadgeProps {
    status?: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    showIcon?: boolean;
    className?: string;
}

interface StatusConfig {
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className: string;
    icon: LucideIcon | null;
    text: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    variant: _variant = 'default',
    showIcon = true,
    className = '',
}) => {
    const getStatusConfig = (status?: string): StatusConfig => {
        switch (status?.toLowerCase()) {
            case 'active':
            case 'enabled':
            case 'online':
            case 'connected':
            case 'success':
                return {
                    variant: 'default',
                    className: 'bg-green-600/20 text-green-300 border-green-500',
                    icon: CheckCircle,
                    text: 'Активен',
                };

            case 'inactive':
            case 'disabled':
            case 'offline':
            case 'disconnected':
            case 'error':
                return {
                    variant: 'destructive',
                    className: 'bg-red-600/20 text-red-300 border-red-500',
                    icon: XCircle,
                    text: 'Неактивен',
                };

            case 'pending':
            case 'loading':
            case 'processing':
                return {
                    variant: 'secondary',
                    className: 'bg-yellow-600/20 text-yellow-300 border-yellow-500',
                    icon: Loader2,
                    text: 'Обработка',
                };

            case 'warning':
            case 'caution':
                return {
                    variant: 'outline',
                    className: 'bg-yellow-600/20 text-yellow-300 border-yellow-500',
                    icon: AlertCircle,
                    text: 'Предупреждение',
                };

            case 'waiting':
            case 'queued':
                return {
                    variant: 'outline',
                    className: 'bg-blue-600/20 text-blue-300 border-blue-500',
                    icon: Clock,
                    text: 'Ожидание',
                };

            default:
                return {
                    variant: 'outline',
                    className: 'bg-gray-600/20 text-gray-300 border-gray-500',
                    icon: null,
                    text: status || 'Неизвестно',
                };
        }
    };

    const config = getStatusConfig(status);
    const IconComponent = config.icon;

    return (
        <Badge variant={config.variant} className={`${config.className} ${className}`}>
            {showIcon && IconComponent && <IconComponent className="h-3 w-3 mr-1" />}
            {config.text}
        </Badge>
    );
};

export default StatusBadge;
