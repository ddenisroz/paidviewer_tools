import React from 'react';

interface ColorInputPickerOnlyProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    opacity?: number;
    onOpacityChange?: (value: number) => void;
    swatches?: string[];
}

const DEFAULT_COLOR_SWATCHES = [
    '#FFFFFF',
    '#0F172A',
    '#38BDF8',
    '#34D399',
    '#F472B6',
    '#F59E0B',
    '#A78BFA',
    '#EF4444',
];

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
    if (/^#[0-9A-Fa-f]{6}$/.test(withHash)) {
        return withHash.toUpperCase();
    }
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
    const currentOpacity = typeof opacity === 'number' ? clampOpacity(opacity) : null;

    return (
        <div className="space-y-2">
            {label && <span className="min-w-16 text-xs text-muted-foreground">{label}</span>}
            <div className="rounded-lg border border-slate-700/70 bg-slate-950/45 p-2.5">
                <div className="mb-2.5 flex flex-wrap gap-1.5">
                    {swatches.map((color) => {
                        const isActive = color.toUpperCase() === normalizedValue.toUpperCase();
                        return (
                            <button
                                key={color}
                                type="button"
                                onClick={() => onChange(color)}
                                className={`h-6 w-6 rounded-md border transition-transform hover:scale-105 ${
                                    isActive ? 'border-white/70 ring-2 ring-sky-400/45' : 'border-white/15'
                                }`}
                                style={{ backgroundColor: color }}
                                title={color}
                                aria-label={`Выбрать ${color}`}
                            />
                        );
                    })}
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={normalizedValue}
                        onChange={(e) => {
                            const normalized = normalizeHex(e.target.value);
                            if (normalized) onChange(normalized);
                        }}
                        aria-label="Выбрать цвет"
                        className="h-9 w-14 shrink-0 cursor-pointer rounded-md border border-slate-600/80 bg-slate-900/90 p-0 [color-scheme:dark] [&::-webkit-color-swatch-wrapper]:p-[3px] [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none"
                    />
                    <input
                        value={normalizedValue}
                        onChange={(e) => {
                            const normalized = normalizeHex(e.target.value);
                            onChange(normalized || e.target.value.toUpperCase());
                        }}
                        onBlur={(e) => {
                            const normalized = normalizeHex(e.target.value);
                            if (normalized) onChange(normalized);
                        }}
                        className="h-9 min-w-0 flex-1 rounded-md border border-slate-700/70 bg-slate-950/70 px-2 font-mono text-xs text-slate-100 outline-none focus:border-sky-400/70"
                        aria-label="HEX цвет"
                        spellCheck={false}
                    />
                </div>

                {currentOpacity !== null && onOpacityChange && (
                    <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Непрозрачность</span>
                            <span className="font-mono text-slate-200">{currentOpacity}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={currentOpacity}
                                onChange={(e) => onOpacityChange(clampOpacity(Number(e.target.value)))}
                                className="h-2 flex-1 cursor-pointer accent-sky-400"
                                aria-label="Непрозрачность цвета"
                            />
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="5"
                                value={currentOpacity}
                                onChange={(e) => onOpacityChange(clampOpacity(Number(e.target.value) || 0))}
                                className="h-8 w-16 rounded-md border border-slate-700/70 bg-slate-950/70 px-2 text-right font-mono text-xs text-slate-100 outline-none focus:border-sky-400/70"
                                aria-label="Непрозрачность в процентах"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ColorInputPickerOnly;
