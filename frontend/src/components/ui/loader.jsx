import React from 'react';
import { Loader2 } from 'lucide-react';

export const Loader = ({ size = 'default', className = '' }) => {
    const sizeClasses = {
        sm: 'h-4 w-4',
        default: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12'
    };

    return (
        <div className={`flex items-center justify-center ${className}`}>
            <Loader2 className={`animate-spin ${sizeClasses[size]}`} />
        </div>
    );
};

export const PageLoader = ({ message = 'Загрузка...', className = '' }) => {
    return (
        <div className={`flex flex-col items-center justify-center min-h-[400px] space-y-4 ${className}`}>
            <Loader size="xl" />
            <p className="text-muted-foreground text-lg">{message}</p>
        </div>
    );
};

export default Loader;