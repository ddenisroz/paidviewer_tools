import React from 'react';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import type { User } from '@/types/user';

interface DeleteDialogProps {
  open: boolean;
  user: User | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}

interface WhitelistDialogProps {
  open: boolean;
  twitchChannel: string;
  vkChannel: string;
  onOpenChange: (open: boolean) => void;
  onTwitchChange: (value: string) => void;
  onVkChange: (value: string) => void;
  onSubmit: () => void;
}

const ACTION_BUTTON_CLASS = 'h-9 border-border/70 hover:bg-muted/60 shadow-none';

export const UserDeleteDialog: React.FC<DeleteDialogProps> = ({
  open,
  user,
  isPending,
  onOpenChange,
  onDelete,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Удаление пользователя</DialogTitle>
        <DialogDescription>Аккаунт будет удалён из системы без возможности отмены.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Пользователь: <span className="font-medium text-foreground">{user?.username || 'Не выбран'}</span></p>
      </div>
      <DialogFooter>
        <Button variant="outline" className={ACTION_BUTTON_CLASS} onClick={() => onOpenChange(false)}>Отмена</Button>
        <Button variant="destructive" className="h-9" onClick={onDelete} disabled={!user || isPending}>
          {isPending ? 'Удаление...' : 'Удалить пользователя'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const WhitelistChannelDialog: React.FC<WhitelistDialogProps> = ({
  open,
  twitchChannel,
  vkChannel,
  onOpenChange,
  onTwitchChange,
  onVkChange,
  onSubmit,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Добавить канал в whitelist</DialogTitle>
        <DialogDescription>Укажите Twitch и/или VK Live канал для добавления в whitelist.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor="twitch_channel">Twitch канал</Label>
          <Input id="twitch_channel" value={twitchChannel} onChange={e => onTwitchChange(e.target.value)} placeholder="Введите название Twitch канала..." className="mt-1" />
        </div>
        <div>
          <Label htmlFor="vk_channel">VK Live канал</Label>
          <Input id="vk_channel" value={vkChannel} onChange={e => onVkChange(e.target.value)} placeholder="Введите название VK Live канала..." className="mt-1" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" className={ACTION_BUTTON_CLASS} onClick={() => onOpenChange(false)}>Отмена</Button>
        <Button className="h-9" onClick={onSubmit}>Добавить</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
