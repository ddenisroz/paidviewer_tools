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
            className={`w-40 h-10 flex items-center justify-center gap-2 px-4 rounded-lg text-sm font-medium transition-colors duration-200 border border-border/70 ${
                isActive
                    ? 'bg-transparent text-emerald-300 hover:text-blue-400'
                    : 'bg-transparent text-muted-foreground hover:text-blue-400'
            }`}
        >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-nowrap">{label}</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                isActive 
                    ? 'bg-emerald-500/15 text-emerald-300' 
                    : 'bg-muted/60 text-muted-foreground'
            }`}>
                {isActive ? 'ON' : 'OFF'}
            </span>
        </button>
    );
};

export default ActionButton;
