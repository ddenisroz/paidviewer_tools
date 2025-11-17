import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useFormValidation } from '@/hooks/useFormValidation';
import { voiceUploadSchema } from '@/utils/validationSchemas';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

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
  const form = useFormValidation({
    schema: voiceUploadSchema,
    mode: 'onChange',
    defaultValues: {
      voice_name: '',
      reference_text: '',
    },
  });

  const handleSubmit = async (data: any) => {
    if (!file) {
      form.setError('root', { message: 'Выберите аудио файл' });
      return;
    }

    await onSubmit({
      voice_name: data.voice_name,
      reference_text: data.reference_text,
      file,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="voice_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название голоса</FormLabel>
              <FormControl>
                <Input placeholder="Например: Мой голос" {...field} />
              </FormControl>
              <FormDescription>
                Используйте понятное название для идентификации голоса
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <label className="text-sm font-medium">Аудио файл</label>
          <Input
            type="file"
            accept="audio/*"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          />
          {file && (
            <p className="text-sm text-muted-foreground">
              Выбран: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
          {!file && form.formState.errors.root && (
            <p className="text-sm font-medium text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
        </div>

        <FormField
          control={form.control}
          name="reference_text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Референсный текст (опционально)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Текст, который произносится в аудио файле"
                  rows={3}
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Помогает улучшить качество синтеза для этого голоса
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Загрузить голос
        </Button>
      </form>
    </Form>
  );
};
