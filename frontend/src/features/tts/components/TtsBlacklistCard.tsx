import { ChevronDown, Plus, UserMinus, X } from 'lucide-react';

import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

import type { BlockedUser } from './ttsFilterTypes';
import type { RefObject } from 'react';

interface TtsBlacklistCardProps {
    blacklist: BlockedUser[];
    isLoading: boolean;
    isOpen: boolean;
    pendingUnblockKey: string | null;
    newUsername: string;
    selectedPlatform: string;
    availablePlatforms: string[];
    addingUser: boolean;
    formRef: RefObject<HTMLDivElement | null>;
    onOpenChange: (open: boolean) => void;
    onPendingUnblockKeyChange: (key: string | null) => void;
    onUsernameChange: (value: string) => void;
    onPlatformChange: (value: string) => void;
    onAdd: () => void;
    onRemove: (blockedUser: BlockedUser) => void;
}

const PlatformMark = ({ platform }: { platform: string }) => (
    <div
        className={`flex h-5 w-5 items-center justify-center rounded-full ${
            platform === 'twitch' ? 'bg-purple-500/10' : 'bg-rose-500/10'
        }`}
    >
        {platform === 'twitch' ? (
            <TwitchIcon className="h-3 w-3 text-purple-400" />
        ) : (
            <VKIcon className="h-3 w-3 text-[#FF4444]" />
        )}
    </div>
);

const PlatformOption = ({ platform }: { platform: string }) => (
    <div className="flex items-center gap-1.5">
        <PlatformMark platform={platform} />
        <span className="text-xs">{platform === 'twitch' ? 'Twitch' : 'VK'}</span>
    </div>
);

export const TtsBlacklistCard = ({
    blacklist,
    isLoading,
    isOpen,
    pendingUnblockKey,
    newUsername,
    selectedPlatform,
    availablePlatforms,
    addingUser,
    formRef,
    onOpenChange,
    onPendingUnblockKeyChange,
    onUsernameChange,
    onPlatformChange,
    onAdd,
    onRemove,
}: TtsBlacklistCardProps) => (
    <Card className="card-glass flex flex-col border-gray-800/60">
        <CardHeader className="border-b border-white/5 pb-2.5">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
                <div className="rounded-lg bg-red-500/10 p-1.5 text-red-400">
                    <UserMinus className="h-4 w-4" strokeWidth={1.8} />
                </div>
                Черный список
            </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3.5 p-3.5">
            <div ref={formRef} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
                <Input
                    placeholder="Имя пользователя"
                    name="tts_manual_block_username"
                    autoComplete="off"
                    value={newUsername}
                    onChange={(event) => onUsernameChange(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && onAdd()}
                    onBlur={(event) => {
                        const nextTarget = event.relatedTarget as Node | null;
                        if (!nextTarget || !formRef.current?.contains(nextTarget)) onUsernameChange('');
                    }}
                    disabled={addingUser || availablePlatforms.length === 0}
                    className="h-9 border-gray-700/50 bg-gray-900/50 text-sm text-white placeholder-gray-500"
                />
                {availablePlatforms.length > 0 && (
                    <Select value={selectedPlatform} onValueChange={onPlatformChange}>
                        <SelectTrigger className="h-9 w-full border-gray-700/50 bg-gray-900/50 text-xs text-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-gray-700 bg-gray-800 text-white">
                            {availablePlatforms.map((platform) => (
                                <SelectItem key={platform} value={platform}>
                                    <PlatformOption platform={platform} />
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                <Button
                    onClick={onAdd}
                    disabled={addingUser || !newUsername.trim() || !selectedPlatform}
                    size="sm"
                    className="h-9 border-red-600 bg-red-600 px-4 text-xs font-bold text-white hover:border-red-500 hover:bg-red-500"
                >
                    {addingUser ? (
                        '...'
                    ) : (
                        <>
                            <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={1.8} />
                            Бан
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
                    <div className="flex flex-col items-center justify-center py-6 text-gray-500">Загрузка...</div>
                ) : blacklist.length === 0 ? (
                    <div className="h-1" />
                ) : (
                    <div className="grid max-h-[min(220px,34vh)] grid-cols-1 gap-2 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-2">
                        {blacklist.map((blockedUser, index) => {
                            const key = `${blockedUser.username}-${blockedUser.platform}`;
                            return (
                                <div
                                    key={`${key}-${index}`}
                                    className="group flex items-center justify-between rounded-lg border border-gray-800/70 bg-gray-800/40 px-3 py-2.5 transition-colors hover:bg-red-500/5"
                                >
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <PlatformMark platform={blockedUser.platform} />
                                        <span className="truncate text-sm font-medium text-gray-200">
                                            {blockedUser.username}
                                        </span>
                                    </div>
                                    {pendingUnblockKey === key ? (
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => onRemove(blockedUser)}
                                                className="rounded-md bg-red-500/15 px-2.5 py-1 text-[10px] font-medium text-red-300 hover:bg-red-500/25"
                                            >
                                                Да
                                            </button>
                                            <button
                                                onClick={() => onPendingUnblockKeyChange(null)}
                                                className="rounded-md bg-gray-700/70 px-2.5 py-1 text-[10px] font-medium text-gray-200 hover:bg-gray-600/70"
                                            >
                                                Нет
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => onPendingUnblockKeyChange(key)}
                                            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 opacity-100 transition-colors hover:bg-red-500/10 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                                            aria-label={`Удалить ${blockedUser.username} из черного списка`}
                                        >
                                            <X className="h-4 w-4" strokeWidth={1.8} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {availablePlatforms.length === 0 && (
                <div className="rounded-lg bg-gray-900/30 py-2 text-center text-xs text-gray-500">
                    Подключите платформу
                </div>
            )}
        </CardContent>
    </Card>
);
