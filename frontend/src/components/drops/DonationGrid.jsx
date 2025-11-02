import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';

const QUALITY_CONFIGS = [
  { id: 'common', label: 'Обычный', color: '#6B7280', icon: '⬜' },
  { id: 'rare', label: 'Редкий', color: '#3B82F6', icon: '🔵' },
  { id: 'epic', label: 'Эпический', color: '#8B5CF6', icon: '🟣' },
  { id: 'legendary', label: 'Легендарный', color: '#F59E0B', icon: '🟡' }
];

const DonationGrid = ({ formData, setFormData }) => {
  const handleAmountChange = (quality, delta) => {
    const fieldName = `donation_amount_${quality}`;
    const currentValue = formData[fieldName][0];
    const maxValue = quality === 'legendary' ? 10000 : 5000;
    const newValue = Math.max(0, Math.min(maxValue, currentValue + delta));
    setFormData({ ...formData, [fieldName]: [newValue] });
  };

  const handleInputChange = (quality, value) => {
    const fieldName = `donation_amount_${quality}`;
    const numValue = parseFloat(value) || 0;
    const maxValue = quality === 'legendary' ? 10000 : 5000;
    const clampedValue = Math.max(0, Math.min(maxValue, numValue));
    setFormData({ ...formData, [fieldName]: [clampedValue] });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {QUALITY_CONFIGS.map((quality) => {
          const fieldName = `donation_amount_${quality.id}`;
          const value = formData[fieldName][0];
          const maxValue = quality.id === 'legendary' ? 10000 : 5000;
          
          return (
            <div key={quality.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{quality.icon}</span>
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

