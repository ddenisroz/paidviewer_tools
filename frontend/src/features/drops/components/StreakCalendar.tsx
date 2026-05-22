import React from 'react';

import { Minus, Plus } from 'lucide-react';

import { DROPS_CONSTANTS } from '@/constants/drops';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';

import CommonClosed from '../../../images/lootboxes/common/common_closed.png';
import EpicClosed from '../../../images/lootboxes/epic/epic_closed.png';
import LegendaryClosed from '../../../images/lootboxes/legendary/legendary_closed.png';
import RareClosed from '../../../images/lootboxes/rare/rare_closed.png';

import {
    QUALITY_THRESHOLD_CARD_CLASS,
    QUALITY_THRESHOLD_GRID_CLASS,
    QUALITY_THRESHOLD_IMAGE_CLASS,
    QUALITY_THRESHOLD_INPUT_CLASS,
    QUALITY_THRESHOLD_STEPPER_CLASS,
} from './qualityThresholdLayout';

interface QualityConfig {
    id: string;
    label: string;
    image: string;
}

const QUALITY_CONFIGS: QualityConfig[] = [
    { id: 'common', label: 'Обычный', image: CommonClosed },
    { id: 'rare', label: 'Редкий', image: RareClosed },
    { id: 'epic', label: 'Эпический', image: EpicClosed },
    { id: 'legendary', label: 'Легендарный', image: LegendaryClosed },
];

interface StreakCalendarFormData {
    streak_days_common: number[];
    streak_days_rare: number[];
    streak_days_epic: number[];
    streak_days_legendary: number[];
    [key: string]: number[];
}

interface StreakCalendarProps {
    formData: StreakCalendarFormData;
    setFormData: React.Dispatch<React.SetStateAction<StreakCalendarFormData>>;
}

const StreakCalendar: React.FC<StreakCalendarProps> = ({ formData, setFormData }) => {
    const maxStreakDays = DROPS_CONSTANTS.STREAK.MAX_DAYS;

    const setValue = (quality: string, value: number) => {
        const fieldName = `streak_days_${quality}`;
        const clampedValue = Math.max(1, Math.min(maxStreakDays, value));
        setFormData({ ...formData, [fieldName]: [clampedValue] });
    };

    const handleDayChange = (quality: string, delta: number) => {
        const fieldName = `streak_days_${quality}`;
        const currentValue = formData[fieldName][0];
        setValue(quality, currentValue + delta);
    };

    const handleInputChange = (quality: string, value: string) => {
        setValue(quality, parseInt(value, 10) || 1);
    };

    return (
        <div className={QUALITY_THRESHOLD_GRID_CLASS}>
            {QUALITY_CONFIGS.map((quality) => {
                const fieldName = `streak_days_${quality.id}`;
                const value = formData[fieldName][0];

                return (
                    <div key={quality.id} className={QUALITY_THRESHOLD_CARD_CLASS}>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                                <img
                                    src={quality.image}
                                    alt={`${quality.label} chest`}
                                    className={QUALITY_THRESHOLD_IMAGE_CLASS}
                                />
                                <div className="min-w-0">
                                    <Label className="text-sm font-semibold leading-none">{quality.label}</Label>
                                    <p className="truncate text-xs text-muted-foreground">После {value} стримов</p>
                                </div>
                            </div>

                            <div className={QUALITY_THRESHOLD_STEPPER_CLASS}>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-accent"
                                    onClick={() => handleDayChange(quality.id, -1)}
                                >
                                    <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                    type="number"
                                    value={value}
                                    onChange={(e) => handleInputChange(quality.id, e.target.value)}
                                    className={QUALITY_THRESHOLD_INPUT_CLASS}
                                    min="1"
                                    max={maxStreakDays}
                                    step="1"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-accent"
                                    onClick={() => handleDayChange(quality.id, 1)}
                                >
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>

                        <div className="pt-3">
                            <Slider
                                value={formData[fieldName]}
                                onValueChange={(value) => setValue(quality.id, value[0])}
                                min={1}
                                max={maxStreakDays}
                                step={5}
                                className="w-full"
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default StreakCalendar;
