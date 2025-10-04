// src/components/TtsErrorCard.jsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

const TtsErrorCard = ({ title, description, suggestion }) => {
    return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-left">
            <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-red-500 rounded-full flex-shrink-0 mt-0.5"></div>
                <div className="flex-1">
                    <h2 className="text-lg font-semibold text-red-400 mb-2">
                        {title}
                    </h2>
                    <p className="text-red-300 mb-3">
                        {description}
                    </p>
                    <p className="text-slate-400 text-sm mb-4">
                        {suggestion}
                    </p>
                    <div className="text-red-300 text-sm">
                        Система автоматически обновит статус
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TtsErrorCard;
