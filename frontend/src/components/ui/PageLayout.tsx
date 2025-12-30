import React, { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { PageLoader } from './loader';

interface PageLayoutProps {
    children: ReactNode;
    className?: string;
    title?: string;
    description?: string;
    loading?: boolean;
    skeleton?: ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({ 
    children, 
    className,
    title,
    description,
    loading = false,
    skeleton = null 
}) => {
    if (loading) {
        return (
            <div className={cn("container mx-auto p-6 space-y-6", className)}>
                {title && (
                    <div>
                        <h1 className="text-3xl font-bold mb-6 text-foreground">{title}</h1>
                        {description && <p className="text-muted-foreground">{description}</p>}
                    </div>
                )}
                {skeleton || <PageLoader message="Загрузка..." />}
            </div>
        );
    }

    return (
        <div className={cn("container mx-auto p-6 space-y-6", className)}>
            {title && (
                <div>
                    <h1 className="text-3xl font-bold mb-6 text-foreground">{title}</h1>
                    {description && <p className="text-muted-foreground">{description}</p>}
                </div>
            )}
            {children}
        </div>
    );
};

export default PageLayout;

