import * as React from "react"

import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full min-h-[24px] select-none items-center group touch-pan-y cursor-pointer", className)}
    {...props}>
    <SliderPrimitive.Track
      className="relative h-2 w-full grow overflow-hidden rounded-sm bg-slate-950/70 group-hover:bg-slate-900/80">
      <SliderPrimitive.Range className="absolute h-full bg-slate-500/80" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block h-4 w-3 rounded-[3px] border border-slate-400/70 bg-slate-200/90 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }

