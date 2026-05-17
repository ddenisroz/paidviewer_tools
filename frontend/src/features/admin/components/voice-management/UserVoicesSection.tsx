import React from 'react';

import { User as UserIcon, Users } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

import { EmptyVoices, VoiceCard } from './VoiceCollectionsParts';

import type { VoiceManagementUser } from '@/features/admin/types/voiceManagement';
import type { TtsVoice } from '@/types/tts';

interface UserVoicesSectionProps {
    users: VoiceManagementUser[];
    selectedUserFilter: string;
    totalUserVoices: number;
    userVoices: TtsVoice[];
    isAdminVoiceAvailable: boolean;
    onUserFilterChange: (value: string) => void;
    onEdit: (voice: TtsVoice) => void;
    onDelete: (voiceId: number) => void;
}

const UserVoicesSection: React.FC<UserVoicesSectionProps> = ({
    users,
    selectedUserFilter,
    totalUserVoices,
    userVoices,
    isAdminVoiceAvailable,
    onUserFilterChange,
    onEdit,
    onDelete,
}) => (
    <div>
        <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Users className="h-5 w-5 text-emerald-300" />
                Пользовательские голоса
                <Badge variant="outline" className="ml-2 border-emerald-500/40 text-emerald-200">
                    {totalUserVoices}
                </Badge>
            </h3>

            {users.length > 0 ? (
                <div>
                    <Label htmlFor="userVoiceFilter" className="sr-only">
                        Фильтр по пользователю
                    </Label>
                    <Select value={selectedUserFilter} onValueChange={onUserFilterChange}>
                        <SelectTrigger id="userVoiceFilter" className="w-52 bg-background/70">
                            <SelectValue placeholder="Все пользователи" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Все пользователи</SelectItem>
                            {users.map((user) => (
                                <SelectItem key={user.id} value={user.id.toString()}>
                                    {user.username || `User_${user.id}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            ) : null}
        </div>

        {userVoices.length === 0 ? (
            <EmptyVoices
                icon={Users}
                text={
                    selectedUserFilter !== 'all'
                        ? 'У выбранного пользователя нет голосов'
                        : 'Пользовательских голосов пока нет'
                }
            />
        ) : (
            <div className="flex flex-wrap gap-4">
                {userVoices.map((voice) => {
                    const owner = users.find((user) => user.id === voice.owner_id);
                    const description = owner ? (
                        <span className="flex min-w-0 items-center gap-1 break-words">
                            <UserIcon className="h-3 w-3" />
                            {owner.username || `User_${owner.id}`}
                        </span>
                    ) : (
                        <span>Owner ID: {voice.owner_id}</span>
                    );

                    return (
                        <VoiceCard
                            key={voice.id}
                            voice={voice}
                            accent="hover:border-emerald-500/35"
                            badge="user"
                            description={description}
                            onEdit={() => onEdit(voice)}
                            onDelete={() => onDelete(voice.id)}
                            isAdminVoiceAvailable={isAdminVoiceAvailable}
                        />
                    );
                })}
            </div>
        )}
    </div>
);

export default UserVoicesSection;
