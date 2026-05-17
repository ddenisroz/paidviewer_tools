import React, { useLayoutEffect, useState } from 'react';

import { SpinnerGap, TagSimple } from '@phosphor-icons/react';
import ReactDOM from 'react-dom';

import { logger } from '@/shared/utils/prodLogger';

import type { StreamCategory } from '@/types/stream';

interface StreamCategoryDropdownProps {
    platform: string;
    isOpen: boolean;
    isLoading?: boolean;
    search: string;
    onSelect: (platform: string, category: StreamCategory) => void;
    results: StreamCategory[];
    inputRef: HTMLInputElement | null;
}

export const StreamCategoryDropdown: React.FC<StreamCategoryDropdownProps> = ({
    platform,
    isOpen,
    isLoading = false,
    search,
    onSelect,
    results,
    inputRef,
}) => {
    const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(
        null
    );

    useLayoutEffect(() => {
        if (!isOpen || !inputRef) {
            setPosition(null);
            return undefined;
        }

        const updatePosition = (): void => {
            const rect = inputRef.getBoundingClientRect();
            const width = Math.min(rect.width, window.innerWidth - 16);
            const left = Math.min(rect.left, window.innerWidth - width - 8);
            const spaceBelow = window.innerHeight - rect.bottom - 12;
            const spaceAbove = rect.top - 12;
            const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
            const availableHeight = openUpward ? spaceAbove : spaceBelow;
            const maxHeight = Math.max(120, Math.min(320, availableHeight));
            const top = openUpward ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4;

            setPosition({
                top,
                left: Math.max(8, left),
                width,
                maxHeight,
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [inputRef, isOpen, results.length, search, isLoading]);

    if (!isOpen || !inputRef || !position) return null;

    const dropdownContent = (
        <div
            data-category-dropdown="true"
            className="fixed z-[9999] overflow-y-auto overscroll-contain rounded-md border border-sky-500/35 bg-[#0b0712] shadow-2xl shadow-black/60 ring-1 ring-white/10"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: `${position.width}px`,
                maxHeight: `${position.maxHeight}px`,
            }}
        >
            {!search.trim() ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">Начните вводить категорию.</div>
            ) : isLoading ? (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                    <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                    Ищем категории...
                </div>
            ) : results.length === 0 ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">Ничего не найдено.</div>
            ) : (
                results.map((cat) => (
                    <div
                        key={`${cat.id || cat.name}`}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors duration-200 hover:bg-muted/80"
                        onClick={() => {
                            logger.log('[CATEGORY DROPDOWN] Category clicked:', {
                                platform,
                                category: cat.name,
                                id: cat.id,
                            });
                            onSelect(platform, cat);
                        }}
                    >
                        <div className="flex-shrink-0">
                            {cat.box_art_url || cat.cover_url ? (
                                <img
                                    src={cat.box_art_url?.replace('{width}x{height}', '40x56') || cat.cover_url}
                                    alt={cat.name}
                                    className="h-10 w-8 rounded border border-white/10 object-cover"
                                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                        const img = e.currentTarget;
                                        const parent = img.parentElement;
                                        if (!parent) return;

                                        img.remove();

                                        const fallback = document.createElement('div');
                                        fallback.className =
                                            'flex h-10 w-8 items-center justify-center rounded border border-border/50 bg-muted/50';

                                        const icon = document.createElement('span');
                                        icon.className = 'text-xs text-muted-foreground';
                                        icon.textContent = '#';
                                        fallback.appendChild(icon);

                                        parent.appendChild(fallback);
                                    }}
                                />
                            ) : (
                                <div className="flex h-10 w-8 items-center justify-center rounded border border-white/10 bg-muted/50">
                                    <TagSimple className="h-4 w-4 text-muted-foreground" weight="duotone" />
                                </div>
                            )}
                        </div>
                        <span className="flex-1 truncate text-sm">{cat.name}</span>
                    </div>
                ))
            )}
        </div>
    );

    return ReactDOM.createPortal(dropdownContent, document.body);
};
