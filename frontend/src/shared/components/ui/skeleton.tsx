import React from 'react';

import { cn } from '@/lib/utils';

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => (
    <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
);

// Скелетон для карточек
interface CardSkeletonProps {
    className?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ className }) => (
    <div className={cn('rounded-lg border bg-card p-6', className)}>
        <div className="space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
        </div>
    </div>
);

// Скелетон для списков
interface ListSkeletonProps {
    count?: number;
    className?: string;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({ count = 3, className }) => (
    <div className={cn('space-y-3', className)}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[100px]" />
                </div>
            </div>
        ))}
    </div>
);

// Скелетон для таблиц
interface TableSkeletonProps {
    rows?: number;
    columns?: number;
    className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 4, className }) => (
    <div className={cn('space-y-3', className)}>
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex space-x-4">
                {Array.from({ length: columns }).map((_, j) => (
                    <Skeleton key={j} className="h-4 flex-1" />
                ))}
            </div>
        ))}
    </div>
);

// Скелетон для голосов
interface VoiceCardSkeletonProps {
    count?: number;
}

export const VoiceCardSkeleton: React.FC<VoiceCardSkeletonProps> = ({ count = 6 }) => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
            <CardSkeleton key={i} className="h-48" />
        ))}
    </div>
);

// Скелетон для настроек TTS
export const TtsSettingsSkeleton: React.FC = () => (
    <div className="space-y-6">
        <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-20 w-full" />
        </div>
    </div>
);

export default Skeleton;
