import React from 'react';

import { ADMIN_CARD_CLASS } from '@/features/admin/components/admin-ui';
import { Card, CardContent } from '@/shared/components/ui/card';

import type { LucideIcon } from 'lucide-react';

interface AdminMetricCardProps {
    title: string;
    value: number | string;
    caption?: string;
    icon?: LucideIcon;
}

const AdminMetricCard: React.FC<AdminMetricCardProps> = ({ title, value, caption, icon: Icon }) => (
    <Card className={ADMIN_CARD_CLASS}>
        <CardContent className="flex items-start justify-between gap-4 p-5">
            <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className="text-2xl font-semibold text-foreground">{value}</p>
                {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
            </div>
            {Icon ? (
                <div className="rounded-xl border border-border/70 bg-background/60 p-2.5">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
            ) : null}
        </CardContent>
    </Card>
);

export default AdminMetricCard;
