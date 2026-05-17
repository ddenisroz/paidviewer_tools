import React from 'react';

import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';

interface ColorSettingsProps {
    backgroundColor: string;
    backgroundOpacity: number;
    textStrokeColor: string;
    borderRadius: number;
    onBackgroundColorChange: (value: string) => void;
    onBackgroundOpacityChange: (value: number) => void;
    onTextStrokeColorChange: (value: string) => void;
    onBorderRadiusChange: (value: number) => void;
}

const ColorSettings: React.FC<ColorSettingsProps> = ({
    backgroundColor,
    backgroundOpacity,
    textStrokeColor,
    borderRadius,
    onBackgroundColorChange,
    onBackgroundOpacityChange,
    onTextStrokeColorChange,
    onBorderRadiusChange,
}) => {
    return (
        <div className="space-y-6">
            {/* Background Color */}
            <div className="space-y-2">
                <Label className="text-white">Цвет фона</Label>
                <Input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => onBackgroundColorChange(e.target.value)}
                    className="h-10 w-full cursor-pointer"
                />
            </div>

            {/* Background Opacity */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Непрозрачность фона</Label>
                    <span className="text-sm text-gray-400">{Math.round(backgroundOpacity * 100)}%</span>
                </div>
                <Slider
                    value={[backgroundOpacity]}
                    min={0}
                    max={1}
                    step={0.05}
                    onValueChange={(val) => onBackgroundOpacityChange(val[0])}
                />
            </div>

            {/* Text Stroke Color */}
            <div className="space-y-2">
                <Label className="text-white">Цвет обводки текста</Label>
                <Input
                    type="color"
                    value={textStrokeColor}
                    onChange={(e) => onTextStrokeColorChange(e.target.value)}
                    className="h-10 w-full cursor-pointer"
                />
            </div>

            {/* Border Radius */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Скругление углов</Label>
                    <span className="text-sm text-gray-400">{borderRadius}px</span>
                </div>
                <Slider
                    value={[borderRadius]}
                    min={0}
                    max={32}
                    step={1}
                    onValueChange={(val) => onBorderRadiusChange(val[0])}
                />
            </div>
        </div>
    );
};

export default ColorSettings;
