type DateInput = string | number | Date | null | undefined;

const DEFAULT_LOCALE = 'ru-RU';

export const resolveAppTimeZone = (): string => {
    if (typeof window === 'undefined') return 'UTC';
    return window.localStorage.getItem('app.timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
};

export const normalizeDateInput = (value: DateInput): Date | null => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return null;
        const ms = value < 1e12 ? value * 1000 : value;
        const date = new Date(ms);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const trimmed = String(value ?? '').trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
        const asNumber = Number(trimmed);
        if (!Number.isFinite(asNumber)) return null;
        const ms = asNumber < 1e12 ? asNumber * 1000 : asNumber;
        const date = new Date(ms);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatAppDateTime = (
    value: DateInput,
    options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    },
    locale = DEFAULT_LOCALE
): string => {
    const date = normalizeDateInput(value);
    if (!date) return '-';
    return new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: resolveAppTimeZone(),
    }).format(date);
};

export const formatAppTime = (value: DateInput, locale = DEFAULT_LOCALE): string =>
    formatAppDateTime(
        value,
        {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        },
        locale
    );
