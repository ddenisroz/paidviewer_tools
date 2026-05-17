// src/utils/validationSchemas.ts
/**
 * Validation schemas and utilities for forms.
 */

import { z } from 'zod';

// Username validation
export const usernameSchema = z
    .string()
    .min(3, 'Минимум 3 символа')
    .max(25, 'Максимум 25 символов')
    .regex(/^[a-zA-Z0-9_]+$/, 'Только буквы, цифры и подчеркивание');

// Command name validation
export const commandNameSchema = z
    .string()
    .min(1, 'Имя команды обязательно')
    .max(50, 'Максимум 50 символов')
    .regex(/^[a-zA-Z0-9_]+$/, 'Только буквы, цифры и подчеркивание');

// Command response validation
export const commandResponseSchema = z.string().min(1, 'Ответ команды обязателен').max(500, 'Максимум 500 символов');

// Reward title validation
export const rewardTitleSchema = z.string().min(1, 'Название награды обязательно').max(45, 'Максимум 45 символов');

// Reward cost validation
export const rewardCostSchema = z.number().int('Должно быть целым числом').min(1, 'Минимум 1').max(10000000, 'Максимум 10,000,000');

// URL validation
export const urlSchema = z.string().url('Неверный формат URL').optional().or(z.literal(''));

// Color validation (hex)
export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Формат: #RRGGBB');

// Command form schema
export const commandFormSchema = z.object({
    command_name: commandNameSchema,
    response_text: commandResponseSchema,
    cooldown_seconds: z.number().int().min(0).max(86400).default(0),
    userLevel: z.enum(['viewer', 'subscriber', 'vip', 'moderator', 'broadcaster']).default('viewer'),
    is_enabled: z.boolean().default(true),
});

// Reward form schema - includes fields for both Twitch and VK
export const rewardFormSchema = z.object({
    title: rewardTitleSchema,
    description: z.string().max(200).optional(),
    cost: rewardCostSchema,
    // VK-specific fields
    repair_timeout: z.number().int().min(0).default(0),
    max_uses_count: z.number().int().min(0).default(0),
    max_uses_count_per_user: z.number().int().min(0).default(0),
    is_message_required: z.boolean().default(false),
    // Twitch-specific fields
    global_cooldown_seconds: z.number().int().min(0).max(86400).default(0),
    max_per_stream: z.number().int().min(0).max(100).default(0),
    max_per_user_per_stream: z.number().int().min(0).max(100).default(0),
    should_redemptions_skip_request_queue: z.boolean().default(false),
    // Legacy fields for backwards compatibility
    prompt: z.string().max(200).optional(),
    backgroundColor: hexColorSchema.optional(),
    isEnabled: z.boolean().default(true),
    isPaused: z.boolean().default(false),
    maxPerStream: z.number().int().min(0).max(100).optional(),
    maxPerUserPerStream: z.number().int().min(0).max(100).optional(),
    globalCooldown: z.number().int().min(0).max(86400).optional(),
});

export type CommandFormData = z.infer<typeof commandFormSchema>;
export type RewardFormData = z.infer<typeof rewardFormSchema>;

// Backwards compatibility aliases
export const commandSchema = commandFormSchema;
export const rewardSchema = rewardFormSchema;

// Voice upload schema - supports both form and API field names
export const voiceUploadSchema = z.object({
    name: z.string().min(1, 'Название обязательно').max(50, 'Максимум 50 символов'),
    voice_name: z.string().optional(), // API field name
    reference_text: z.string().max(500).optional(),
    file: z.any().optional(), // File validation is handled separately
    description: z.string().max(200).optional(),
    isDefault: z.boolean().default(false),
});

export type VoiceUploadFormData = z.infer<typeof voiceUploadSchema>;
