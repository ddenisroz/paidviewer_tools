import React, { ReactNode } from 'react';

interface PageWrapperProps {
    title?: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
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
    contentClassName = '',
    hideTitle = true,
}) => {
    return (
        <div
            className={`pv-page-shell container mx-auto w-full max-w-full space-y-6 min-h-[600px] min-[1280px]:space-y-7 ${className}`}
            style={{ scrollbarGutter: 'stable' }}
        >
            {/* Page title */}
            {title && !hideTitle && (
                <div className="mb-6">
                    <h1 className="app-heading-page text-2xl text-foreground">{title}</h1>
                </div>
            )}

            {/* Description and actions */}
            {(description || actions) && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center justify-between gap-3">
                    {description && (
                        <p className="app-body-text text-sm text-muted-foreground sm:text-[0.9375rem]">{description}</p>
                    )}
                    {actions && <div className="flex min-w-0 flex-wrap justify-end gap-2">{actions}</div>}
                </div>
            )}

            {/* Page content */}
            <div className={`min-w-0 space-y-4 min-[1280px]:space-y-6 ${contentClassName}`}>{children}</div>
        </div>
    );
};

export default PageWrapper;
