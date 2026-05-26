import React, { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { Input } from '@/shared/components/ui/input';
import { Slider } from '@/shared/components/ui/slider';

interface SliderWithInputProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    unit?: string;
    inputWidth?: number;
    inputClassName?: string;
    sliderClassName?: string;
    ariaLabel?: string;
}

export const SliderWithInput: React.FC<SliderWithInputProps> = ({
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    className,
    unit = '',
    inputWidth = 72,
    inputClassName,
    sliderClassName,
    ariaLabel = 'Значение',
}) => {
    const [localInputValue, setLocalInputValue] = useState(String(value));

    useEffect(() => {
        setLocalInputValue(String(value));
    }, [value]);

    const handleSliderChange = (vals: number[]) => {
        const newValue = vals[0];
        setLocalInputValue(String(newValue));
        onChange(newValue);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setLocalInputValue(newValue);

        const parsed = parseFloat(newValue);
        if (!isNaN(parsed)) {
            // Clamp value
            // Allow typing outside range temporarily, but onChange might want valid values
            // Ideally we accept what controls the slider
            if (parsed >= min && parsed <= max) {
                onChange(parsed);
            }
        }
    };

    const handleBlur = () => {
        let parsed = parseFloat(localInputValue);
        if (isNaN(parsed)) {
            parsed = value; // Reset to current valid prop value
        } else {
            parsed = Math.min(Math.max(parsed, min), max); // Clamp
        }
        setLocalInputValue(String(parsed));
        onChange(parsed);
    };

    return (
        <div className={cn('flex min-w-0 items-center gap-3', className)}>
            <Slider
                value={[value]}
                min={min}
                max={max}
                step={step}
                onValueChange={handleSliderChange}
                aria-label={ariaLabel}
                className={cn('w-full flex-1 min-w-0 py-2', sliderClassName)}
            />
            <div className="flex items-center gap-2 justify-end shrink-0">
                <Input
                    value={localInputValue}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={cn(
                        'h-9 px-2 text-right bg-card/70 border-border/70 text-foreground text-sm font-normal font-base focus-visible:ring-0 focus-visible:ring-offset-0',
                        inputClassName
                    )}
                    style={{ width: inputWidth }}
                    step={step}
                    inputMode="decimal"
                    aria-label={ariaLabel}
                />
                {unit && <span className="text-xs text-muted-foreground whitespace-nowrap">{unit}</span>}
            </div>
        </div>
    );
};
