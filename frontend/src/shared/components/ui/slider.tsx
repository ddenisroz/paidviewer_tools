import * as React from 'react';

import * as SliderPrimitive from '@radix-ui/react-slider';

import { cn } from '@/lib/utils';

const Slider = React.forwardRef<
    React.ElementRef<typeof SliderPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
        trackClassName?: string;
        rangeClassName?: string;
        thumbClassName?: string;
    }
>(({ className, trackClassName, rangeClassName, thumbClassName, ...props }, ref) => (
    <SliderPrimitive.Root
        ref={ref}
        className={cn(
            'relative flex w-full min-h-[28px] select-none items-center group touch-pan-y cursor-pointer',
            className
        )}
        {...props}
    >
        <SliderPrimitive.Track
            data-slider-track
            className={cn(
                'relative h-2.5 w-full grow overflow-hidden rounded-full border border-border/70 bg-muted/60 transition-colors group-hover:bg-muted/80',
                trackClassName
            )}
        >
            <SliderPrimitive.Range data-slider-range className={cn('absolute h-full bg-emerald-500', rangeClassName)} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
            data-slider-thumb
            className={cn(
                'block h-5 w-5 rounded-full border-2 border-emerald-200 bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.14)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
                thumbClassName
            )}
        />
    </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
