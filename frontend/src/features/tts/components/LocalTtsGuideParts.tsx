import { ArrowSquareOut } from '@phosphor-icons/react';

import { cn } from '@/lib/utils';

import type React from 'react';

const chipClass = 'rounded-lg border border-border/70 bg-background/60 px-3 py-2';

export function StatusChip({ label, value, tone }: { label: string; value: string; tone: string }) {
    return (
        <div className={chipClass}>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={cn('mt-1 text-sm font-semibold', tone)}>{value}</p>
        </div>
    );
}

export function GuideLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 font-medium text-sky-200 hover:bg-sky-500/15"
        >
            {children}
            <ArrowSquareOut className="h-3.5 w-3.5" weight="bold" />
        </a>
    );
}
