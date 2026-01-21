import * as React from "react"
import { useRef, useState } from "react"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props} />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, closeOnOverlayClick = true, closeOnEscape = true, ...props }, _ref) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Получаем состояние открытия из Radix
  const [open, setOpen] = React.useState(false);

  // Проверяем состояние при монтировании и изменениях
  React.useEffect(() => {
    let observer: MutationObserver | null = null;

    const checkState = () => {
      const dialog = dialogRef.current?.closest('[data-state]') as HTMLElement | null;
      if (dialog) {
        const state = dialog.getAttribute('data-state');
        const isOpen = state === 'open';

        setOpen(prevOpen => {
          if (prevOpen !== isOpen) {
            if (isOpen) {
              setIsAnimating(true);
              setTimeout(() => setIsAnimating(false), 50);
            } else {
              setIsAnimating(true);
              setTimeout(() => {
                setIsAnimating(false);
              }, 200);
            }
          }
          return isOpen;
        });
      }
    };

    // Небольшая задержка для того, чтобы DOM обновился
    const timeoutId = setTimeout(() => {
      checkState();

      // Подписываемся на изменения состояния
      const dialog = dialogRef.current?.closest('[data-state]') as HTMLElement | null;
      if (dialog) {
        observer = new MutationObserver(() => {
          checkState();
        });
        observer.observe(dialog, { attributes: true, attributeFilter: ['data-state'] });
      }
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  React.useEffect(() => {
    if (open) {
      // Сохраняем текущее значение padding-right
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      const originalPaddingRight = document.body.style.paddingRight;
      const originalOverflow = document.body.style.overflow;

      // Блокируем прокрутку и добавляем padding для компенсации скроллбара
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      return () => {
        // Восстанавливаем исходные значения
        document.body.style.overflow = originalOverflow || '';
        document.body.style.paddingRight = originalPaddingRight || '';
      };
    }
  }, [open]);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape' && open) {
        // Закрываем диалог через Radix
        const closeButton = dialogRef.current?.querySelector('[data-radix-dialog-close]') as HTMLElement | null;
        closeButton?.click();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, closeOnEscape]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === overlayRef.current) {
      const closeButton = dialogRef.current?.querySelector('[data-radix-dialog-close]') as HTMLElement | null;
      closeButton?.click();
    }
  };

  return (
    <DialogPortal>
      <DialogOverlay
        ref={overlayRef}
        onClick={handleOverlayClick}
        className={cn(
          "transition-opacity duration-200 backdrop-blur-sm",
          isAnimating ? "opacity-0" : "opacity-100"
        )}
      />
      <DialogPrimitive.Content
        ref={dialogRef}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-white/10 bg-slate-900/95 backdrop-blur-xl p-6 shadow-2xl duration-200 sm:rounded-xl",
          "transform transition-all duration-200",
          isAnimating ? "scale-95 opacity-0" : "scale-100 opacity-100",
          className
        )}
        onPointerDownOutside={(e) => {
          // Проверяем, кликнули ли на overlay
          if (closeOnOverlayClick && overlayRef.current && overlayRef.current.contains(e.target as Node)) {
            // Клик на overlay - разрешаем закрытие
            return;
          }
          // Клик вне overlay (например, на элементы вне диалога) - предотвращаем закрытие
          e.preventDefault();
        }}
        {...props}>
        {children}
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}

