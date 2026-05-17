import { Question } from '@phosphor-icons/react';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

import type React from 'react';

interface TooltipHelpProps {
    content: React.ReactNode;
    className?: string;
}

export function TooltipHelp({ content, className }: TooltipHelpProps) {
    return (
        <TooltipProvider delayDuration={150}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            'inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition-colors hover:border-cyan-400/60 hover:text-cyan-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400',
                            className
                        )}
                        aria-label="Подсказка"
                    >
                        <Question className="h-3.5 w-3.5" weight="bold" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                    {content}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
