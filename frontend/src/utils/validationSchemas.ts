import { z, ZodError, ZodSchema } from 'zod';

// Common validation schemas
export const emailSchema = z.string().email('Введите корректный email');
export const urlSchema = z.string().url('Введите корректный URL');
export const usernameSchema = z
  .string()
  .min(3, 'Минимум 3 символа')
  .max(20, 'Максимум 20 символов')
  .regex(/^[a-zA-Z0-9_]+$/, 'Только буквы, цифры и подчеркивание');

export const passwordSchema = z
  .string()
  .min(8, 'Минимум 8 символов')
  .regex(/[A-Z]/, 'Должна быть хотя бы одна заглавная буква')
  .regex(/[a-z]/, 'Должна быть хотя бы одна строчная буква')
  .regex(/[0-9]/, 'Должна быть хотя бы одна цифра');

// Composite schemas
export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, 'Введите пароль'),
});

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

export const donationSettingsSchema = z.object({
  donation_enabled: z.boolean(),
  donation_amount_common: z.array(z.number()).min(1).max(1),
  donation_amount_rare: z.array(z.number()).min(1).max(1),
  donation_amount_epic: z.array(z.number()).min(1).max(1),
  donation_amount_legendary: z.array(z.number()).min(1).max(1),
  mythical_enabled: z.boolean().optional(),
  mythical_min_interval_hours: z.array(z.number()).min(1).max(1).optional(),
  mythical_max_interval_hours: z.array(z.number()).min(1).max(1).optional(),
  mythical_window_duration_minutes: z.array(z.number()).min(1).max(1).optional(),
  mythical_donation_amount: z.array(z.number()).min(1).max(1).optional(),
});

export const validateWithSchema = (
  schema: ZodSchema,
  data: unknown
): { success: true } | { success: false; errors: Record<string, string> } => {
  try {
    schema.parse(data);
    return { success: true };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: Record<string, string> = {};
      error.issues.forEach((err) => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return { success: false, errors };
    }
    return { success: false, errors: { _general: 'Ошибка валидации' } };
  }
};

export const safeParse = <T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors: Record<string, string> = {};
  result.error.issues.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return { success: false, errors };
};


