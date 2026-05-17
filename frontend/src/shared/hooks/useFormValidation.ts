import { zodResolver } from '@hookform/resolvers/zod';
import { FieldValues, useForm, UseFormProps, UseFormReturn } from 'react-hook-form';
import { ZodSchema } from 'zod';

interface UseFormValidationProps<T extends FieldValues> extends Omit<UseFormProps<T>, 'resolver'> {
    schema: ZodSchema<T>;
    mode?: 'onChange' | 'onBlur' | 'onSubmit' | 'onTouched' | 'all';
}

/**
 * Custom hook for form validation with zod schemas
 * Provides real-time validation with inline error messages
 *
 * @param schema - Zod validation schema
 * @param mode - Validation mode (default: 'onChange' for real-time validation)
 * @param defaultValues - Default form values
 * @returns React Hook Form methods with zod validation
 *
 * @example
 * const form = useFormValidation({
 *   schema: rewardSchema,
 *   mode: 'onChange',
 *   defaultValues: { title: '', cost: 100 }
 * });
 */
export function useFormValidation<T extends FieldValues>({
    schema,
    mode = 'onChange',
    ...props
}: UseFormValidationProps<T>): UseFormReturn<T, unknown, T> {
    // @ts-expect-error - Zod resolver and generic type incompatibility
    return useForm<T>({
        // @ts-expect-error - Zod resolver type incompatibility with react-hook-form
        resolver: zodResolver(schema),
        mode,
        ...props,
    });
}
