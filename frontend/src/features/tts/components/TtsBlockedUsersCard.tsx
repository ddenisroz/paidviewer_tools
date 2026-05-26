import { ChevronDown, Plus, UserX, X } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

import type { BlockedUser } from '@/types';

type BlockedPlatform = 'twitch' | 'vk' | 'youtube';

interface TtsBlockedUsersCardProps {
    users: BlockedUser[];
    isLoading: boolean;
    isOpen: boolean;
    username: string;
    platform: BlockedPlatform;
    addingUser: boolean;
    onOpenChange: (open: boolean) => void;
    onUsernameChange: (value: string) => void;
    onPlatformChange: (platform: BlockedPlatform) => void;
    onAdd: () => void;
    onRemove: (user: BlockedUser) => void;
}

const platformLabel: Record<string, string> = {
    twitch: 'Twitch',
    vk: 'VK Live',
    youtube: 'YouTube',
};

export const TtsBlockedUsersCard = ({
    users,
    isLoading,
    isOpen,
    username,
    platform,
    addingUser,
    onOpenChange,
    onUsernameChange,
    onPlatformChange,
    onAdd,
    onRemove,
}: TtsBlockedUsersCardProps) => (
    <Card className="card-glass flex flex-col border-gray-800/60">
        <CardHeader className="border-b border-white/5 pb-2.5">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
                <div className="rounded-lg bg-rose-500/10 p-1.5 text-rose-400">
                    <UserX className="h-4 w-4" strokeWidth={1.8} />
                </div>
                Заблокированные пользователи
            </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3.5 p-3.5">
            <div className="grid grid-cols-[110px_minmax(0,1fr)_auto] gap-2 min-[1280px]:grid-cols-[130px_minmax(0,1fr)_auto]">
                <Select value={platform} onValueChange={(value) => onPlatformChange(value as BlockedPlatform)}>
                    <SelectTrigger className="h-9 rounded-lg">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="twitch">Twitch</SelectItem>
                        <SelectItem value="vk">VK Live</SelectItem>
                    </SelectContent>
                </Select>
                <Input
                    placeholder="Ник пользователя"
                    name="tts_blocked_user"
                    autoComplete="off"
                    value={username}
                    onChange={(event) => onUsernameChange(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && onAdd()}
                    disabled={addingUser}
                    className="h-9 border-gray-700/50 bg-gray-900/50 text-sm text-white placeholder-gray-500"
                />
                <Button
                    onClick={onAdd}
                    disabled={addingUser || !username.trim()}
                    size="sm"
                    className="h-9 bg-blue-700 px-4 text-xs font-bold text-white hover:bg-blue-800"
                >
                    {addingUser ? (
                        '...'
                    ) : (
                        <>
                            <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={1.8} />
                            Добавить
                        </>
                    )}
                </Button>
            </div>

            <button
                type="button"
                onClick={() => onOpenChange(!isOpen)}
                className="flex w-full items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-sky-400/35 hover:text-foreground"
            >
                <span>Список</span>
                <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    strokeWidth={1.8}
                />
            </button>

            <div
                className={`overflow-hidden transition-[max-height,opacity,margin] duration-200 ease-out ${
                    isOpen ? 'mt-2 max-h-80 opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                {isLoading ? (
                    <div className="flex w-full flex-col items-center justify-center py-6 text-gray-500">Загрузка...</div>
                ) : users.length === 0 ? (
                    <div className="h-1" />
                ) : (
                    <div className="grid max-h-[min(220px,34vh)] grid-cols-2 gap-2 overflow-y-auto pr-1 custom-scrollbar">
                        {users.map((user) => (
                            <div
                                key={`${user.platform}:${user.id || user.username}`}
                                className="group flex items-center justify-between rounded-lg border border-gray-700/50 bg-gray-800/40 px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-rose-500/10"
                            >
                                <div className="min-w-0">
                                    <div className="truncate font-medium">{user.username}</div>
                                    <div className="text-xs text-muted-foreground">{platformLabel[user.platform] || user.platform}</div>
                                </div>
                                <button
                                    onClick={() => onRemove(user)}
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 opacity-100 transition-colors hover:bg-red-500/10 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                                    aria-label={`Разблокировать ${user.username}`}
                                >
                                    <X className="h-4 w-4" strokeWidth={1.8} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </CardContent>
    </Card>
);
