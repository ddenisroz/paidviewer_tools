// src/components/chatbox/ColorSettings.tsx
import React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    onBorderRadiusChange
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
                    className="h-10 w-full"
                />
            </div>
            
            {/* Background Opacity */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Непрозрачность фона</Label>
                    <span className="text-sm text-gray-400">{Math.round(backgroundOpacity * 100)}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={backgroundOpacity}
                    onChange={(e) => onBackgroundOpacityChange(parseFloat(e.target.value) || 0.5)}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${backgroundOpacity * 100}%, #374151 ${backgroundOpacity * 100}%, #374151 100%)`
                    }}
                />
            </div>
            
            {/* Text Stroke Color */}
            <div className="space-y-2">
                <Label className="text-white">Цвет обводки текста</Label>
                <Input
                    type="color"
                    value={textStrokeColor}
                    onChange={(e) => onTextStrokeColorChange(e.target.value)}
                    className="h-10 w-full"
                />
            </div>
            
            {/* Border Radius */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-white">Скругление углов</Label>
                    <span className="text-sm text-gray-400">{borderRadius}px</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="20"
                    value={borderRadius}
                    onChange={(e) => onBorderRadiusChange(parseInt(e.target.value) || 8)}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(borderRadius / 20) * 100}%, #374151 ${(borderRadius / 20) * 100}%, #374151 100%)`
                    }}
                />
            </div>
        </div>
    );
};

export default ColorSettings;
