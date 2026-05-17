import React from 'react';

import { Loader2, RefreshCw, X } from 'lucide-react';
import ReactDOM from 'react-dom';

import VoiceEditDialogActions from '@/features/admin/components/voice-management/VoiceEditDialogActions';
import VoiceEditGenerationSection from '@/features/admin/components/voice-management/VoiceEditGenerationSection';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';

import type { SpeedPreset, VoiceProvider } from '@/features/admin/types/voiceManagement';
import type { TtsVoice } from '@/types/tts';

const MODAL_OVERLAY_CLASS = 'fixed inset-0 z-[9999] bg-black/75';
const MODAL_PANEL_CLASS =
    'pointer-events-auto flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-2xl shadow-black/35';
const DIALOG_FOOTER_CLASS =
    'flex flex-col gap-3 border-t border-border/70 bg-background/70 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end';
interface VoiceEditDialogProps {
    open: boolean;
    currentVoice: TtsVoice | null;
    voiceProvider: VoiceProvider;
    testText: string;
    testCfgStrength: number;
    testSpeedPreset: SpeedPreset;
    isAdminVoiceAvailable: boolean;
    isTranscribing: boolean;
    isTestingVoice: boolean;
    isPlaying: boolean;
    onClose: () => void;
    onVoiceChange: (voice: TtsVoice | null) => void;
    onTestTextChange: (value: string) => void;
    onCfgStrengthChange: (value: number) => void;
    onSpeedPresetChange: (value: SpeedPreset) => void;
    onReferenceTextChange: (value: string) => void;
    onRetranscribe: () => void;
    onTest: () => void;
    onRename: () => void;
    onSave: () => void;
}

const VoiceEditDialog: React.FC<VoiceEditDialogProps> = ({
    open,
    currentVoice,
    voiceProvider,
    testText,
    testCfgStrength,
    testSpeedPreset,
    isAdminVoiceAvailable,
    isTranscribing,
    isTestingVoice,
    isPlaying,
    onClose,
    onVoiceChange,
    onTestTextChange,
    onCfgStrengthChange,
    onSpeedPresetChange,
    onReferenceTextChange,
    onRetranscribe,
    onTest,
    onRename,
    onSave,
}) => {
    if (!open || !currentVoice) return null;

    return ReactDOM.createPortal(
        <>
            <div className={MODAL_OVERLAY_CLASS} onClick={onClose} />
            <div className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center p-4">
                <div className={MODAL_PANEL_CLASS} onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-between border-b border-border/70 p-4">
                        <h2 className="text-xl font-semibold text-foreground">
                            Настройки голоса "{currentVoice.name}"
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="grid gap-6 py-4">
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="voice-name">Имя голоса</Label>
                                    <Input
                                        id="voice-name"
                                        name="voice_name"
                                        value={currentVoice.name || ''}
                                        onChange={(event) =>
                                            onVoiceChange({ ...currentVoice, name: event.target.value })
                                        }
                                        placeholder="Например, narrator_ru"
                                        className="mt-1 w-full"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="reference-text">Референсный текст</Label>
                                    <Textarea
                                        id="reference-text"
                                        name="reference_text"
                                        value={currentVoice.reference_text || ''}
                                        onChange={(event) => onReferenceTextChange(event.target.value)}
                                        placeholder="Текст, который соответствует загруженному голосовому сэмплу"
                                        className="mt-1 w-full"
                                        rows={3}
                                    />
                                    <div className="mt-2 w-full">
                                        <Button
                                            onClick={onRetranscribe}
                                            disabled={!isAdminVoiceAvailable || isTranscribing}
                                            variant="outline"
                                            size="sm"
                                            className="w-full justify-center whitespace-nowrap"
                                        >
                                            {isTranscribing ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    <span>Обновляю расшифровку...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw className="mr-2 h-4 w-4" />
                                                    <span>Пересчитать reference text из аудио</span>
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="test-text">Текст для предпрослушивания</Label>
                                <Textarea
                                    id="test-text"
                                    name="test_text"
                                    value={testText}
                                    onChange={(event) => onTestTextChange(event.target.value)}
                                    className="mt-1"
                                    rows={3}
                                    placeholder="Введите короткую фразу для проверки голоса"
                                />
                            </div>

                            <VoiceEditGenerationSection
                                voiceProvider={voiceProvider}
                                testCfgStrength={testCfgStrength}
                                testSpeedPreset={testSpeedPreset}
                                onCfgStrengthChange={onCfgStrengthChange}
                                onSpeedPresetChange={onSpeedPresetChange}
                            />
                        </div>
                    </div>

                    <div className={DIALOG_FOOTER_CLASS}>
                        <VoiceEditDialogActions
                            isAdminVoiceAvailable={isAdminVoiceAvailable}
                            isTestingVoice={isTestingVoice}
                            isPlaying={isPlaying}
                            onTest={onTest}
                            onRename={onRename}
                            onSave={onSave}
                        />
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
};

export default VoiceEditDialog;
