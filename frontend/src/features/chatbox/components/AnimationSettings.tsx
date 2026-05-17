import React from 'react';

import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';

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
    onMessageFadeSecondsChange,
}) => {
    return (
        <div className="space-y-6">
            {/* Animation Type */}
            <div className="space-y-2">
                <Label className="text-white">Анимация сообщений</Label>
                <select
                    value={animationType}
                    onChange={(e) => onAnimationTypeChange(e.target.value)}
                    className="w-full bg-gray-800 text-white border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                    <option value="fade">Появление (Fade)</option>
                    <option value="slide-right">← Слева (Slide Left)</option>
                    <option value="slide-left">Справа → (Slide Right)</option>
                    <option value="scale">Увеличение (Scale)</option>
                    <option value="bounce">Подпрыгивание (Bounce)</option>
                </select>
            </div>

            {/* Animation Duration */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Длительность анимации</Label>
                    <span className="text-sm text-gray-400">{animationDuration}ms</span>
                </div>
                <Slider
                    value={[animationDuration]}
                    min={100}
                    max={2000}
                    step={100}
                    onValueChange={(val) => onAnimationDurationChange(val[0])}
                />
            </div>

            {/* Message Fade Duration */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Исчезание сообщений</Label>
                    <span className="text-sm text-gray-400">
                        {messageFadeSeconds === 60 ? 'Никогда' : `${messageFadeSeconds}с`}
                    </span>
                </div>
                <Slider
                    value={[messageFadeSeconds]}
                    min={5}
                    max={120}
                    step={5}
                    onValueChange={(val) => onMessageFadeSecondsChange(val[0])}
                />
            </div>
        </div>
    );
};

export default AnimationSettings;
