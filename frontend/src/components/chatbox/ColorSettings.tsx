// src/components/chatbox/ColorSettings.tsx
/**
 * Color settings for ChatBox.
 */

import React from 'react';

interface ColorSettingsProps {
    textColor: string;
    backgroundColor: string;
    onTextColorChange: (color: string) => void;
    onBackgroundColorChange: (color: string) => void;
}

export const ColorSettings: React.FC<ColorSettingsProps> = ({
    textColor,
    backgroundColor,
    onTextColorChange,
    onBackgroundColorChange,
}) => {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Цвет текста</label>
                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={textColor}
                        onChange={(e) => onTextColorChange(e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer"
                    />
                    <input
                        type="text"
                        value={textColor}
                        onChange={(e) => onTextColorChange(e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Цвет фона</label>
                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={backgroundColor === 'transparent' ? '#000000' : backgroundColor}
                        onChange={(e) => onBackgroundColorChange(e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer"
                    />
                    <input
                        type="text"
                        value={backgroundColor}
                        onChange={(e) => onBackgroundColorChange(e.target.value)}
                        placeholder="transparent"
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    />
                </div>
            </div>
        </div>
    );
};

export default ColorSettings;
