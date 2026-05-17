import React from 'react';

import ReactDOM from 'react-dom';

import { Button } from '@/shared/components/ui/button';

import type { TtsVoice } from '@/types/tts';

const MODAL_OVERLAY_CLASS = 'fixed inset-0 z-[9999] bg-black/75';
const MODAL_PANEL_CLASS =
    'pointer-events-auto flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-2xl shadow-black/35';
const DIALOG_FOOTER_CLASS =
    'flex flex-col gap-3 border-t border-border/70 bg-background/70 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end';
const DIALOG_ACTION_CLASS = 'h-10 w-full justify-center px-4 text-sm whitespace-nowrap sm:min-w-[148px] sm:flex-1';

interface VoiceDeleteDialogProps {
    voice: TtsVoice | null;
    isDeleting: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const VoiceDeleteDialog: React.FC<VoiceDeleteDialogProps> = ({ voice, isDeleting, onClose, onConfirm }) => {
    if (!voice) return null;

    return ReactDOM.createPortal(
        <>
            <div className={MODAL_OVERLAY_CLASS} onClick={onClose} />
            <div className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center p-4">
                <div className={MODAL_PANEL_CLASS} onClick={(event) => event.stopPropagation()}>
                    <div className="border-b border-border/70 p-4">
                        <h2 className="text-xl font-semibold text-foreground">Удалить голос</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Голос "{voice.name}" будет удалён без возможности восстановления.
                        </p>
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
                            onClick={onConfirm}
                            variant="destructive"
                            disabled={isDeleting}
                            className={DIALOG_ACTION_CLASS}
                        >
                            {isDeleting ? 'Удаляю...' : 'Удалить голос'}
                        </Button>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
};

export default VoiceDeleteDialog;
