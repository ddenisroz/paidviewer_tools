import { z, ZodError, ZodType } from 'zod';

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

// Channel Points / Rewards validation schemas
export const rewardSchema = z.object({
    title: z.string().min(1, 'Название обязательно').max(45, 'Максимум 45 символов').trim(),
    description: z.string().max(200, 'Максимум 200 символов').optional().default(''),
    cost: z.coerce
        .number()
        .int('Должно быть целое число')
        .min(1, 'Минимум 1 балл')
        .max(1000000000, 'Слишком большое значение'),
    repair_timeout: z.coerce
        .number()
        .int('Должно быть целое число')
        .min(0, 'Не может быть отрицательным')
        .max(86400, 'Максимум 24 часа (86400 секунд)')
        .optional()
        .default(0),
    max_uses_count: z.coerce
        .number()
        .int('Должно быть целое число')
        .min(0, 'Не может быть отрицательным')
        .optional()
        .default(0),
    max_uses_count_per_user: z.coerce
        .number()
        .int('Должно быть целое число')
        .min(0, 'Не может быть отрицательным')
        .optional()
        .default(0),
    is_message_required: z.boolean().optional().default(false),
    global_cooldown_seconds: z.coerce
        .number()
        .int('Должно быть целое число')
        .min(0, 'Не может быть отрицательным')
        .max(86400, 'Максимум 24 часа (86400 секунд)')
        .optional()
        .default(0),
    max_per_stream: z.coerce
        .number()
        .int('Должно быть целое число')
        .min(0, 'Не может быть отрицательным')
        .optional()
        .default(0),
    max_per_user_per_stream: z.coerce
        .number()
        .int('Должно быть целое число')
        .min(0, 'Не может быть отрицательным')
        .optional()
        .default(0),
    should_redemptions_skip_request_queue: z.boolean().optional().default(false),
});

// Voice upload validation
export const voiceUploadSchema = z.object({
    voice_name: z
        .string()
        .min(1, 'Название голоса обязательно')
        .max(50, 'Максимум 50 символов')
        .regex(/^[a-zA-Zа-яА-ЯёЁ0-9\s_-]+$/, 'Только буквы, цифры, пробелы, дефисы и подчеркивания')
        .trim(),
    reference_text: z.string().max(500, 'Максимум 500 символов').optional().default(''),
});

// Command validation
export const commandSchema = z.object({
    command_name: z
        .string()
        .min(1, 'Название команды обязательно')
        .max(25, 'Максимум 25 символов')
        .regex(/^[a-zA-Z0-9_]+$/, 'Только латинские буквы, цифры и подчеркивания')
        .trim(),
    response_text: z.string().min(1, 'Ответ команды обязателен').max(500, 'Максимум 500 символов').trim(),
    cooldown_seconds: z.coerce
        .number()
        .int('Должно быть целое число')
        .min(0, 'Не может быть отрицательным')
        .max(3600, 'Максимум 1 час (3600 секунд)')
        .optional()
        .default(0),
    is_enabled: z.boolean().optional().default(true),
});

// Stream title validation
export const streamTitleSchema = z.object({
    title: z
        .string()
        .min(1, 'Название стрима обязательно')
        .max(140, 'Максимум 140 символов')
        .regex(/^[^<>]*$/, 'Недопустимые символы: < >')
        .trim(),
    platform: z.enum(['twitch', 'vk', 'both']).optional().default('both'),
});

// Stream category validation
export const streamCategorySchema = z.object({
    category_id: z.string().min(1, 'Выберите категорию').max(100, 'ID категории слишком длинный'),
    category_name: z.string().max(200, 'Название категории слишком длинное').optional(),
    platform: z.enum(['twitch', 'vk']),
});

// TTS Settings validation
export const ttsSettingsSchema = z.object({
    enabled: z.boolean(),
    volume: z.number().min(0, 'Минимум 0').max(100, 'Максимум 100').optional(),
    speed: z.number().min(0.5, 'Минимум 0.5').max(2.0, 'Максимум 2.0').optional(),
    voice_id: z.number().int().positive().optional(),
    max_message_length: z
        .number()
        .int('Должно быть целое число')
        .min(50, 'Минимум 50 символов')
        .max(250, 'Максимум 250 символов')
        .optional(),
    min_donation_amount: z.number().min(0, 'Не может быть отрицательным').optional(),
});

// TTS Platform Settings validation
export const ttsPlatformSettingsSchema = z.object({
    enabled: z.boolean(),
    volume: z.number().min(0, 'Минимум 0').max(100, 'Максимум 100').optional(),
    voice_id: z.number().int().positive().optional(),
    filter_enabled: z.boolean().optional(),
    min_donation: z.number().min(0, 'Не может быть отрицательным').optional(),
});

// TTS Audio Settings validation
export const ttsAudioSettingsSchema = z.object({
    website_volume: z.number().int('Должно быть целое число').min(0, 'Минимум 0').max(100, 'Максимум 100'),
    obs_volume: z.number().int('Должно быть целое число').min(0, 'Минимум 0').max(100, 'Максимум 100'),
    speed: z.number().min(0.5, 'Минимум 0.5').max(2.0, 'Максимум 2.0').optional(),
});

// Drops Config validation
export const dropsConfigSchema = z.object({
    enabled: z.boolean(),
    channel_name: z
        .string()
        .min(1, 'Имя канала обязательно')
        .max(50, 'Максимум 50 символов')
        .regex(/^[a-zA-Z0-9_]+$/, 'Только латинские буквы, цифры и подчеркивания')
        .trim(),
    platform: z.enum(['twitch', 'vk']).optional(),
    probabilities: z
        .object({
            common: z.number().min(0, 'Минимум 0').max(100, 'Максимум 100'),
            rare: z.number().min(0, 'Минимум 0').max(100, 'Максимум 100'),
            epic: z.number().min(0, 'Минимум 0').max(100, 'Максимум 100'),
            legendary: z.number().min(0, 'Минимум 0').max(100, 'Максимум 100'),
            mythical: z.number().min(0, 'Минимум 0').max(100, 'Максимум 100').optional(),
        })
        .refine(
            (data) => {
                const total = data.common + data.rare + data.epic + data.legendary + (data.mythical || 0);
                return Math.abs(total - 100) < 0.01; // Allow for floating point errors
            },
            {
                message: 'Сумма вероятностей должна быть равна 100%',
            }
        ),
    rewards: z
        .object({
            common: z.array(z.string()).min(1, 'Минимум 1 награда'),
            rare: z.array(z.string()).min(1, 'Минимум 1 награда'),
            epic: z.array(z.string()).min(1, 'Минимум 1 награда'),
            legendary: z.array(z.string()).min(1, 'Минимум 1 награда'),
            mythical: z.array(z.string()).optional(),
        })
        .optional(),
    cooldown_seconds: z
        .number()
        .int('Должно быть целое число')
        .min(0, 'Не может быть отрицательным')
        .max(86400, 'Максимум 24 часа')
        .optional(),
});

// YouTube Settings validation
export const youtubeSettingsSchema = z.object({
    enabled: z.boolean(),
    api_key: z.string().min(1, 'API ключ обязателен').max(200, 'API ключ слишком длинный').optional(),
    max_queue_size: z.number().int('Должно быть целое число').min(1, 'Минимум 1').max(100, 'Максимум 100').optional(),
    max_video_duration: z
        .number()
        .int('Должно быть целое число')
        .min(60, 'Минимум 60 секунд')
        .max(3600, 'Максимум 1 час')
        .optional(),
    auto_play: z.boolean().optional(),
    volume: z.number().min(0, 'Минимум 0').max(100, 'Максимум 100').optional(),
});

// User Settings validation
export const userSettingsSchema = z.object({
    display_name: z
        .string()
        .max(50, 'Максимум 50 символов')
        .regex(/^[a-zA-Zа-яА-ЯёЁ0-9\s_-]*$/, 'Недопустимые символы')
        .optional(),
    email: emailSchema.optional(),
    notifications_enabled: z.boolean().optional(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    language: z.enum(['ru', 'en']).optional(),
});

// Filtered Word validation
export const filteredWordSchema = z.object({
    word: z.string().min(1, 'Слово обязательно').max(100, 'Максимум 100 символов').trim(),
    is_regex: z.boolean().optional().default(false),
    replacement: z.string().max(100, 'Максимум 100 символов').optional(),
});

// Blocked User validation
export const blockedUserSchema = z.object({
    username: z
        .string()
        .min(1, 'Имя пользователя обязательно')
        .max(50, 'Максимум 50 символов')
        .regex(/^[a-zA-Z0-9_]+$/, 'Только латинские буквы, цифры и подчеркивания')
        .trim(),
    platform: z.enum(['twitch', 'vk']),
    reason: z.string().max(200, 'Максимум 200 символов').optional(),
    permanent: z.boolean().optional().default(true),
    expires_at: z.string().datetime().optional(),
});

export const validateWithSchema = (
    schema: ZodType,
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
    schema: ZodType<T>,
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
