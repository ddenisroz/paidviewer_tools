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
            className={`w-40 h-10 flex items-center justify-center gap-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 active:scale-[0.98] ${
                isActive
                    ? 'bg-gradient-to-b from-emerald-500/16 to-emerald-500/8 text-emerald-300 hover:from-emerald-500/22 hover:to-emerald-500/12'
                    : 'bg-gradient-to-b from-white/[0.07] to-white/[0.03] text-muted-foreground hover:from-white/[0.12] hover:to-white/[0.06] hover:text-foreground'
            }`}
        >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-nowrap">{label}</span>
            <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                    isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-muted/60 text-muted-foreground'
                }`}
            >
                {isActive ? 'ON' : 'OFF'}
            </span>
        </button>
    );
};

export default ActionButton;
