// src/components/quickactions/ActionButton.tsx
import React from 'react';

import { LucideIcon } from 'lucide-react';

interface ActionButtonProps {
    icon: LucideIcon;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon: Icon, label, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`w-40 h-10 flex items-center justify-center gap-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                    ? 'bg-green-600 hover:bg-green-700 text-white border border-green-500'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-gray-200 border border-gray-700'
            }`}
        >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-nowrap">{label}</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                isActive 
                    ? 'bg-white/20 text-white' 
                    : 'bg-gray-700 text-gray-400'
            }`}>
                {isActive ? 'ON' : 'OFF'}
            </span>
        </button>
    );
};

export default ActionButton;
