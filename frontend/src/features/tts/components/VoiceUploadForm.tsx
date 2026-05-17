import React, { useState } from 'react';

import { z } from 'zod';

import { FormBuilder } from '@/shared/components';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { voiceUploadSchema } from '@/utils/validationSchemas';

type VoiceUploadFormData = z.infer<typeof voiceUploadSchema>;

interface VoiceUploadFormProps {
    onSubmit: (data: { voice_name: string; reference_text?: string; file: File }) => Promise<void>;
    file: File | null;
    onFileChange: (file: File | null) => void;
    isSubmitting?: boolean;
}

export const VoiceUploadForm: React.FC<VoiceUploadFormProps> = ({
    onSubmit,
    file,
    onFileChange,
    isSubmitting = false,
}) => {
    const [fileError, setFileError] = useState<string>('');

    const handleSubmit = async (data: VoiceUploadFormData) => {
        if (!file) {
            setFileError('Выберите аудио файл');
            return;
        }

        setFileError('');
        await onSubmit({
            voice_name: data.voice_name || data.name || '',
            reference_text: data.reference_text,
            file,
        });
    };

    return (
        <div className="space-y-4">
            <FormBuilder
                schema={voiceUploadSchema}
                fields={[
                    {
                        name: 'voice_name',
                        label: 'Название голоса',
                        type: 'text',
                        placeholder: 'Например: Мой голос',
                        description: 'Используйте понятное название для идентификации голоса',
                    },
                    {
                        name: 'reference_text',
                        label: 'Референсный текст (опционально)',
                        type: 'textarea',
                        placeholder: 'Текст, который произносится в аудио файле',
                        rows: 3,
                        description: 'Помогает улучшить качество синтеза для этого голоса',
                    },
                ]}
                defaultValues={{
                    voice_name: '',
                    reference_text: '',
                }}
                onSubmit={handleSubmit}
                submitLabel="Загрузить голос"
                loading={isSubmitting}
                formClassName="space-y-4"
            />

            {/* File upload field - outside FormBuilder */}
            <div className="space-y-2 -mt-4">
                <Label>Аудио файл</Label>
                <Input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                        onFileChange(e.target.files?.[0] || null);
                        setFileError('');
                    }}
                />
                {file && (
                    <p className="text-sm text-muted-foreground">
                        Выбран: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                )}
                {fileError && <p className="text-sm font-medium text-destructive">{fileError}</p>}
            </div>
        </div>
    );
};
