/**
 * Success Checkmark Component
 * Animated checkmark for success feedback
 * Requirements: 4.2, 4.3
 */

import React from 'react';

import { cn } from '@/lib/utils';

interface SuccessCheckmarkProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    variant?: 'circle' | 'simple';
}

export const SuccessCheckmark: React.FC<SuccessCheckmarkProps> = ({ size = 'md', className, variant = 'circle' }) => {
    const sizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-12 h-12',
        lg: 'w-16 h-16',
    };

    const strokeWidth = {
        sm: 3,
        md: 4,
        lg: 5,
    };

    if (variant === 'simple') {
        return (
            <svg
                className={cn('checkmark-animation', sizeClasses[size], className)}
                viewBox="0 0 52 52"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    fill="none"
                    stroke="hsl(142, 76%, 36%)"
                    strokeWidth={strokeWidth[size]}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 27l8 8 16-16"
                />
            </svg>
        );
    }

    return (
        <svg
            className={cn('checkmark-animation', sizeClasses[size], className)}
            viewBox="0 0 52 52"
            xmlns="http://www.w3.org/2000/svg"
        >
            <circle cx="26" cy="26" r="24" fill="none" stroke="hsl(142, 76%, 36%)" strokeWidth={strokeWidth[size]} />
            <path
                fill="none"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={strokeWidth[size]}
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 27l8 8 16-16"
            />
        </svg>
    );
};

export default SuccessCheckmark;
