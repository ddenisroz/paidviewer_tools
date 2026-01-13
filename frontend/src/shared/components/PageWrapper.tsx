import React, { ReactNode } from 'react';

interface PageWrapperProps {
    title?: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    hideTitle?: boolean; // Опция для скрытия заголовка (например, на главной)
}

/**
 * Унифицированная обертка для всех страниц дашборда
 * Обеспечивает единообразное позиционирование заголовков и контента
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
        <div className={`container mx-auto px-6 py-4 space-y-6 min-h-[600px] ${className}`} style={{ scrollbarGutter: 'stable' }}>
            {/* Заголовок страницы */}
            {(title && !hideTitle) && (
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-white">{title}</h1>
                </div>
            )}

            {/* Description и actions */}
            {(description || actions) && (
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    {description && (
                        <p className="text-slate-400 text-sm">
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

            {/* Контент страницы */}
            <div className="space-y-6">
                {children}
            </div>
        </div>
    );
};

export default PageWrapper;

