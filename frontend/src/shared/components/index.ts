// Shared Components Index
// Re-export all shared components for easier imports

export { default as AuthGuard } from './AuthGuard';
export { default as PermissionGuard } from './PermissionGuard';
export { default as PageWrapper } from './PageWrapper';
export { default as LoadingSpinner } from './LoadingSpinner';
export { default as StatusBadge } from './StatusBadge';
export { TwitchIcon, VKIcon } from './PlatformIcons';

// New unified components
export { DataTable } from './DataTable';
export type { DataTableColumn, DataTableFilter, DataTableBulkAction, DataTableProps } from './DataTable';
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
export { ErrorState } from './ErrorState';
export type { ErrorStateProps } from './ErrorState';
export { ConfirmDialog } from './ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog';
export { FormBuilder } from './FormBuilder';
export type { FormBuilderProps, FieldConfig, FieldType, SelectOption } from './FormBuilder';
export { SearchBar } from './SearchBar';
export type { SearchFilter, ActiveFilter } from './SearchBar';
export { StatsCard, StatsGrid } from './StatsCard';
export type { StatsCardProps, StatsGridProps } from './StatsCard';
