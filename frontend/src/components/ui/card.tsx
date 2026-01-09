// src/components/ui/card.tsx
/**
 * Card component for content containers.
 */

import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => (
    <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
        {children}
    </div>
);

export const CardHeader: React.FC<CardProps> = ({ children, className = '' }) => (
    <div className={`px-6 py-4 border-b border-gray-700 ${className}`}>
        {children}
    </div>
);

export const CardTitle: React.FC<CardProps> = ({ children, className = '' }) => (
    <h3 className={`text-lg font-semibold text-white ${className}`}>
        {children}
    </h3>
);

export const CardDescription: React.FC<CardProps> = ({ children, className = '' }) => (
    <p className={`text-sm text-gray-400 ${className}`}>
        {children}
    </p>
);

export const CardContent: React.FC<CardProps> = ({ children, className = '' }) => (
    <div className={`px-6 py-4 ${className}`}>
        {children}
    </div>
);

export const CardFooter: React.FC<CardProps> = ({ children, className = '' }) => (
    <div className={`px-6 py-4 border-t border-gray-700 ${className}`}>
        {children}
    </div>
);

export default Card;
