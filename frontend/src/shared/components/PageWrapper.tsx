import React, { ReactNode } from 'react';

interface PageWrapperProps {
    title?: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}

/**
 * Унифицированная обертка для всех страниц дашборда
 * Обеспечивает единообразное позиционирование заголовков и контента
 */
export const PageWrapper: React.FC<PageWrapperProps> = ({ 
    title: _title, 
    description, 
    actions, 
    children, 
    className = '' 
}) => {
    // Заголовок теперь показывается в Header, поэтому здесь не показываем title
    // Оставляем только description и actions если они нужны
    return (
        <div className={`container mx-auto px-6 py-4 space-y-6 min-h-[600px] ${className}`} style={{ scrollbarGutter: 'stable' }}>
            {/* Description и actions (без title, так как он в Header) */}
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

