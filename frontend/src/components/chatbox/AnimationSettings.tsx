// src/components/chatbox/AnimationSettings.tsx
import React from 'react';

import { Label } from '@/components/ui/label';

interface AnimationSettingsProps {
    animationType: string;
    animationDuration: number;
    messageFadeSeconds: number;
    onAnimationTypeChange: (value: string) => void;
    onAnimationDurationChange: (value: number) => void;
    onMessageFadeSecondsChange: (value: number) => void;
}

const AnimationSettings: React.FC<AnimationSettingsProps> = ({
    animationType,
    animationDuration,
    messageFadeSeconds,
    onAnimationTypeChange,
    onAnimationDurationChange,
    onMessageFadeSecondsChange
}) => {
    return (
        <div className="space-y-6">
            {/* Animation Type */}
            <div className="space-y-2">
                <Label className="text-white">Анимация сообщений</Label>
                <select
                    value={animationType}
                    onChange={(e) => onAnimationTypeChange(e.target.value)}
                    className="w-full bg-gray-800 text-white border-gray-600 rounded-lg p-2"
                >
                    <option value="fade">Появление</option>
                    <option value="slide-right">← Слева</option>
                    <option value="slide-left">Справа →</option>
                    <option value="scale">Увеличение</option>
                    <option value="bounce">Подпрыгивание</option>
                </select>
            </div>
            
            {/* Animation Duration */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Длительность анимации</Label>
                    <span className="text-sm text-gray-400">{animationDuration}ms</span>
                </div>
                <input
                    type="range"
                    min="100"
                    max="1000"
                    step="100"
                    value={animationDuration}
                    onChange={(e) => onAnimationDurationChange(parseInt(e.target.value) || 300)}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((animationDuration - 100) / 900) * 100}%, #374151 ${((animationDuration - 100) / 900) * 100}%, #374151 100%)`
                    }}
                />
            </div>
            
            {/* Message Fade Duration */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Исчезание сообщений</Label>
                    <span className="text-sm text-gray-400">
                        {messageFadeSeconds === 60 ? 'Никогда' : `${messageFadeSeconds}с`}
                    </span>
                </div>
                <input
                    type="range"
                    min="10"
                    max="60"
                    step="10"
                    value={messageFadeSeconds}
                    onChange={(e) => onMessageFadeSecondsChange(parseInt(e.target.value) || 60)}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((messageFadeSeconds - 10) / 50) * 100}%, #374151 ${((messageFadeSeconds - 10) / 50) * 100}%, #374151 100%)`
                    }}
                />
            </div>
        </div>
    );
};

export default AnimationSettings;
