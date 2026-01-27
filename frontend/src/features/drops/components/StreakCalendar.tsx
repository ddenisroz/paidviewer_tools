import React from 'react';

import { Minus, Plus } from 'lucide-react';

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
  const handleDayChange = (quality: string, delta: number) => {
    const fieldName = `streak_days_${quality}`;
    const currentValue = formData[fieldName][0];
    const newValue = Math.max(1, Math.min(365, currentValue + delta));
    setFormData({ ...formData, [fieldName]: [newValue] });
  };

  const handleInputChange = (quality: string, value: string) => {
    const fieldName = `streak_days_${quality}`;
    const numValue = parseInt(value) || 1;
    const clampedValue = Math.max(1, Math.min(365, numValue));
    setFormData({ ...formData, [fieldName]: [clampedValue] });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {QUALITY_CONFIGS.map((quality) => {
          const fieldName = `streak_days_${quality.id}`;
          const value = formData[fieldName][0];
          
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
                    <p className="text-xs text-muted-foreground">После {value} стримов</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 border rounded-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDayChange(quality.id, -1)}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => handleInputChange(quality.id, e.target.value)}
                    className="w-16 h-7 border-0 text-center text-sm font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    min="1"
                    max="365"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDayChange(quality.id, 1)}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <Slider
                value={formData[fieldName]}
                onValueChange={(val) => setFormData({ ...formData, [fieldName]: val })}
                min={1}
                max={365}
                step={5}
                className="w-full"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StreakCalendar;


