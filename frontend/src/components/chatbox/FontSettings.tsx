// src/components/chatbox/FontSettings.tsx
/**
 * Font settings for ChatBox.
 */

import React from 'react';

import { fontFamilies } from '@/utils/chatboxHelpers';

interface FontSettingsProps {
    fontSize: number;
    fontFamily: string;
    onFontSizeChange: (size: number) => void;
    onFontFamilyChange: (family: string) => void;
}

export const FontSettings: React.FC<FontSettingsProps> = ({
    fontSize,
    fontFamily,
    onFontSizeChange,
    onFontFamilyChange,
}) => {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Размер шрифта: {fontSize}px
                </label>
                <input
                    type="range"
                    min="12"
                    max="32"
                    value={fontSize}
                    onChange={(e) => onFontSizeChange(Number(e.target.value))}
                    className="w-full"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Шрифт</label>
                <select
                    value={fontFamily}
                    onChange={(e) => onFontFamilyChange(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                    {fontFamilies.map((font) => (
                        <option key={font} value={font} style={{ fontFamily: font }}>
                            {font}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default FontSettings;
