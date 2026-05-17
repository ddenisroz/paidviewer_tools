import React, { useEffect, useState } from 'react';

import { Input } from '@/shared/components/ui/input';

interface ColorInputProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
}

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

const ColorInput: React.FC<ColorInputProps> = ({ value, onChange, label }) => {
    const [inputValue, setInputValue] = useState(value);

    const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const normalized = normalizeHex(e.target.value);
        if (normalized) {
            onChange(normalized);
            setInputValue(normalized);
        }
    };

    const commitValue = (raw: string): void => {
        const normalized = normalizeHex(raw);
        if (normalized) {
            onChange(normalized);
            setInputValue(normalized);
        } else {
            setInputValue(value);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        const normalized = normalizeHex(newValue);
        if (normalized) {
            onChange(normalized);
        }
    };

    // Sync inputValue when value prop changes
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    return (
        <div className="space-y-2">
            {label && <span className="text-xs text-muted-foreground min-w-16">{label}</span>}
            <div className="rounded-lg border border-slate-700/70 bg-slate-950/45 p-2">
                <div className="flex items-center gap-2 min-w-0">
                    <input
                        type="color"
                        value={value}
                        onChange={handlePickerChange}
                        aria-label="Выбрать цвет"
                        className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-slate-600/80 bg-slate-900/90 p-0 [color-scheme:dark] [&::-webkit-color-swatch-wrapper]:p-[3px] [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none"
                    />
                    <Input
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        onBlur={() => commitValue(inputValue)}
                        className="h-9 w-28 px-2 bg-slate-900/70 border-slate-700/70 text-white text-sm font-normal font-base"
                        maxLength={7}
                        placeholder="#000000"
                        inputMode="text"
                    />
                </div>
            </div>
        </div>
    );
};

export default ColorInput;
