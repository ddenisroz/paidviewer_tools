// src/shared/components/LoadingSpinner.tsx
import React from 'react';

import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'default' | 'lg' | 'xl';
    text?: string;
    className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'default', text = 'Загрузка...', className = '' }) => {
    const sizeClasses = {
        sm: 'h-4 w-4',
        default: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12',
    };

    return (
        <div className={`flex items-center justify-center ${className}`}>
            <div className="flex items-center space-x-2">
                <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
                {text && <span className="text-sm text-muted-foreground">{text}</span>}
            </div>
        </div>
    );
};

export default LoadingSpinner;
