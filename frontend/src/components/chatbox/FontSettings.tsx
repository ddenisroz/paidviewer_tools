// src/components/chatbox/FontSettings.tsx
import React from 'react';

import { Label } from '@/components/ui/label';

interface FontSettingsProps {
    fontFamily: string;
    fontSize: number;
    textStrokeWidth: number;
    onFontFamilyChange: (value: string) => void;
    onFontSizeChange: (value: number) => void;
    onTextStrokeWidthChange: (value: number) => void;
}

const GOOGLE_FONTS = [
    'Inter',
    'Roboto',
    'Montserrat',
    'Oswald',
    'Ubuntu',
    'Comic Neue',
    'Pacifico',
    'Russo One',
    'Exo 2',
    'Play',
    'Rubik',
    'Marck Script',
    'Ruslan Display',
    'Lobster',
    'Caveat',
    'Bebas Neue',
    'Permanent Marker',
    'JetBrains Mono',
    'Fira Code',
    'Comfortaa'
];

const FontSettings: React.FC<FontSettingsProps> = ({
    fontFamily,
    fontSize,
    textStrokeWidth,
    onFontFamilyChange,
    onFontSizeChange,
    onTextStrokeWidthChange
}) => {
    return (
        <div className="space-y-6">
            {/* Font Family */}
            <div className="space-y-2">
                <Label className="text-white">Шрифт</Label>
                <select
                    value={fontFamily}
                    onChange={(e) => onFontFamilyChange(e.target.value)}
                    className="w-full bg-gray-800 text-white border-gray-600 rounded-lg p-2"
                >
                    {GOOGLE_FONTS.map(font => (
                        <option key={font} value={font}>{font}</option>
                    ))}
                </select>
            </div>
            
            {/* Font Size */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Размер шрифта</Label>
                    <span className="text-sm text-gray-400">{fontSize}px</span>
                </div>
                <input
                    type="range"
                    min="8"
                    max="32"
                    value={fontSize}
                    onChange={(e) => onFontSizeChange(parseInt(e.target.value) || 16)}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((fontSize - 8) / 24) * 100}%, #374151 ${((fontSize - 8) / 24) * 100}%, #374151 100%)`
                    }}
                />
            </div>
            
            {/* Text Stroke */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Обводка букв (читаемость)</Label>
                    <span className="text-sm text-gray-400">
                        {textStrokeWidth === 0 ? 'Выкл' : `${textStrokeWidth}px`}
                    </span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.5"
                    value={textStrokeWidth}
                    onChange={(e) => onTextStrokeWidthChange(parseFloat(e.target.value) || 0)}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(textStrokeWidth / 3) * 100}%, #374151 ${(textStrokeWidth / 3) * 100}%, #374151 100%)`
                    }}
                />
            </div>
        </div>
    );
};

export default FontSettings;
