// src/components/ui/button.tsx
/**
 * Button component with variants.
 * Supports both semantic (primary/secondary) and shadcn-style (default/outline) variants
 */

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    className = '',
    disabled,
    ...props
}) => {
    const variantStyles: Record<string, string> = {
        primary: 'bg-purple-600 hover:bg-purple-700 text-white',
        default: 'bg-purple-600 hover:bg-purple-700 text-white',
        secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
        outline: 'border border-gray-500 hover:bg-gray-700 text-white',
        ghost: 'hover:bg-gray-700 text-white',
        destructive: 'bg-red-600 hover:bg-red-700 text-white',
        link: 'text-purple-400 hover:text-purple-300 underline-offset-4 hover:underline',
    };

    const sizeStyles: Record<string, string> = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
        icon: 'h-10 w-10 p-0',
    };

    return (
        <button
            className={`inline-flex items-center justify-center rounded-md font-medium transition-colors 
        ${variantStyles[variant]} ${sizeStyles[size]} 
        ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''} 
        ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            )}
            {children}
        </button>
    );
};

export default Button;
