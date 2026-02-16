import React from 'react';

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Tag } from 'lucide-react';
import ReactDOM from 'react-dom';

import { logger } from '@/shared/utils/prodLogger';

import type { StreamCategory } from '@/types/stream';

interface StreamCategoryDropdownProps {
    platform: string;
    search: string;
    onSelect: (platform: string, category: StreamCategory) => void;
    results: StreamCategory[];
    inputRef: HTMLInputElement | null;
}

export const StreamCategoryDropdown: React.FC<StreamCategoryDropdownProps> = ({
    platform,
    search,
    onSelect,
    results,
    inputRef
}) => {
    if (!search || !Array.isArray(results) || results.length === 0 || !inputRef) return null;

    const rect = inputRef.getBoundingClientRect();

    const dropdownContent = (
        <div
            data-category-dropdown="true"
            className="fixed bg-popover border border-border rounded-md shadow-lg max-h-[280px] overflow-y-auto z-[9999] animate-in fade-in zoom-in-95 duration-100"
            style={{
                top: `${rect.bottom + 4}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
            }}
        >
            {results.map((cat) => (
                <div
                    key={cat.id}
                    className="px-3 py-2 hover:bg-muted/80 cursor-pointer flex items-center gap-3 transition-colors duration-200"
                    onClick={() => {
                        logger.log('[CATEGORY DROPDOWN] Category clicked:', { platform, category: cat.name, id: cat.id });
                        onSelect(platform, cat);
                    }}
                >
                    <div className="flex-shrink-0">
                        {(cat.box_art_url || cat.cover_url) ? (
                            <img
                                src={cat.box_art_url?.replace('{width}x{height}', '40x56') || cat.cover_url}
                                alt={cat.name}
                                className="w-8 h-10 rounded object-cover border border-white/10"
                                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-8 h-10 bg-muted/50 rounded flex items-center justify-center border border-border/50"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-muted-foreground"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l5 5a2 2 0 0 0 2.828 0l7-7a2 2 0 0 0 0-2.828l-5-5a2 2 0 0 0-1.414-.586z"/><path d="M7 7h.01"/></svg></div>';
                                }}
                            />
                        ) : (
                            <div className="w-8 h-10 bg-muted/50 rounded flex items-center justify-center border border-white/10">
                                <Tag className="w-4 h-4 text-muted-foreground" />
                            </div>
                        )}
                    </div>
                    <span className="flex-1 truncate text-sm">{cat.name}</span>
                </div>
            ))}
        </div>
    );

    return ReactDOM.createPortal(dropdownContent, document.body);
};
