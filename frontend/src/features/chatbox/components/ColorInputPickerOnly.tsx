import React, { useEffect, useState } from 'react';

import { HexColorPicker } from 'react-colorful';

import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';

interface ColorInputPickerOnlyProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    opacity?: number;
    onOpacityChange?: (value: number) => void;
    swatches?: string[];
}

const DEFAULT_COLOR_SWATCHES = ['#FFFFFF', '#020617', '#38BDF8', '#34D399', '#F97316'];

const normalizeHex = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    if (/^#[0-9A-Fa-f]{3}$/.test(withHash)) {
        const r = withHash[1];
        const g = withHash[2];
        const b = withHash[3];
        return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(withHash)) return withHash.toUpperCase();
    return null;
};

const clampOpacity = (value: number): number => Math.min(Math.max(value, 0), 100);

const ColorInputPickerOnly: React.FC<ColorInputPickerOnlyProps> = ({
    value,
    onChange,
    label,
    opacity,
    onOpacityChange,
    swatches = DEFAULT_COLOR_SWATCHES,
}) => {
    const normalizedValue = normalizeHex(value) || '#000000';
    const [draftValue, setDraftValue] = useState(normalizedValue);
    const currentOpacity = typeof opacity === 'number' ? clampOpacity(opacity) : null;

    useEffect(() => {
        setDraftValue(normalizedValue);
    }, [normalizedValue]);

    const commitColor = (nextColor: string): void => {
        const normalized = normalizeHex(nextColor);
        if (!normalized) return;
        setDraftValue(normalized);
        onChange(normalized);
    };

    return (
        <div className="space-y-2">
            {label && <span className="text-xs text-muted-foreground">{label}</span>}
            <div className="rounded-lg border border-border/70 bg-background/45 p-2.5">
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="h-9 w-11 shrink-0 rounded-md border border-border/80 shadow-sm transition hover:ring-2 hover:ring-sky-400/35"
                                style={{ backgroundColor: normalizedValue }}
                                aria-label="Открыть выбор цвета"
                                title={normalizedValue}
                            />
                        </PopoverTrigger>
                        <PopoverContent align="start" className="z-[11000] w-auto border-border/70 bg-card p-3 shadow-xl">
                            <HexColorPicker color={normalizedValue} onChange={commitColor} />
                        </PopoverContent>
                    </Popover>

                    <input
                        value={draftValue}
                        onChange={(event) => {
                            const nextValue = event.target.value.toUpperCase();
                            setDraftValue(nextValue);
                            const normalized = normalizeHex(nextValue);
                            if (normalized) onChange(normalized);
                        }}
                        onBlur={(event) => commitColor(event.target.value)}
                        className="h-9 min-w-0 flex-1 rounded-md border border-border/70 bg-slate-950/60 px-2 font-mono text-xs text-foreground outline-none focus:border-sky-400/70"
                        aria-label="HEX цвет"
                        spellCheck={false}
                    />
                </div>

                <div className="mt-2 flex gap-1.5">
                    {swatches.slice(0, 5).map((color) => {
                        const normalizedSwatch = normalizeHex(color) || color;
                        const isActive = normalizedSwatch.toUpperCase() === normalizedValue.toUpperCase();
                        return (
                            <button
                                key={color}
                                type="button"
                                onClick={() => commitColor(color)}
                                className={`h-5 w-5 rounded-md border transition-transform hover:scale-105 ${
                                    isActive ? 'border-white/80 ring-2 ring-sky-400/45' : 'border-white/15'
                                }`}
                                style={{ backgroundColor: normalizedSwatch }}
                                aria-label={`Выбрать ${normalizedSwatch}`}
                                title={normalizedSwatch}
                            />
                        );
                    })}
                </div>

                {currentOpacity !== null && onOpacityChange && (
                    <div className="mt-3 flex items-center gap-3">
                        <span className="w-10 text-[11px] font-medium text-muted-foreground">{currentOpacity}%</span>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={currentOpacity}
                            onChange={(event) => onOpacityChange(clampOpacity(Number(event.target.value)))}
                            className="h-2 flex-1 cursor-pointer accent-emerald-400"
                            aria-label="Непрозрачность цвета"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ColorInputPickerOnly;
