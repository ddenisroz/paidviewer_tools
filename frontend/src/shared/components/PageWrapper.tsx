import React, { ReactNode } from 'react';

interface PageWrapperProps {
    title?: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    hideTitle?: boolean; // Option to hide page title (e.g. on Home)
}

/**
 * Unified wrapper for dashboard pages.
 * Keeps consistent spacing and header layout.
 */
export const PageWrapper: React.FC<PageWrapperProps> = ({
    title,
    description,
    actions,
    children,
    className = '',
    hideTitle = true
}) => {
    return (
        <div className={`container mx-auto w-full max-w-full px-4 py-4 space-y-6 min-h-[600px] sm:px-6 ${className}`} style={{ scrollbarGutter: 'stable' }}>
            {/* Page title */}
            {(title && !hideTitle) && (
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-foreground">{title}</h1>
                </div>
            )}

            {/* Description and actions */}
            {(description || actions) && (
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    {description && (
                        <p className="text-muted-foreground text-sm">
                            {description}
                        </p>
                    )}
                    {actions && (
                        <div className="flex gap-2">
                            {actions}
                        </div>
                    )}
                </div>
            )}

            {/* Page content */}
            <div className="min-w-0 space-y-6">
                {children}
            </div>
        </div>
    );
};

export default PageWrapper;
