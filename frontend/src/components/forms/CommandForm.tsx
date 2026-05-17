import React from 'react';

import { z } from 'zod';

import { FormBuilder } from '@/shared/components';
import { commandSchema } from '@/utils/validationSchemas';

type CommandFormData = z.infer<typeof commandSchema>;

interface CommandFormProps {
    onSubmit: (data: CommandFormData) => Promise<void>;
    defaultValues?: Partial<CommandFormData>;
    isSubmitting?: boolean;
    isEdit?: boolean;
}

export const CommandForm: React.FC<CommandFormProps> = ({
    onSubmit,
    defaultValues,
    isSubmitting = false,
    isEdit = false,
}) => {
    return (
        <FormBuilder
            schema={commandSchema}
            fields={[
                {
                    name: 'command_name',
                    label: 'Название команды',
                    type: 'text',
                    placeholder: 'discord',
                    description: 'Без символа !. Например: discord, telegram, vk',
                },
                {
                    name: 'response_text',
                    label: 'Ответ команды',
                    type: 'textarea',
                    placeholder: 'Подписывайтесь на мой Discord: https://discord.gg/...',
                    rows: 3,
                    description: 'Текст, который бот отправит в чат при использовании команды',
                },
                {
                    name: 'cooldown_seconds',
                    label: 'Кулдаун (секунды)',
                    type: 'number',
                    placeholder: '0 = без кулдауна',
                    min: 0,
                    description: 'Минимальное время между использованиями команды (0 = без ограничений)',
                },
                {
                    name: 'is_enabled',
                    label: 'Команда активна',
                    type: 'checkbox',
                },
            ]}
            defaultValues={{
                command_name: defaultValues?.command_name || '',
                response_text: defaultValues?.response_text || '',
                cooldown_seconds: defaultValues?.cooldown_seconds || 0,
                is_enabled: defaultValues?.is_enabled ?? true,
            }}
            onSubmit={onSubmit}
            submitLabel={isEdit ? 'Сохранить изменения' : 'Создать команду'}
            loading={isSubmitting}
        />
    );
};
