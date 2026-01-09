// src/components/chatbox/AnimationSettings.tsx
/**
 * Animation settings for ChatBox.
 */

import React from 'react';

import { animationTypes } from '@/utils/chatboxHelpers';

interface AnimationSettingsProps {
    animation: string;
    onChange: (animation: string) => void;
}

export const AnimationSettings: React.FC<AnimationSettingsProps> = ({ animation, onChange }) => {
    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">Анимация</label>
            <select
                value={animation}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            >
                {animationTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                        {type.label}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default AnimationSettings;
