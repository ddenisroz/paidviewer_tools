import { useForm, UseFormProps, UseFormReturn, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
}: UseFormValidationProps<T>): UseFormReturn<T> {
  return useForm<T>({
    resolver: zodResolver(schema),
    mode,
    ...props,
  });
}
