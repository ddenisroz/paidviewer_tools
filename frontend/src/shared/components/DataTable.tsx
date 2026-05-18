import React, { useMemo, useState } from 'react';

import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Search,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

export interface DataTableColumn<T> {
    key: string;
    header: string;
    accessor: (row: T) => React.ReactNode;
    sortable?: boolean;
    searchable?: boolean;
    width?: string;
    align?: 'left' | 'center' | 'right';
    searchValue?: (row: T) => string;
    sortValue?: (row: T) => string | number | boolean | null | undefined;
    filterValue?: (row: T) => string;
}

export interface DataTableFilter {
    key: string;
    label: string;
    options: { value: string; label: string }[];
    defaultValue?: string;
    width?: string;
}

export interface DataTableBulkAction {
    key: string;
    label: string;
    icon?: React.ReactNode;
    variant?: 'default' | 'destructive' | 'outline';
    onClick: (selectedIds: string[]) => void | Promise<void>;
    confirmMessage?: string;
}

export interface DataTableProps<T> {
    data: T[];
    columns: DataTableColumn<T>[];
    getRowId: (row: T) => string;

    searchable?: boolean;
    searchPlaceholder?: string;
    filterable?: boolean;
    filters?: DataTableFilter[];
    sortable?: boolean;
    selectable?: boolean;
    bulkActions?: DataTableBulkAction[];

    pagination?: boolean;
    pageSize?: number;
    pageSizeOptions?: number[];

    className?: string;
    emptyMessage?: string;

    onRowClick?: (row: T) => void;
}

type SortDirection = 'asc' | 'desc' | null;

function asText(value: React.ReactNode): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return '';
}

function compareValues(
    a: string | number | boolean | null | undefined,
    b: string | number | boolean | null | undefined
): number {
    const aVal = a ?? '';
    const bVal = b ?? '';

    if (typeof aVal === 'number' && typeof bVal === 'number') {
        return aVal - bVal;
    }

    return String(aVal).localeCompare(String(bVal), 'en', { numeric: true, sensitivity: 'base' });
}

export function DataTable<T>({
    data,
    columns,
    getRowId,
    searchable = false,
    searchPlaceholder = 'Поиск...',
    filterable = false,
    filters = [],
    sortable = false,
    selectable = false,
    bulkActions = [],
    pagination = true,
    pageSize = 10,
    pageSizeOptions = [10, 25, 50, 100],
    className,
    emptyMessage = 'Нет данных',
    onRowClick,
}: DataTableProps<T>) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        filters.forEach((filter) => {
            initial[filter.key] = filter.defaultValue || 'all';
        });
        return initial;
    });
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [currentPageSize, setCurrentPageSize] = useState(pageSize);
    const [pendingBulkAction, setPendingBulkAction] = useState<{
        action: DataTableBulkAction;
        ids: string[];
    } | null>(null);

    const filteredData = useMemo(() => {
        let result = [...data];

        if (searchable && searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter((row) => {
                return columns.some((column) => {
                    if (!column.searchable) return false;
                    const text = (
                        column.searchValue ? column.searchValue(row) : asText(column.accessor(row))
                    ).toLowerCase();
                    return text.includes(query);
                });
            });
        }

        if (filterable) {
            Object.entries(filterValues).forEach(([key, selectedValue]) => {
                if (selectedValue === 'all') return;

                const column = columns.find((col) => col.key === key);
                if (!column) return;

                result = result.filter((row) => {
                    const value = column.filterValue
                        ? column.filterValue(row)
                        : column.searchValue
                          ? column.searchValue(row)
                          : asText(column.accessor(row));

                    return value === selectedValue;
                });
            });
        }

        if (sortable && sortColumn && sortDirection) {
            const column = columns.find((col) => col.key === sortColumn);
            if (column) {
                result.sort((a, b) => {
                    const aValue = column.sortValue
                        ? column.sortValue(a)
                        : column.searchValue
                          ? column.searchValue(a)
                          : asText(column.accessor(a));
                    const bValue = column.sortValue
                        ? column.sortValue(b)
                        : column.searchValue
                          ? column.searchValue(b)
                          : asText(column.accessor(b));

                    const comparison = compareValues(aValue, bValue);
                    return sortDirection === 'asc' ? comparison : -comparison;
                });
            }
        }

        return result;
    }, [columns, data, filterValues, filterable, searchQuery, searchable, sortColumn, sortDirection, sortable]);

    const totalPages = Math.ceil(filteredData.length / currentPageSize);
    const paginatedData = pagination
        ? filteredData.slice((currentPage - 1) * currentPageSize, currentPage * currentPageSize)
        : filteredData;

    const allPageIds = paginatedData.map(getRowId);
    const isAllSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));
    const selectedCount = selectedIds.size;

    const toggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                allPageIds.forEach((id) => next.delete(id));
                return next;
            });
            return;
        }

        setSelectedIds((prev) => {
            const next = new Set(prev);
            allPageIds.forEach((id) => next.add(id));
            return next;
        });
    };

    const toggleSelectRow = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSort = (columnKey: string) => {
        if (!sortable) return;

        const column = columns.find((col) => col.key === columnKey);
        if (!column?.sortable) return;

        if (sortColumn === columnKey) {
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else if (sortDirection === 'desc') {
                setSortColumn(null);
                setSortDirection(null);
            }
            return;
        }

        setSortColumn(columnKey);
        setSortDirection('asc');
    };

    const getSortIcon = (columnKey: string) => {
        if (sortColumn !== columnKey) {
            return <ArrowUpDown className="h-4 w-4 opacity-50" />;
        }
        if (sortDirection === 'asc') {
            return <ArrowUp className="h-4 w-4" />;
        }
        return <ArrowDown className="h-4 w-4" />;
    };

    const handleBulkAction = async (action: DataTableBulkAction) => {
        if (selectedCount === 0) return;

        const ids = Array.from(selectedIds);
        if (action.confirmMessage) {
            setPendingBulkAction({ action, ids });
            return;
        }

        await action.onClick(ids);
        setSelectedIds(new Set());
    };

    const confirmBulkAction = async (): Promise<void> => {
        if (!pendingBulkAction) return;
        await pendingBulkAction.action.onClick(pendingBulkAction.ids);
        setSelectedIds(new Set());
        setPendingBulkAction(null);
    };

    const resetFilters = () => {
        const next: Record<string, string> = {};
        filters.forEach((filter) => {
            next[filter.key] = filter.defaultValue || 'all';
        });
        setFilterValues(next);
        setCurrentPage(1);
    };

    const hasToolbar = searchable || filterable || (selectable && bulkActions.length > 0);

    return (
        <div className={cn('space-y-4', className)}>
            {hasToolbar && (
                <div className="rounded-lg border border-border p-3 bg-card/40">
                    <div className="grid gap-3 lg:grid-cols-[minmax(320px,1fr)_auto] lg:items-end">
                        <div className="space-y-2">
                            {searchable && (
                                <div className="relative max-w-lg">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder={searchPlaceholder}
                                        value={searchQuery}
                                        onChange={(event) => {
                                            setSearchQuery(event.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="pl-9"
                                    />
                                </div>
                            )}

                            {filterable && filters.length > 0 && (
                                <div className="flex flex-wrap items-end gap-2">
                                    {filters.map((filter) => (
                                        <div
                                            key={filter.key}
                                            className="space-y-1"
                                            style={{ width: filter.width || '170px' }}
                                        >
                                            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                {filter.label}
                                            </div>
                                            <Select
                                                value={filterValues[filter.key]}
                                                onValueChange={(value) => {
                                                    setFilterValues((prev) => ({ ...prev, [filter.key]: value }));
                                                    setCurrentPage(1);
                                                }}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder={filter.label} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {filter.options.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}

                                    <Button variant="ghost" size="sm" className="h-9 px-3" onClick={resetFilters}>
                                        Сбросить
                                    </Button>
                                </div>
                            )}
                        </div>

                        {selectable && bulkActions.length > 0 && (
                            <div className="flex min-h-9 flex-wrap items-center justify-start gap-2 lg:justify-end">
                                <span
                                    className={cn(
                                        'w-28 text-right text-sm text-muted-foreground tabular-nums',
                                        selectedCount === 0 && 'opacity-0'
                                    )}
                                >
                                    Выбрано: {selectedCount}
                                </span>
                                {bulkActions.map((action) => (
                                    <Button
                                        key={action.key}
                                        variant={action.variant || 'outline'}
                                        size="sm"
                                        disabled={selectedCount === 0}
                                        className={cn(
                                            'min-w-[132px] justify-center',
                                            selectedCount === 0 && 'opacity-0 pointer-events-none'
                                        )}
                                        onClick={() => handleBulkAction(action)}
                                    >
                                        {action.icon}
                                        {action.label}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full table-auto">
                        <thead className="bg-muted/40">
                            <tr>
                                {selectable && (
                                    <th className="w-12 p-3 text-center align-middle">
                                        <Checkbox checked={isAllSelected} onCheckedChange={toggleSelectAll} />
                                    </th>
                                )}

                                {columns.map((column) => (
                                    <th
                                        key={column.key}
                                        className={cn(
                                            'p-3 text-sm font-semibold align-middle',
                                            column.align === 'left' && 'text-left',
                                            column.align === 'center' && 'text-center',
                                            column.align === 'right' && 'text-right',
                                            column.sortable &&
                                                'cursor-pointer select-none hover:bg-muted transition-colors'
                                        )}
                                        style={{ width: column.width }}
                                        onClick={() => column.sortable && handleSort(column.key)}
                                    >
                                        <div
                                            className={cn(
                                                'flex items-center gap-2',
                                                column.align === 'left' && 'justify-start',
                                                column.align === 'center' && 'justify-center',
                                                column.align === 'right' && 'justify-end'
                                            )}
                                        >
                                            <span>{column.header}</span>
                                            {column.sortable ? (
                                                <span className="w-4">{getSortIcon(column.key)}</span>
                                            ) : null}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {paginatedData.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columns.length + (selectable ? 1 : 0)}
                                        className="p-8 text-center text-muted-foreground"
                                    >
                                        {emptyMessage}
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((row) => {
                                    const rowId = getRowId(row);
                                    const isSelected = selectedIds.has(rowId);

                                    return (
                                        <tr
                                            key={rowId}
                                            className={cn(
                                                'border-t border-border transition-colors',
                                                onRowClick && 'cursor-pointer hover:bg-muted/40',
                                                isSelected && 'bg-muted/50'
                                            )}
                                            onClick={() => onRowClick?.(row)}
                                        >
                                            {selectable && (
                                                <td
                                                    className="p-3 text-center align-middle"
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleSelectRow(rowId)}
                                                    />
                                                </td>
                                            )}

                                            {columns.map((column) => (
                                                <td
                                                    key={column.key}
                                                    className={cn(
                                                        'p-3 text-sm align-middle',
                                                        column.align === 'left' && 'text-left',
                                                        column.align === 'center' && 'text-center',
                                                        column.align === 'right' && 'text-right'
                                                    )}
                                                >
                                                    {column.accessor(row)}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {pagination && totalPages > 1 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Строк на странице:</span>
                        <Select
                            value={String(currentPageSize)}
                            onValueChange={(value) => {
                                setCurrentPageSize(Number(value));
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[100px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {pageSizeOptions.map((size) => (
                                    <SelectItem key={size} value={String(size)}>
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="text-sm text-muted-foreground tabular-nums">
                        Страница {currentPage} из {totalPages} ({filteredData.length} строк)
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                        >
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
            <ConfirmDialog
                open={pendingBulkAction !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingBulkAction(null);
                }}
                title="Подтвердите действие"
                description={pendingBulkAction?.action.confirmMessage || ''}
                confirmLabel={pendingBulkAction?.action.label || 'Подтвердить'}
                variant={pendingBulkAction?.action.variant === 'destructive' ? 'destructive' : 'default'}
                onConfirm={confirmBulkAction}
            />
        </div>
    );
}
