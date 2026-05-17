import React from 'react';

import { CHATBOX_FONT_OPTIONS } from '@/features/chatbox/constants/fontOptions';
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

const FontSettings: React.FC<FontSettingsProps> = ({
    fontFamily,
    fontSize,
    textStrokeWidth,
    onFontFamilyChange,
    onFontSizeChange,
    onTextStrokeWidthChange,
}) => {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label className="text-white">Шрифт</Label>
                <select
                    value={fontFamily}
                    onChange={(e) => onFontFamilyChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {CHATBOX_FONT_OPTIONS.map((font) => (
                        <option key={font} value={font}>
                            {font}
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Размер шрифта</Label>
                    <span className="text-sm text-gray-400">{fontSize}px</span>
                </div>
                <Slider value={[fontSize]} min={8} max={64} step={1} onValueChange={(val) => onFontSizeChange(val[0])} />
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Обводка букв</Label>
                    <span className="text-sm text-gray-400">{textStrokeWidth === 0 ? 'Выкл' : `${textStrokeWidth}px`}</span>
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
