// src/components/ui/badge.tsx
/**
 * Badge component for status indicators and labels.
 * Supports both semantic variants (success/warning/error) and style variants (outline/secondary)
 */

import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline' | 'secondary' | 'destructive';
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'default',
    className = ''
}) => {
    const variantStyles: Record<string, string> = {
        default: 'bg-gray-600 text-white',
        success: 'bg-green-600 text-white',
        warning: 'bg-yellow-600 text-black',
        error: 'bg-red-600 text-white',
        info: 'bg-blue-600 text-white',
        outline: 'border border-gray-500 text-gray-300 bg-transparent',
        secondary: 'bg-gray-500 text-white',
        destructive: 'bg-red-600 text-white',
    };

    return (
        <span
            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${variantStyles[variant]} ${className}`}
        >
            {children}
        </span>
    );
};

export default Badge;
