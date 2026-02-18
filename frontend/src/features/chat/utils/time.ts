export const formatLocalMessageTime = (rawTimestamp: string | number | Date): string => {
  const date = normalizeMessageDate(rawTimestamp);
  if (!date) return '--:--';

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: userTimeZone,
  }).format(date);
};

const normalizeMessageDate = (rawTimestamp: string | number | Date): Date | null => {
  if (rawTimestamp instanceof Date) {
    return Number.isNaN(rawTimestamp.getTime()) ? null : rawTimestamp;
  }

  if (typeof rawTimestamp === 'number') {
    if (!Number.isFinite(rawTimestamp)) return null;
    // Accept both seconds and milliseconds.
    const ms = rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const trimmed = String(rawTimestamp ?? '').trim();
  if (!trimmed) return null;

  // Numeric string timestamp.
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

