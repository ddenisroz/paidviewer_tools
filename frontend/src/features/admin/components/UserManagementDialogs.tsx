import React from 'react';

import { Button } from '@/shared/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

interface WhitelistDialogProps {
    open: boolean;
    twitchChannel: string;
    vkChannel: string;
    onOpenChange: (open: boolean) => void;
    onTwitchChange: (value: string) => void;
    onVkChange: (value: string) => void;
    onSubmit: () => void;
}

const ACTION_BUTTON_CLASS = 'h-9 border-border/70 shadow-none hover:bg-muted/60';

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
                    <Input
                        id="twitch_channel"
                        value={twitchChannel}
                        onChange={(e) => onTwitchChange(e.target.value)}
                        placeholder="Название Twitch канала"
                        className="mt-1"
                    />
                </div>
                <div>
                    <Label htmlFor="vk_channel">VK Live канал</Label>
                    <Input
                        id="vk_channel"
                        value={vkChannel}
                        onChange={(e) => onVkChange(e.target.value)}
                        placeholder="Название VK Live канала"
                        className="mt-1"
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" className={ACTION_BUTTON_CLASS} onClick={() => onOpenChange(false)}>
                    Отмена
                </Button>
                <Button className="h-9" onClick={onSubmit}>
                    Добавить
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);
