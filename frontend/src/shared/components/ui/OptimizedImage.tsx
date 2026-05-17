/**
 * OptimizedImage Component
 * Provides lazy loading and optimized image rendering
 */
import React, { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    className?: string;
    fallback?: string;
    eager?: boolean; // Skip lazy loading for critical images
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
    src,
    alt,
    className,
    fallback = '/images/placeholder.svg',
    eager = false,
    ...props
}) => {
    const [imageSrc, setImageSrc] = useState<string>(eager ? src : fallback);
    const [isLoading, setIsLoading] = useState(!eager);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        // Skip lazy loading for eager images
        if (eager) {
            setIsLoading(false);
            return;
        }

        // Use Intersection Observer for lazy loading
        if (!imgRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setImageSrc(src);
                        observer.disconnect();
                    }
                });
            },
            {
                rootMargin: '50px', // Start loading 50px before image enters viewport
            }
        );

        observer.observe(imgRef.current);

        return () => {
            observer.disconnect();
        };
    }, [src, eager]);

    const handleLoad = () => {
        setIsLoading(false);
        setHasError(false);
    };

    const handleError = () => {
        setIsLoading(false);
        setHasError(true);
        setImageSrc(fallback);
    };

    return (
        <img
            ref={imgRef}
            src={imageSrc}
            alt={alt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
            className={cn(
                'transition-opacity duration-300',
                isLoading && 'opacity-0',
                !isLoading && 'opacity-100',
                hasError && 'opacity-50',
                className
            )}
            {...props}
        />
    );
};
