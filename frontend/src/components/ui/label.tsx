// src/components/ui/label.tsx
/**
 * Label component for form inputs.
 */

import React from 'react';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    required?: boolean;
}

export const Label: React.FC<LabelProps> = ({
    children,
    required = false,
    className = '',
    ...props
}) => {
    return (
        <label
            className={`block text-sm font-medium text-gray-300 mb-1 ${className}`}
            {...props}
        >
            {children}
            {required && <span className="text-red-500 ml-1">*</span>}
        </label>
    );
};

export default Label;
