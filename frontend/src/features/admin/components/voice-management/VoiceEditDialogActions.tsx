import React from 'react';

import { Edit, Loader2, Settings, TestTube2, Volume2 } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

const DIALOG_ACTION_CLASS = 'h-10 w-full justify-center px-4 text-sm whitespace-nowrap sm:min-w-[148px] sm:flex-1';

interface VoiceEditDialogActionsProps {
    isAdminVoiceAvailable: boolean;
    isTestingVoice: boolean;
    isPlaying: boolean;
    onTest: () => void;
    onRename: () => void;
    onSave: () => void;
}

const VoiceEditDialogActions: React.FC<VoiceEditDialogActionsProps> = ({
    isAdminVoiceAvailable,
    isTestingVoice,
    isPlaying,
    onTest,
    onRename,
    onSave,
}) => (
    <>
        <Button
            onClick={onTest}
            variant="outline"
            disabled={!isAdminVoiceAvailable || isTestingVoice}
            className={`${DIALOG_ACTION_CLASS} border-border/70 bg-background/60 text-foreground hover:bg-accent/70`}
        >
            {isTestingVoice ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Проверяю...</span>
                </>
            ) : isPlaying ? (
                <>
                    <Volume2 className="mr-2 h-4 w-4" />
                    <span>Воспроизведение</span>
                </>
            ) : (
                <>
                    <TestTube2 className="mr-2 h-4 w-4" />
                    <span>Предпрослушать</span>
                </>
            )}
        </Button>

        <Button
            onClick={onRename}
            variant="outline"
            disabled={!isAdminVoiceAvailable}
            className={`${DIALOG_ACTION_CLASS} border-amber-500/50 text-amber-200 hover:bg-amber-500/15 hover:text-amber-100`}
        >
            <Edit className="mr-2 h-4 w-4" />
            <span>Переименовать</span>
        </Button>

        <Button
            onClick={onSave}
            disabled={!isAdminVoiceAvailable}
            className={`${DIALOG_ACTION_CLASS} bg-primary text-primary-foreground hover:bg-primary/90`}
        >
            <Settings className="mr-2 h-4 w-4" />
            <span>Сохранить</span>
        </Button>
    </>
);

export default VoiceEditDialogActions;
