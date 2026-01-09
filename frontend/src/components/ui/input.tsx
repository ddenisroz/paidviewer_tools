// src/components/ui/input.tsx
/**
 * Input component for forms.
 */

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', error, ...props }, ref) => {
        return (
            <div className="w-full">
                <input
                    ref={ref}
                    className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white placeholder-gray-400 
            focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
            ${error ? 'border-red-500' : 'border-gray-600'}
            ${className}`}
                    {...props}
                />
                {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
            </div>
        );
    }
);

Input.displayName = 'Input';

export default Input;
