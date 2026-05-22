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

interface DonationGridFormData {
    donation_amount_common: number[];
    donation_amount_rare: number[];
    donation_amount_epic: number[];
    donation_amount_legendary: number[];
    [key: string]: number[];
}

interface DonationGridProps {
    formData: DonationGridFormData;
    setFormData: React.Dispatch<React.SetStateAction<DonationGridFormData>>;
    onChange?: (next: DonationGridFormData) => void;
}

const DonationGrid: React.FC<DonationGridProps> = ({ formData, setFormData, onChange }) => {
    const getMaxAmount = (quality: string): number => {
        return quality === 'legendary'
            ? DROPS_CONSTANTS.DONATION.MAX_AMOUNT_LEGENDARY
            : DROPS_CONSTANTS.DONATION.MAX_AMOUNT_OTHER;
    };

    const handleAmountChange = (quality: string, delta: number) => {
        const fieldName = `donation_amount_${quality}`;
        const currentValue = formData[fieldName][0];
        const maxValue = getMaxAmount(quality);
        const newValue = Math.max(0, Math.min(maxValue, currentValue + delta));
        const next = { ...formData, [fieldName]: [newValue] };
        setFormData(next);
        onChange?.(next);
    };

    const handleInputChange = (quality: string, value: string) => {
        const fieldName = `donation_amount_${quality}`;
        const numValue = parseFloat(value) || 0;
        const maxValue = getMaxAmount(quality);
        const clampedValue = Math.max(0, Math.min(maxValue, numValue));
        const next = { ...formData, [fieldName]: [clampedValue] };
        setFormData(next);
        onChange?.(next);
    };

    return (
        <div className={QUALITY_THRESHOLD_GRID_CLASS}>
            {QUALITY_CONFIGS.map((quality) => {
                const fieldName = `donation_amount_${quality.id}`;
                const value = formData[fieldName][0];
                const maxValue = getMaxAmount(quality.id);

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
                                    <p className="truncate text-xs text-muted-foreground">От {value} ₽</p>
                                </div>
                            </div>
                            <div className={QUALITY_THRESHOLD_STEPPER_CLASS}>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-accent"
                                    onClick={() => handleAmountChange(quality.id, -1)}
                                >
                                    <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                    type="number"
                                    value={value}
                                    onChange={(e) => handleInputChange(quality.id, e.target.value)}
                                    className={QUALITY_THRESHOLD_INPUT_CLASS}
                                    min="0"
                                    max={maxValue}
                                    step="1"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-accent"
                                    onClick={() => handleAmountChange(quality.id, 1)}
                                >
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                        <div className="pt-3">
                            <Slider
                                value={formData[fieldName]}
                                onValueChange={(val) => {
                                    const next = { ...formData, [fieldName]: val };
                                    setFormData(next);
                                    onChange?.(next);
                                }}
                                min={0}
                                max={maxValue}
                                step={50}
                                className="w-full"
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default DonationGrid;
