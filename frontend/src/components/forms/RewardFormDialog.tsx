import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFormValidation } from '@/hooks/useFormValidation';
import { rewardSchema } from '@/utils/validationSchemas';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import pointsApi from '@/services/pointsApi';
import { logger } from '@/utils/prodLogger';
import type { PlatformReward } from '@/types/points';

interface RewardFormDialogProps {
  open: boolean;
  onClose: () => void;
  reward: PlatformReward | null;
  platform: 'twitch' | 'vk';
  onSuccess: () => void;
}

export const RewardFormDialog: React.FC<RewardFormDialogProps> = ({
  open,
  onClose,
  reward,
  platform,
  onSuccess,
}) => {
  const [saving, setSaving] = React.useState(false);

  const form = useFormValidation({
    schema: rewardSchema,
    mode: 'onChange', // Real-time validation
    defaultValues: {
      title: '',
      description: '',
      cost: 100,
      repair_timeout: 0,
      max_uses_count: 0,
      max_uses_count_per_user: 0,
      is_message_required: false,
      global_cooldown_seconds: 0,
      max_per_stream: 0,
      max_per_user_per_stream: 0,
      should_redemptions_skip_request_queue: false,
    },
  });

  // Reset form when dialog opens/closes or reward changes
  useEffect(() => {
    if (open && reward) {
      form.reset({
        title: reward.title || reward.name || '',
        description: reward.description || reward.prompt || '',
        cost: reward.cost || reward.price || 100,
        repair_timeout: reward.repair_timeout || 0,
        max_uses_count: reward.max_uses_count || 0,
        max_uses_count_per_user: reward.max_uses_count_per_user || 0,
        is_message_required: reward.is_message_required || false,
        global_cooldown_seconds: reward.global_cooldown?.seconds || reward.global_cooldown_seconds || 0,
        max_per_stream: reward.max_per_stream || 0,
        max_per_user_per_stream: reward.max_per_user_per_stream || 0,
        should_redemptions_skip_request_queue: reward.should_redemptions_skip_request_queue || false,
      });
    } else if (open && !reward) {
      form.reset({
        title: '',
        description: '',
        cost: 100,
        repair_timeout: 0,
        max_uses_count: 0,
        max_uses_count_per_user: 0,
        is_message_required: false,
        global_cooldown_seconds: 0,
        max_per_stream: 0,
        max_per_user_per_stream: 0,
        should_redemptions_skip_request_queue: false,
      });
    }
  }, [open, reward, form]);

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      let rewardData: any = {
        title: data.title,
        description: data.description,
        cost: data.cost,
        is_user_input_required: data.is_message_required,
        platform: platform,
        channel_name: '',
      };

      if (platform === 'vk') {
        rewardData = {
          ...rewardData,
          repair_timeout: data.repair_timeout,
          max_uses_count: data.max_uses_count,
          max_uses_count_per_user: data.max_uses_count_per_user,
          is_message_required: data.is_message_required,
        };
      }

      if (platform === 'twitch') {
        rewardData = {
          ...rewardData,
          global_cooldown_seconds: data.global_cooldown_seconds,
          max_per_stream: data.max_per_stream,
          max_per_user_per_stream: data.max_per_user_per_stream,
          should_redemptions_skip_request_queue: data.should_redemptions_skip_request_queue,
          is_enabled: true,
        };
      }

      if (reward) {
        await pointsApi.updateReward(platform, String(reward.id), rewardData);
        toast.success('Награда обновлена');
      } else {
        await pointsApi.createReward(platform, rewardData);
        toast.success('Награда создана');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      logger.error('Error saving reward:', err);
      toast.error(err.message || 'Ошибка сохранения награды');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reward ? 'Редактировать награду' : 'Создать награду'}</DialogTitle>
          <DialogDescription>
            {reward ? 'Измените параметры награды' : 'Укажите параметры новой награды'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Например: Приветствие" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание (опционально)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Что получит зритель за эту награду?"
                      rows={2}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Стоимость</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <FormDescription>
                    {platform === 'twitch' ? 'Channel Points' : 'Баллы VK Live'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {platform === 'vk' && (
              <>
                <FormField
                  control={form.control}
                  name="repair_timeout"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Кулдаун (секунды)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="0 = без кулдауна" {...field} />
                      </FormControl>
                      <FormDescription>
                        Время восстановления награды (0 = без ограничений)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="max_uses_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Макс. использований</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="0 = без лимита" {...field} />
                        </FormControl>
                        <FormDescription>Всего (0 = ∞)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="max_uses_count_per_user"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Макс. на юзера</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="0 = без лимита" {...field} />
                        </FormControl>
                        <FormDescription>На 1 человека (0 = ∞)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="is_message_required"
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
                        Требовать сообщение от зрителя
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </>
            )}

            {platform === 'twitch' && (
              <>
                <FormField
                  control={form.control}
                  name="global_cooldown_seconds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Глобальный кулдаун (секунды)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="0 = без кулдауна" {...field} />
                      </FormControl>
                      <FormDescription>
                        Время между использованиями награды всеми зрителями
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="max_per_stream"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Макс. за стрим</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="0 = без лимита" {...field} />
                        </FormControl>
                        <FormDescription>Всего (0 = ∞)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="max_per_user_per_stream"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Макс. на юзера за стрим</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="0 = без лимита" {...field} />
                        </FormControl>
                        <FormDescription>На 1 человека (0 = ∞)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="should_redemptions_skip_request_queue"
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
                        Пропускать очередь модерации
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {reward ? 'Сохранить' : 'Создать'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
