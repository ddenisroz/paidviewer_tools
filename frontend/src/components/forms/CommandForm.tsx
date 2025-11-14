import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useFormValidation } from '@/hooks/useFormValidation';
import { commandSchema } from '@/utils/validationSchemas';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface CommandFormProps {
  onSubmit: (data: {
    command_name: string;
    response_text: string;
    cooldown_seconds: number;
    is_enabled: boolean;
  }) => Promise<void>;
  defaultValues?: {
    command_name?: string;
    response_text?: string;
    cooldown_seconds?: number;
    is_enabled?: boolean;
  };
  isSubmitting?: boolean;
  isEdit?: boolean;
}

export const CommandForm: React.FC<CommandFormProps> = ({
  onSubmit,
  defaultValues,
  isSubmitting = false,
  isEdit = false,
}) => {
  const form = useFormValidation({
    schema: commandSchema,
    mode: 'onChange',
    defaultValues: {
      command_name: defaultValues?.command_name || '',
      response_text: defaultValues?.response_text || '',
      cooldown_seconds: defaultValues?.cooldown_seconds || 0,
      is_enabled: defaultValues?.is_enabled ?? true,
    },
  });

  // Update form when defaultValues change
  useEffect(() => {
    if (defaultValues) {
      form.reset({
        command_name: defaultValues.command_name || '',
        response_text: defaultValues.response_text || '',
        cooldown_seconds: defaultValues.cooldown_seconds || 0,
        is_enabled: defaultValues.is_enabled ?? true,
      });
    }
  }, [defaultValues, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="command_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название команды</FormLabel>
              <FormControl>
                <Input
                  placeholder="discord"
                  disabled={isEdit}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Без символа !. Например: discord, telegram, vk
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="response_text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ответ команды</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Подписывайтесь на мой Discord: https://discord.gg/..."
                  rows={3}
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Текст, который бот отправит в чат при использовании команды
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cooldown_seconds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Кулдаун (секунды)</FormLabel>
              <FormControl>
                <Input type="number" min="0" placeholder="0 = без кулдауна" {...field} />
              </FormControl>
              <FormDescription>
                Минимальное время между использованиями команды (0 = без ограничений)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_enabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2 space-y-0">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="w-4 h-4 rounded border-gray-300"
                />
              </FormControl>
              <FormLabel className="cursor-pointer">
                Команда активна
              </FormLabel>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'Сохранить изменения' : 'Создать команду'}
        </Button>
      </form>
    </Form>
  );
};
