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

interface QualityConfig {
    id: string;
    label: string;
    color: string;
    image: string;
}

const QUALITY_CONFIGS: QualityConfig[] = [
  { id: 'common', label: 'Обычный', color: '#6B7280', image: CommonClosed },
  { id: 'rare', label: 'Редкий', color: '#3B82F6', image: RareClosed },
  { id: 'epic', label: 'Эпический', color: '#8B5CF6', image: EpicClosed },
  { id: 'legendary', label: 'Легендарный', color: '#F59E0B', image: LegendaryClosed }
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
}

const DonationGrid: React.FC<DonationGridProps> = ({ formData, setFormData }) => {
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
    setFormData({ ...formData, [fieldName]: [newValue] });
  };

  const handleInputChange = (quality: string, value: string) => {
    const fieldName = `donation_amount_${quality}`;
    const numValue = parseFloat(value) || 0;
    const maxValue = getMaxAmount(quality);
    const clampedValue = Math.max(0, Math.min(maxValue, numValue));
    setFormData({ ...formData, [fieldName]: [clampedValue] });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {QUALITY_CONFIGS.map((quality) => {
          const fieldName = `donation_amount_${quality.id}`;
          const value = formData[fieldName][0];
          const maxValue = getMaxAmount(quality.id);
          
          return (
            <div key={quality.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img 
                    src={quality.image} 
                    alt={`${quality.label} chest`}
                    className="w-8 h-8 object-contain"
                  />
                  <div>
                    <Label className="text-sm font-medium">{quality.label}</Label>
                    <p className="text-xs text-muted-foreground">От {value}₽</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 border rounded-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleAmountChange(quality.id, -50)}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => handleInputChange(quality.id, e.target.value)}
                    className="w-20 h-7 border-0 text-center text-sm font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    min="0"
                    max={maxValue}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleAmountChange(quality.id, 50)}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <Slider
                value={formData[fieldName]}
                onValueChange={(val) => setFormData({ ...formData, [fieldName]: val })}
                min={0}
                max={maxValue}
                step={50}
                className="w-full"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DonationGrid;

