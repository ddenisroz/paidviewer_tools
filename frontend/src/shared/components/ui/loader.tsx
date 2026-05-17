import React from 'react';

import { Loader2 } from 'lucide-react';

interface LoaderProps {
    size?: 'sm' | 'default' | 'lg' | 'xl';
    className?: string;
}

export const Loader: React.FC<LoaderProps> = ({ size = 'default', className = '' }) => {
    const sizeClasses: Record<string, string> = {
        sm: 'h-4 w-4',
        default: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12',
    };

    return (
        <div className={`flex items-center justify-center ${className}`}>
            <Loader2 className={`animate-spin ${sizeClasses[size]}`} />
        </div>
    );
};

interface PageLoaderProps {
    message?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({ message }) => (
    <div className="flex flex-col items-center justify-center p-8 text-center">
        <Loader className="h-8 w-8 animate-spin text-purple-400 mb-4" />
        <p className="text-muted-foreground">{message || 'Загрузка...'}</p>
    </div>
);

export default Loader;
