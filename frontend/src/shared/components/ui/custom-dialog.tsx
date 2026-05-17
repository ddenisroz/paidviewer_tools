import React, { ReactNode, useEffect, useRef, useState } from 'react';

import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

interface CustomDialogProps {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
    className?: string;
    closeOnOverlayClick?: boolean;
    closeOnEscape?: boolean;
}

const CustomDialog: React.FC<CustomDialogProps> = ({
    open,
    onOpenChange,
    children,
    className,
    closeOnOverlayClick = true,
    closeOnEscape = true,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            setIsVisible(true);
            setIsAnimating(true);
            // Небольшая задержка для плавной анимации
            const timer = setTimeout(() => setIsAnimating(false), 50);
            return () => clearTimeout(timer);
        } else {
            setIsAnimating(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setIsAnimating(false);
            }, 200); // Время анимации
            return () => clearTimeout(timer);
        }
    }, [open]);

    useEffect(() => {
        if (open) {
            // Блокируем скролл body
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = 'unset';
            };
        }
    }, [open]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (closeOnEscape && e.key === 'Escape' && open) {
                onOpenChange?.(false);
            }
        };

        if (open) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [open, closeOnEscape, onOpenChange]);

    const handleOverlayClick = (e: React.MouseEvent) => {
        // Проверяем, что клик именно по overlay, а не по содержимому диалога
        if (closeOnOverlayClick && e.target === overlayRef.current) {
            onOpenChange?.(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div
            ref={overlayRef}
            className={cn(
                'fixed inset-0 z-[10030] flex items-center justify-center',
                'bg-black/80',
                'transition-opacity duration-150 ease-out',
                isAnimating ? 'opacity-0' : 'opacity-100'
            )}
            onClick={handleOverlayClick}
        >
            <div
                ref={dialogRef}
                className={cn(
                    'relative rounded-lg border border-border/70 bg-[#0b0712] shadow-2xl ring-1 ring-white/10',
                    'max-w-lg w-full mx-4',
                    'transform transition-[opacity,transform] duration-150 ease-out',
                    isAnimating ? 'scale-[0.98] opacity-0' : 'scale-100 opacity-100',
                    className
                )}
                onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие при клике на содержимое
            >
                {children}
            </div>
        </div>
    );
};

const CustomDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => (
        <div ref={ref} className={cn('p-6', className)} {...props}>
            {children}
        </div>
    )
);
CustomDialogContent.displayName = 'CustomDialogContent';

const CustomDialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
CustomDialogHeader.displayName = 'CustomDialogHeader';

const CustomDialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h2 ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
    )
);
CustomDialogTitle.displayName = 'CustomDialogTitle';

const CustomDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
    )
);
CustomDialogDescription.displayName = 'CustomDialogDescription';

const CustomDialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
);
CustomDialogFooter.displayName = 'CustomDialogFooter';

const CustomDialogClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ className, ...props }, ref) => (
        <button
            ref={ref}
            className={cn(
                'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity',
                'hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:pointer-events-none',
                className
            )}
            onClick={(e) => props.onClick?.(e)}
            {...props}
        >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
        </button>
    )
);
CustomDialogClose.displayName = 'CustomDialogClose';

export {
    CustomDialog,
    CustomDialogContent,
    CustomDialogHeader,
    CustomDialogTitle,
    CustomDialogDescription,
    CustomDialogFooter,
    CustomDialogClose,
};
