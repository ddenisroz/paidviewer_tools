/**
 * StatsCard - Универсальная карточка статистики
 *
 * Используется в:
 * - Admin Dashboard
 * - Analytics Page
 * - Monitoring Page
 */

import React from 'react';

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import Skeleton from '@/shared/components/ui/skeleton';

export interface StatsCardProps {
    title: string;
    value: string | number;
    description?: string;
    icon?: React.ElementType;
    trend?: {
        value: number;
        label?: string;
        direction?: 'up' | 'down' | 'neutral';
    };
    color?: string;
    onClick?: () => void;
    loading?: boolean;
    className?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
    title,
    value,
    description,
    icon: Icon,
    trend,
    color = 'text-blue-400',
    onClick,
    loading = false,
    className,
}) => {
    if (loading) {
        return (
            <Card className={className}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4 rounded" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-3 w-32" />
                </CardContent>
            </Card>
        );
    }

    const getTrendIcon = () => {
        if (!trend) return null;

        const direction = trend.direction || (trend.value > 0 ? 'up' : trend.value < 0 ? 'down' : 'neutral');

        switch (direction) {
            case 'up':
                return <TrendingUp className="h-3 w-3" />;
            case 'down':
                return <TrendingDown className="h-3 w-3" />;
            case 'neutral':
                return <Minus className="h-3 w-3" />;
        }
    };

    const getTrendColor = () => {
        if (!trend) return '';

        const direction = trend.direction || (trend.value > 0 ? 'up' : trend.value < 0 ? 'down' : 'neutral');

        switch (direction) {
            case 'up':
                return 'text-green-400';
            case 'down':
                return 'text-red-400';
            case 'neutral':
                return 'text-gray-400';
        }
    };

    return (
        <Card
            className={cn(
                'hover:shadow-lg transition-all duration-200',
                onClick && 'cursor-pointer hover:border-primary',
                className
            )}
            onClick={onClick}
        >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                {Icon && <Icon className={cn('h-4 w-4', color)} />}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>

                {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}

                {trend && (
                    <div className={cn('flex items-center gap-1 text-xs mt-2', getTrendColor())}>
                        {getTrendIcon()}
                        <span>
                            {Math.abs(trend.value)}%{trend.label && ` ${trend.label}`}
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// Компонент сетки статистики
export interface StatsGridProps {
    stats: StatsCardProps[];
    columns?: 1 | 2 | 3 | 4;
    loading?: boolean;
    className?: string;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats, columns = 4, loading = false, className }) => {
    const gridCols = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    };

    return (
        <div className={cn('grid gap-4', gridCols[columns], className)}>
            {loading
                ? Array.from({ length: columns }).map((_, i) => <StatsCard key={i} title="" value="" loading />)
                : stats.map((stat, i) => <StatsCard key={i} {...stat} />)}
        </div>
    );
};

export default StatsCard;
