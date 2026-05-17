import * as React from 'react';

import * as SwitchPrimitives from '@radix-ui/react-switch';

import { cn } from '@/lib/utils';

type SwitchVariant = 'default' | 'twitch' | 'vk' | 'donation';

const checkedVariantClass: Record<SwitchVariant, string> = {
    default: 'data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-600',
    twitch: 'data-[state=checked]:border-[#9146ff] data-[state=checked]:bg-[#9146ff]',
    vk: 'data-[state=checked]:border-[#ff3b3b] data-[state=checked]:bg-[#ff3b3b]',
    donation: 'data-[state=checked]:border-orange-500 data-[state=checked]:bg-orange-500',
};

const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & { variant?: SwitchVariant }
>(({ className, variant = 'default', ...props }, ref) => (
    <SwitchPrimitives.Root
        className={cn(
            'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border bg-muted transition-colors duration-200 hover:bg-muted/80 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            checkedVariantClass[variant],
            className
        )}
        {...props}
        ref={ref}
    >
        <SwitchPrimitives.Thumb
            className={cn(
                'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5'
            )}
        />
    </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
