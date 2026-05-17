/**
 * FormBuilder - Универсальная форма с react-hook-form + Zod
 *
 * Используется в:
 * - TTS settings (5+ форм)
 * - Bot settings (3+ формы)
 * - User settings (2+ формы)
 * - Command creation (1 форма)
 * - Voice creation (1 форма)
 * - Drops configuration (1 форма)
 *
 * Возможности:
 * - Автогенерация полей из Zod схемы
 * - Валидация в реальном времени
 * - Error handling
 * - Loading states
 * - Кастомные field renderers
 */

import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Controller, ControllerRenderProps, FieldValues, Path, useForm } from 'react-hook-form';
import { z } from 'zod';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';

// ============================================
// TYPES
// ============================================

export type FieldType =
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'textarea'
    | 'checkbox'
    | 'switch'
    | 'select'
    | 'slider'
    | 'custom';

export interface SelectOption {
    value: string | number;
    label: string;
}

export interface FieldConfig<T extends FieldValues> {
    name: Path<T>;
    label: string;
    type: FieldType;
    placeholder?: string;
    description?: string;
    options?: SelectOption[]; // For select
    min?: number; // For number, slider
    max?: number; // For number, slider
    step?: number; // For number, slider
    rows?: number; // For textarea
    disabled?: boolean;
    hidden?: boolean;
    customRender?: (field: ControllerRenderProps<T, Path<T>>, error?: string) => React.ReactNode;
}

export interface FormBuilderProps<T extends FieldValues> {
    schema: z.ZodType<T>;
    fields: FieldConfig<T>[];
    defaultValues?: Partial<T>;
    onSubmit: (data: T) => void | Promise<void>;
    submitLabel?: string;
    cancelLabel?: string;
    onCancel?: () => void;
    loading?: boolean;
    className?: string;
    formClassName?: string;
    fieldClassName?: string;
    showCancelButton?: boolean;
}

// ============================================
// COMPONENT
// ============================================

export function FormBuilder<T extends FieldValues>({
    schema,
    fields,
    defaultValues,
    onSubmit,
    submitLabel = 'Сохранить',
    cancelLabel = 'Отмена',
    onCancel,
    loading = false,
    className,
    formClassName,
    fieldClassName,
    showCancelButton = false,
}: FormBuilderProps<T>) {
    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<T>({
        // @ts-expect-error - Zod resolver type incompatibility with react-hook-form
        resolver: zodResolver(schema),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        defaultValues: defaultValues as any,
    });

    const isLoading = loading || isSubmitting;

    const handleFormSubmit = handleSubmit(async (data) => {
        await onSubmit(data as unknown as T);
    });

    const handleCancel = () => {
        reset();
        onCancel?.();
    };

    const renderField = (fieldConfig: FieldConfig<T>) => {
        const {
            name,
            label,
            type,
            placeholder,
            description,
            options,
            min,
            max,
            step,
            rows,
            disabled,
            hidden,
            customRender,
        } = fieldConfig;
        const error = errors[name]?.message as string | undefined;

        if (hidden) return null;

        return (
            <Controller
                key={name}
                name={name}
                control={control}
                render={({ field }) => {
                    // Custom render
                    if (customRender) {
                        return (
                            <div className={cn('space-y-2', fieldClassName)}>
                                <Label htmlFor={name}>{label}</Label>
                                {customRender(field, error)}
                                {description && <p className="text-xs text-muted-foreground">{description}</p>}
                                {error && <p className="text-xs text-red-400">{error}</p>}
                            </div>
                        );
                    }

                    // Text input
                    if (type === 'text' || type === 'email' || type === 'password') {
                        return (
                            <div className={cn('space-y-2', fieldClassName)}>
                                <Label htmlFor={name}>{label}</Label>
                                <Input
                                    {...field}
                                    id={name}
                                    type={type}
                                    placeholder={placeholder}
                                    disabled={disabled || isLoading}
                                    className={error ? 'border-red-400' : ''}
                                />
                                {description && <p className="text-xs text-muted-foreground">{description}</p>}
                                {error && <p className="text-xs text-red-400">{error}</p>}
                            </div>
                        );
                    }

                    // Number input
                    if (type === 'number') {
                        return (
                            <div className={cn('space-y-2', fieldClassName)}>
                                <Label htmlFor={name}>{label}</Label>
                                <Input
                                    {...field}
                                    id={name}
                                    type="number"
                                    placeholder={placeholder}
                                    min={min}
                                    max={max}
                                    step={step}
                                    disabled={disabled || isLoading}
                                    className={error ? 'border-red-400' : ''}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                                {description && <p className="text-xs text-muted-foreground">{description}</p>}
                                {error && <p className="text-xs text-red-400">{error}</p>}
                            </div>
                        );
                    }

                    // Textarea
                    if (type === 'textarea') {
                        return (
                            <div className={cn('space-y-2', fieldClassName)}>
                                <Label htmlFor={name}>{label}</Label>
                                <Textarea
                                    {...field}
                                    id={name}
                                    placeholder={placeholder}
                                    rows={rows || 4}
                                    disabled={disabled || isLoading}
                                    className={error ? 'border-red-400' : ''}
                                />
                                {description && <p className="text-xs text-muted-foreground">{description}</p>}
                                {error && <p className="text-xs text-red-400">{error}</p>}
                            </div>
                        );
                    }

                    // Checkbox
                    if (type === 'checkbox') {
                        return (
                            <div className={cn('flex items-center space-x-2', fieldClassName)}>
                                <Checkbox
                                    id={name}
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={disabled || isLoading}
                                />
                                <div className="space-y-1">
                                    <Label htmlFor={name} className="cursor-pointer">
                                        {label}
                                    </Label>
                                    {description && <p className="text-xs text-muted-foreground">{description}</p>}
                                    {error && <p className="text-xs text-red-400">{error}</p>}
                                </div>
                            </div>
                        );
                    }

                    // Switch
                    if (type === 'switch') {
                        return (
                            <div className={cn('flex items-center justify-between space-x-2', fieldClassName)}>
                                <div className="space-y-1">
                                    <Label htmlFor={name}>{label}</Label>
                                    {description && <p className="text-xs text-muted-foreground">{description}</p>}
                                    {error && <p className="text-xs text-red-400">{error}</p>}
                                </div>
                                <Switch
                                    id={name}
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={disabled || isLoading}
                                />
                            </div>
                        );
                    }

                    // Select
                    if (type === 'select' && options) {
                        return (
                            <div className={cn('space-y-2', fieldClassName)}>
                                <Label htmlFor={name}>{label}</Label>
                                <Select
                                    value={String(field.value)}
                                    onValueChange={field.onChange}
                                    disabled={disabled || isLoading}
                                >
                                    <SelectTrigger className={error ? 'border-red-400' : ''}>
                                        <SelectValue placeholder={placeholder} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {options.map((option) => (
                                            <SelectItem key={option.value} value={String(option.value)}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {description && <p className="text-xs text-muted-foreground">{description}</p>}
                                {error && <p className="text-xs text-red-400">{error}</p>}
                            </div>
                        );
                    }

                    // Slider
                    if (type === 'slider') {
                        return (
                            <div className={cn('space-y-2', fieldClassName)}>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor={name}>{label}</Label>
                                    <span className="text-sm text-muted-foreground">{field.value}</span>
                                </div>
                                <Slider
                                    id={name}
                                    value={[field.value]}
                                    onValueChange={(values) => field.onChange(values[0])}
                                    min={min || 0}
                                    max={max || 100}
                                    step={step || 1}
                                    disabled={disabled || isLoading}
                                    className={error ? 'border-red-400' : ''}
                                />
                                {description && <p className="text-xs text-muted-foreground">{description}</p>}
                                {error && <p className="text-xs text-red-400">{error}</p>}
                            </div>
                        );
                    }

                    return <></>;
                }}
            />
        );
    };

    return (
        <div className={cn('space-y-6', className)}>
            <form onSubmit={handleFormSubmit} className={cn('space-y-4', formClassName)}>
                {fields.map((fieldConfig) => renderField(fieldConfig))}

                <div className="flex gap-2 pt-4">
                    {showCancelButton && onCancel && (
                        <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
                            {cancelLabel}
                        </Button>
                    )}
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {submitLabel}
                    </Button>
                </div>
            </form>
        </div>
    );
}
