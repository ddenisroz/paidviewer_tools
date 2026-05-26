import React from 'react';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

const SURFACE_CARD_CLASS = 'flex h-full min-h-[288px] flex-col border-border/70 bg-card shadow-sm shadow-black/10';

export const StepBadge: React.FC<{ value: string }> = ({ value }) => (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-sky-400/30 bg-sky-500/10 font-brand text-xs font-bold text-sky-200">
        {value}
    </span>
);

export const AutomationCard: React.FC<{
    step?: string;
    icon: React.ElementType;
    title: string;
    description?: string;
    children: React.ReactNode;
    disabled?: boolean;
    contentClassName?: string;
}> = ({ step, icon: Icon, title, description, children, disabled, contentClassName }) => (
    <Card className={cn(SURFACE_CARD_CLASS, disabled && 'opacity-70')}>
        <CardHeader className="px-4 pb-2 pt-4">
            <div className="flex min-h-8 items-start gap-3">
                {step ? <StepBadge value={step} /> : null}
                <div className="min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-2 text-[13px] min-[1280px]:text-sm">
                        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
                        {title}
                    </CardTitle>
                    {description ? (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
                    ) : null}
                </div>
            </div>
        </CardHeader>
        <CardContent className={cn('flex flex-1 flex-col gap-3 px-4 pb-4', contentClassName)}>{children}</CardContent>
    </Card>
);

export const ConnectionNote: React.FC<{ note: string | null }> = ({ note }) => {
    if (!note) return null;
    return <p className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">{note}</p>;
};
