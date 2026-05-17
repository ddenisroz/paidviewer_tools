/**
 * EmptyState - Универсальное пустое состояние
 *
 * Используется когда нет данных для отображения
 */

import React from 'react';

import { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';

export interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
        icon?: LucideIcon;
    };
    className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
            {Icon && (
                <div className="mb-4 rounded-full bg-gray-800/50 p-6">
                    <Icon className="h-12 w-12 text-muted-foreground" />
                </div>
            )}

            <h3 className="text-lg font-semibold mb-2">{title}</h3>

            {description && <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>}

            {action && (
                <Button onClick={action.onClick}>
                    {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                    {action.label}
                </Button>
            )}
        </div>
    );
}
