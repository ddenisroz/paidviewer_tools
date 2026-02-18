import React, { useEffect, useState } from 'react';

import { Input } from '@/shared/components/ui/input';

interface ColorInputModernProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
}

const COLOR_PRESETS = [
    '#FFFFFF', '#E5E7EB', '#9CA3AF', '#000000',
    '#60A5FA', '#2563EB', '#22D3EE', '#10B981',
    '#34D399', '#84CC16', '#F59E0B', '#F97316',
    '#EF4444', '#EC4899', '#A855F7', '#9147FF'
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

const ColorInputModern: React.FC<ColorInputModernProps> = ({ value, onChange, label }) => {
    const [inputValue, setInputValue] = useState(value);

    useEffect(() => {
        setInputValue(value);
    }, [value]);

    const commitValue = (raw: string): void => {
        const normalized = normalizeHex(raw);
        if (normalized) {
            onChange(normalized);
            setInputValue(normalized);
        } else {
            setInputValue(value);
        }
    };

    return (
        <div className="space-y-2">
            {label && <span className="text-xs text-muted-foreground min-w-16">{label}</span>}
            <div className="rounded-lg border border-slate-700/70 bg-slate-950/45 p-2">
                <div className="flex items-center gap-2 min-w-0">
                    <input
                        type="color"
                        value={value}
                        onChange={(e) => commitValue(e.target.value)}
                        aria-label="Выбрать цвет"
                        className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-slate-600/80 bg-slate-900/90 p-0 [color-scheme:dark] [&::-webkit-color-swatch-wrapper]:p-[3px] [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none"
                    />
                    <Input
                        type="text"
                        value={inputValue}
                        onChange={(e) => {
                            const next = e.target.value;
                            setInputValue(next);
                            const normalized = normalizeHex(next);
                            if (normalized) onChange(normalized);
                        }}
                        onBlur={() => commitValue(inputValue)}
                        className="h-9 w-28 px-2 bg-slate-900/70 border-slate-700/70 text-white text-sm font-normal font-base"
                        maxLength={7}
                        placeholder="#000000"
                    />
                </div>
                <div className="mt-2 grid grid-cols-8 gap-1.5">
                    {COLOR_PRESETS.map((preset) => {
                        const active = preset.toUpperCase() === (value || '').toUpperCase();
                        return (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                    onChange(preset);
                                    setInputValue(preset);
                                }}
                                className={`h-5 w-5 rounded-md border transition-colors ${active ? 'border-cyan-300' : 'border-slate-600/80 hover:border-slate-400'}`}
                                style={{ backgroundColor: preset }}
                                title={preset}
                                aria-label={`Цвет ${preset}`}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ColorInputModern;
