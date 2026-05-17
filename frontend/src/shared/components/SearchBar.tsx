/**
 * SearchBar - Универсальный компонент поиска с фильтрами
 *
 * Используется в:
 * - User Management
 * - Voice Management
 * - Support Tickets
 * - System Logs
 */

import React from 'react';

import { Search, SlidersHorizontal, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

export interface SearchFilter {
    key: string;
    label: string;
    type: 'select' | 'boolean' | 'date';
    options?: Array<{ value: string; label: string }>;
}

export interface ActiveFilter {
    key: string;
    value: string;
    label: string;
}

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    filters?: SearchFilter[];
    activeFilters?: ActiveFilter[];
    onFilterChange?: (key: string, value: string) => void;
    onFilterRemove?: (key: string) => void;
    onClearAll?: () => void;
    className?: string;
    showFilterButton?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    value,
    onChange,
    placeholder = 'Поиск...',
    filters = [],
    activeFilters = [],
    onFilterChange,
    onFilterRemove,
    onClearAll,
    className,
    showFilterButton = true,
}) => {
    const [showFilters, setShowFilters] = React.useState(false);
    const hasActiveFilters = activeFilters.length > 0;

    return (
        <div className={cn('space-y-4', className)}>
            {/* Строка поиска */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        className="pl-10 pr-10"
                    />
                    {value && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onChange('')}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {showFilterButton && filters.length > 0 && (
                    <Button
                        variant={showFilters ? 'default' : 'outline'}
                        onClick={() => setShowFilters(!showFilters)}
                        className="gap-2"
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        Фильтры
                        {hasActiveFilters && (
                            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                                {activeFilters.length}
                            </Badge>
                        )}
                    </Button>
                )}
            </div>

            {/* Активные фильтры */}
            {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm text-muted-foreground">Активные фильтры:</span>
                    {activeFilters.map((filter) => (
                        <Badge key={filter.key} variant="secondary" className="gap-1 pr-1">
                            <span className="text-xs">{filter.label}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onFilterRemove?.(filter.key)}
                                className="h-4 w-4 p-0 hover:bg-transparent"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    ))}
                    {onClearAll && (
                        <Button variant="ghost" size="sm" onClick={onClearAll} className="h-6 text-xs">
                            Очистить все
                        </Button>
                    )}
                </div>
            )}

            {/* Панель фильтров */}
            {showFilters && filters.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    {filters.map((filter) => (
                        <div key={filter.key} className="space-y-2">
                            <label className="text-sm font-medium">{filter.label}</label>
                            {filter.type === 'select' && filter.options && (
                                <Select
                                    value={activeFilters.find((f) => f.key === filter.key)?.value || ''}
                                    onValueChange={(value) => onFilterChange?.(filter.key, value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Выберите..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filter.options.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchBar;
