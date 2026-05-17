import React from 'react';

import { Slider } from '@/shared/components/ui/slider';

import type { SpeedPreset, VoiceProvider } from '@/features/admin/types/voiceManagement';

const speedPresetLabel = (preset: SpeedPreset): string =>
    ({
        very_slow: 'Очень медленно',
        slow: 'Медленно',
        normal: 'Нормально',
        fast: 'Быстро',
        very_fast: 'Очень быстро',
    })[preset];

const speedPresetValue = (preset: SpeedPreset): number =>
    ({
        very_slow: 0,
        slow: 1,
        normal: 2,
        fast: 3,
        very_fast: 4,
    })[preset];

const sliderValueToPreset = (value: number): SpeedPreset =>
    (['very_slow', 'slow', 'normal', 'fast', 'very_fast'][value] as SpeedPreset) || 'normal';

interface VoiceEditGenerationSectionProps {
    voiceProvider: VoiceProvider;
    testCfgStrength: number;
    testSpeedPreset: SpeedPreset;
    onCfgStrengthChange: (value: number) => void;
    onSpeedPresetChange: (value: SpeedPreset) => void;
}

const VoiceEditGenerationSection: React.FC<VoiceEditGenerationSectionProps> = ({
    testCfgStrength,
    testSpeedPreset,
    onCfgStrengthChange,
    onSpeedPresetChange,
}) => {
    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Параметры генерации F5</h4>
            <div>
                <div className="text-sm font-medium text-foreground">Стабильность синтеза: {testCfgStrength.toFixed(1)}</div>
                <Slider
                    id="cfg-strength"
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={[testCfgStrength]}
                    onValueChange={(value) => onCfgStrengthChange(value[0])}
                    className="mt-2"
                />
            </div>
            <div>
                <div className="text-sm font-medium text-foreground">Скорость речи: {speedPresetLabel(testSpeedPreset)}</div>
                <Slider
                    id="speed-preset"
                    min={0}
                    max={4}
                    step={1}
                    value={[speedPresetValue(testSpeedPreset)]}
                    onValueChange={(value) => onSpeedPresetChange(sliderValueToPreset(value[0]))}
                    className="mt-2"
                />
                <div className="mt-1 flex justify-between px-1 text-xs text-muted-foreground">
                    <span>Очень медл.</span>
                    <span>Медленно</span>
                    <span>Нормально</span>
                    <span>Быстро</span>
                    <span>Очень быстро</span>
                </div>
            </div>
        </div>
    );
};

export default VoiceEditGenerationSection;
