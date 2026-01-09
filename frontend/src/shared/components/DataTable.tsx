/**
 * DataTable - Универсальная таблица с поиском, фильтрами, сортировкой, пагинацией
 * 
 * Используется в:
 * - UserManagementPage
 * - VoiceManagementPage
 * - SystemLogsPage
 * - CommandsPage
 * - PointsManagementPage
 */

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
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

// ============================================
// TYPES
// ============================================

export interface DataTableColumn<T> {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  searchable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableFilter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
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
  // Data
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  
  // Features
  searchable?: boolean;
  searchPlaceholder?: string;
  filterable?: boolean;
  filters?: DataTableFilter[];
  sortable?: boolean;
  selectable?: boolean;
  bulkActions?: DataTableBulkAction[];
  
  // Pagination
  pagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  
  // Styling
  className?: string;
  emptyMessage?: string;
  
  // Callbacks
  onRowClick?: (row: T) => void;
}

type SortDirection = 'asc' | 'desc' | null;

// ============================================
// COMPONENT
// ============================================

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
  // ============================================
  // STATE
  // ============================================
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    filters.forEach(filter => {
      initial[filter.key] = filter.defaultValue || 'all';
    });
    return initial;
  });
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);

  // ============================================
  // FILTERING & SORTING
  // ============================================
  
  const filteredData = useMemo(() => {
    let result = [...data];

    // Search
    if (searchable && searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(row => {
        return columns.some(col => {
          if (!col.searchable) return false;
          const value = col.accessor(row);
          if (typeof value === 'string') {
            return value.toLowerCase().includes(query);
          }
          return false;
        });
      });
    }

    // Filters
    if (filterable) {
      Object.entries(filterValues).forEach(([key, value]) => {
        if (value === 'all') return;
        
        const filter = filters.find(f => f.key === key);
        if (!filter) return;

        result = result.filter(row => {
          const column = columns.find(col => col.key === key);
          if (!column) return true;
          
          const cellValue = column.accessor(row);
          return String(cellValue) === value;
        });
      });
    }

    // Sort
    if (sortable && sortColumn && sortDirection) {
      const column = columns.find(col => col.key === sortColumn);
      if (column) {
        result.sort((a, b) => {
          const aValue = column.accessor(a);
          const bValue = column.accessor(b);
          
          const aStr = String(aValue);
          const bStr = String(bValue);
          
          const comparison = aStr.localeCompare(bStr, 'ru', { numeric: true });
          return sortDirection === 'asc' ? comparison : -comparison;
        });
      }
    }

    return result;
  }, [data, searchQuery, filterValues, sortColumn, sortDirection, columns, searchable, filterable, filters, sortable]);

  // ============================================
  // PAGINATION
  // ============================================
  
  const totalPages = Math.ceil(filteredData.length / currentPageSize);
  const paginatedData = pagination
    ? filteredData.slice((currentPage - 1) * currentPageSize, currentPage * currentPageSize)
    : filteredData;

  // ============================================
  // SELECTION
  // ============================================
  
  const allPageIds = paginatedData.map(getRowId);
  const isAllSelected = allPageIds.length > 0 && allPageIds.every(id => selectedIds.has(id));
  const _isSomeSelected = allPageIds.some(id => selectedIds.has(id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allPageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allPageIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ============================================
  // SORTING
  // ============================================
  
  const handleSort = (columnKey: string) => {
    if (!sortable) return;
    
    const column = columns.find(col => col.key === columnKey);
    if (!column?.sortable) return;

    if (sortColumn === columnKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
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

  // ============================================
  // BULK ACTIONS
  // ============================================
  
  const handleBulkAction = async (action: DataTableBulkAction) => {
    if (selectedIds.size === 0) return;

    if (action.confirmMessage) {
      if (!window.confirm(action.confirmMessage)) return;
    }

    await action.onClick(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  // ============================================
  // RENDER
  // ============================================
  
  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      {(searchable || filterable || (selectable && bulkActions.length > 0)) && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
          )}

          {/* Filters */}
          {filterable && filters.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {filters.map(filter => (
                <Select
                  key={filter.key}
                  value={filterValues[filter.key]}
                  onValueChange={(value) => {
                    setFilterValues(prev => ({ ...prev, [filter.key]: value }));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={filter.label} />
                  </SelectTrigger>
                  <SelectContent>
                    {filter.options.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
            </div>
          )}

          {/* Bulk Actions */}
          {selectable && bulkActions.length > 0 && selectedIds.size > 0 && (
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground self-center">
                Выбрано: {selectedIds.size}
              </span>
              {bulkActions.map(action => (
                <Button
                  key={action.key}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={() => handleBulkAction(action)}
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                {/* Selection column */}
                {selectable && (
                  <th className="w-12 p-3">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                )}

                {/* Data columns */}
                {columns.map(column => (
                  <th
                    key={column.key}
                    className={cn(
                      'p-3 text-left font-semibold text-sm',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      column.sortable && 'cursor-pointer hover:bg-gray-700/50 transition-colors'
                    )}
                    style={{ width: column.width }}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-2">
                      {column.header}
                      {column.sortable && getSortIcon(column.key)}
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
                paginatedData.map(row => {
                  const rowId = getRowId(row);
                  const isSelected = selectedIds.has(rowId);

                  return (
                    <tr
                      key={rowId}
                      className={cn(
                        'border-t border-gray-700 transition-colors',
                        onRowClick && 'cursor-pointer hover:bg-gray-800/50',
                        isSelected && 'bg-gray-800/30'
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {/* Selection cell */}
                      {selectable && (
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectRow(rowId)}
                          />
                        </td>
                      )}

                      {/* Data cells */}
                      {columns.map(column => (
                        <td
                          key={column.key}
                          className={cn(
                            'p-3 text-sm',
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

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Page size selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Показать:</span>
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
                {pageSizeOptions.map(size => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page info */}
          <div className="text-sm text-muted-foreground">
            Страница {currentPage} из {totalPages} ({filteredData.length} записей)
          </div>

          {/* Page navigation */}
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
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
    </div>
  );
}
