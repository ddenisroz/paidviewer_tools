import React from 'react';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/shared/components/ui/card';
import { TooltipHelp } from '@/shared/components/ui/tooltip-help';

import type { LucideIcon } from 'lucide-react';

export const ADMIN_PAGE_CLASS = 'space-y-6 font-sans';
export const ADMIN_CARD_CLASS = 'border-border/70 bg-card/80 shadow-none';
export const ADMIN_ACTION_BUTTON_CLASS = 'h-9 border-border/70 bg-background/60 shadow-none hover:bg-muted/60';

interface AdminPageHeaderProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    actions?: React.ReactNode;
    meta?: React.ReactNode;
    className?: string;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
    title,
    description,
    icon: Icon,
    actions,
    meta,
    className,
}) => (
    <div className={cn('flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between', className)}>
        <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-3">
                {Icon ? <Icon className="h-5 w-5 text-muted-foreground" /> : null}
                <h1 className="app-heading-page text-2xl text-foreground">{title}</h1>
                {description ? <TooltipHelp content={description} /> : null}
            </div>
            {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
);

interface AdminEmptyStateProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    action?: React.ReactNode;
    className?: string;
}

export const AdminEmptyState: React.FC<AdminEmptyStateProps> = ({
    title,
    description,
    icon: Icon,
    action,
    className,
}) => (
    <Card className={cn(ADMIN_CARD_CLASS, className)}>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            {Icon ? <Icon className="h-10 w-10 text-muted-foreground/70" /> : null}
            <div className="space-y-1">
                <p className="text-base font-medium text-foreground">{title}</p>
                {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {action}
        </CardContent>
    </Card>
);
