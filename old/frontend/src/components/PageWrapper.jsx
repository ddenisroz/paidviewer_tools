import React from 'react';

/**
 * Унифицированная обертка для всех страниц дашборда
 * Обеспечивает единообразное позиционирование заголовков и контента
 */
export const PageWrapper = ({ 
    title, 
    description, 
    actions, 
    children, 
    className = '' 
}) => {
    return (
        <div className={`container mx-auto p-6 space-y-6 min-h-[600px] ${className}`} style={{ scrollbarGutter: 'stable' }}>
            {/* Единообразный заголовок для всех страниц */}
            {(title || description || actions) && (
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        {title && (
                            <h1 className="text-3xl font-bold text-foreground">
                                {title}
                            </h1>
                        )}
                        {description && (
                            <p className="text-slate-400 mt-2">
                                {description}
                            </p>
                        )}
                    </div>
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
