import { ChevronDown, Plus, ShieldAlert, X } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';

import type { FilteredWord } from './ttsFilterTypes';
import type { RefObject } from 'react';

interface TtsForbiddenWordsCardProps {
    words: FilteredWord[];
    isLoading: boolean;
    isOpen: boolean;
    newWord: string;
    addingWord: boolean;
    formRef: RefObject<HTMLDivElement | null>;
    onOpenChange: (open: boolean) => void;
    onWordChange: (value: string) => void;
    onAdd: () => void;
    onRemove: (wordId: number) => void;
}

export const TtsForbiddenWordsCard = ({
    words,
    isLoading,
    isOpen,
    newWord,
    addingWord,
    formRef,
    onOpenChange,
    onWordChange,
    onAdd,
    onRemove,
}: TtsForbiddenWordsCardProps) => {
    const visibleWords = words.filter((word) => word && (word.word || word.text));

    return (
        <Card className="card-glass flex flex-col border-gray-800/60">
            <CardHeader className="border-b border-white/5 pb-2.5">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <div className="rounded-lg bg-indigo-500/10 p-1.5 text-indigo-400">
                        <ShieldAlert className="h-4 w-4" strokeWidth={1.8} />
                    </div>
                    Запрещенные слова
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3.5 p-3.5">
                <div ref={formRef} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Input
                        placeholder="Слово или фраза"
                        name="tts_manual_forbidden_word"
                        autoComplete="off"
                        value={newWord}
                        onChange={(event) => onWordChange(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && onAdd()}
                        onBlur={(event) => {
                            const nextTarget = event.relatedTarget as Node | null;
                            if (!nextTarget || !formRef.current?.contains(nextTarget)) onWordChange('');
                        }}
                        disabled={addingWord}
                        className="h-9 border-gray-700/50 bg-gray-900/50 text-sm text-white placeholder-gray-500"
                    />
                    <Button
                        onClick={onAdd}
                        disabled={addingWord || !newWord.trim()}
                        size="sm"
                        className="h-9 bg-blue-700 px-4 text-xs font-bold text-white hover:bg-blue-800"
                    >
                        {addingWord ? (
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
                        <div className="flex w-full flex-col items-center justify-center py-6 text-gray-500">
                            Загрузка...
                        </div>
                    ) : visibleWords.length === 0 ? (
                        <div className="h-1" />
                    ) : (
                        <div className="grid max-h-[min(220px,34vh)] grid-cols-2 gap-2 overflow-y-auto pr-1 custom-scrollbar">
                            {visibleWords.map((word) => (
                                <div
                                    key={word.id}
                                    className="group flex items-center justify-between rounded-lg border border-gray-700/50 bg-gray-800/40 px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-indigo-500/10"
                                >
                                    <span className="truncate pr-2">{word.word || word.text}</span>
                                    <button
                                        onClick={() => onRemove(word.id)}
                                        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 opacity-100 transition-colors hover:bg-red-500/10 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                                        aria-label={`Удалить слово ${word.word || word.text}`}
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
};
