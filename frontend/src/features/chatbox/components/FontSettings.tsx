import React from 'react';

import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';

interface FontSettingsProps {
    fontFamily: string;
    fontSize: number;
    textStrokeWidth: number;
    onFontFamilyChange: (value: string) => void;
    onFontSizeChange: (value: number) => void;
    onTextStrokeWidthChange: (value: number) => void;
}

const GOOGLE_FONTS = [
    'Inter', 'Roboto', 'Montserrat', 'Oswald', 'Ubuntu', 'Comic Neue',
    'Pacifico', 'Russo One', 'Exo 2', 'Play', 'Rubik', 'Marck Script',
    'Ruslan Display', 'Lobster', 'Caveat', 'Bebas Neue', 'Permanent Marker',
    'JetBrains Mono', 'Fira Code', 'Comfortaa'
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
                    className="w-full bg-gray-800 text-white border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                    {GOOGLE_FONTS.map(font => (
                        <option key={font} value={font}>{font}</option>
                    ))}
                </select>
            </div>

            {/* Font Size */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Размер шрифта</Label>
                    <span className="text-sm text-gray-400">{fontSize}px</span>
                </div>
                <Slider
                    value={[fontSize]}
                    min={8}
                    max={64}
                    step={1}
                    onValueChange={(val) => onFontSizeChange(val[0])}
                />
            </div>

            {/* Text Stroke */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Обводка букв (читаемость)</Label>
                    <span className="text-sm text-gray-400">
                        {textStrokeWidth === 0 ? 'Выкл' : `${textStrokeWidth}px`}
                    </span>
                </div>
                <Slider
                    value={[textStrokeWidth]}
                    min={0}
                    max={5}
                    step={0.5}
                    onValueChange={(val) => onTextStrokeWidthChange(val[0])}
                />
            </div>
        </div>
    );
};

export default FontSettings;
