import React from 'react';
import { cn } from '../../lib/utils';

const Loader = ({ className, size = "default", ...props }) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    default: "h-8 w-8", 
    lg: "h-12 w-12",
    xl: "h-16 w-16"
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-muted border-t-purple-600",
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
};

const LoaderWithText = ({ text = "Загрузка...", size = "default", className, ...props }) => {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)} {...props}>
      <Loader size={size} />
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
};

const PageLoader = ({ text = "Загрузка данных..." }) => {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <Loader size="xl" />
        <p className="text-lg text-muted-foreground">{text}</p>
      </div>
    </div>
  );
};

const CardLoader = ({ text = "Загрузка..." }) => {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <Loader size="lg" />
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
};

export { Loader, LoaderWithText, PageLoader, CardLoader };
