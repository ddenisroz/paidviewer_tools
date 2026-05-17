import React from 'react';

import { Globe, Loader2, Upload, Users, X } from 'lucide-react';
import ReactDOM from 'react-dom';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

import type { OwnerType, VoiceManagementUser } from '@/features/admin/types/voiceManagement';

const MODAL_OVERLAY_CLASS = 'fixed inset-0 z-[9999] bg-black/75';
const MODAL_PANEL_CLASS =
    'pointer-events-auto flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-2xl shadow-black/35';
const DIALOG_FOOTER_CLASS =
    'flex flex-col gap-3 border-t border-border/70 bg-background/70 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end';
const DIALOG_ACTION_CLASS = 'h-10 w-full justify-center px-4 text-sm whitespace-nowrap sm:min-w-[148px] sm:flex-1';

interface VoiceUploadDialogProps {
    open: boolean;
    uploadFile: File | null;
    voiceName: string;
    ownerId: OwnerType;
    selectedUserId: string;
    users: VoiceManagementUser[];
    usersLoading: boolean;
    isUploading: boolean;
    isAdminVoiceAvailable: boolean;
    onClose: () => void;
    onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onVoiceNameChange: (value: string) => void;
    onOwnerChange: (value: OwnerType) => void;
    onUserChange: (value: string) => void;
    onUsersOpen: () => void;
    onUpload: () => void;
}

const VoiceUploadDialog: React.FC<VoiceUploadDialogProps> = ({
    open,
    uploadFile,
    voiceName,
    ownerId,
    selectedUserId,
    users,
    usersLoading,
    isUploading,
    isAdminVoiceAvailable,
    onClose,
    onFileChange,
    onVoiceNameChange,
    onOwnerChange,
    onUserChange,
    onUsersOpen,
    onUpload,
}) => {
    if (!open) return null;

    return ReactDOM.createPortal(
        <>
            <div className={MODAL_OVERLAY_CLASS} onClick={onClose} />
            <div className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center p-4">
                <div className={MODAL_PANEL_CLASS} onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-between border-b border-border/70 p-4">
                        <h2 className="text-xl font-semibold text-foreground">Загрузка нового голоса</h2>
                        <button
                            onClick={onClose}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto p-6">
                        <div>
                            <Label htmlFor="file">Аудиофайл</Label>
                            <Input
                                id="file"
                                name="file"
                                type="file"
                                accept=".wav,.mp3,.flac,.ogg,.m4a,.aac,.wma,.aiff,.au"
                                onChange={onFileChange}
                                className="mt-1 cursor-pointer text-xs file:mr-2 file:rounded-md file:border file:border-border/70 file:bg-muted/60 file:px-2 file:py-1 file:text-xs file:text-foreground hover:file:bg-accent/70"
                            />
                        </div>

                        <div>
                            <Label htmlFor="voiceName">Имя голоса</Label>
                            <Input
                                id="voiceName"
                                name="voiceName"
                                value={voiceName}
                                onChange={(event) => onVoiceNameChange(event.target.value)}
                                placeholder="Например, narrator_ru"
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="ownerType">Тип голоса</Label>
                            <Select value={ownerId} onValueChange={(value) => onOwnerChange(value as OwnerType)}>
                                <SelectTrigger id="ownerType" name="ownerType" className="mt-1">
                                    <SelectValue placeholder="Выберите тип голоса" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="global">
                                        <div className="flex items-center gap-2">
                                            <Globe className="h-4 w-4" />
                                            <span>Глобальный голос</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="user">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            <span>Пользовательский голос</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {ownerId === 'user' ? (
                            <div>
                                <Label htmlFor="selectedUserId">Пользователь</Label>
                                <Select
                                    value={selectedUserId}
                                    onValueChange={onUserChange}
                                    onOpenChange={(isOpen) => {
                                        if (isOpen && users.length === 0) onUsersOpen();
                                    }}
                                >
                                    <SelectTrigger id="selectedUserId" name="selectedUserId" className="mt-1">
                                        <SelectValue placeholder="Выберите пользователя" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {usersLoading ? (
                                            <div className="flex items-center justify-center p-4">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span className="ml-2">Загрузка...</span>
                                            </div>
                                        ) : users.length === 0 ? (
                                            <div className="p-4 text-center text-sm text-muted-foreground">
                                                Пользователи не найдены
                                            </div>
                                        ) : (
                                            users.map((user) => (
                                                <SelectItem key={user.id} value={user.id.toString()}>
                                                    {user.username || `User_${user.id}`}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : null}
                    </div>

                    <div className={DIALOG_FOOTER_CLASS}>
                        <Button
                            onClick={onClose}
                            variant="outline"
                            className={`${DIALOG_ACTION_CLASS} border-border/70 bg-background/60 text-foreground hover:bg-accent/70`}
                        >
                            Отмена
                        </Button>
                        <Button
                            onClick={onUpload}
                            disabled={
                                !isAdminVoiceAvailable ||
                                isUploading ||
                                !uploadFile ||
                                !voiceName.trim() ||
                                (ownerId === 'user' && !selectedUserId)
                            }
                            className={`${DIALOG_ACTION_CLASS} bg-primary text-primary-foreground hover:bg-primary/90`}
                        >
                            {isUploading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Загрузка...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Upload className="h-4 w-4" />
                                    Загрузить
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
};

export default VoiceUploadDialog;
