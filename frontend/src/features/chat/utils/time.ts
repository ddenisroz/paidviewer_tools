import { formatAppTime, normalizeDateInput } from '@/shared/utils/dateTime';

export const formatLocalMessageTime = (rawTimestamp: string | number | Date): string => {
    const date = normalizeMessageDate(rawTimestamp);
    if (!date) return '--:--';
    return formatAppTime(date, undefined);
};

const normalizeMessageDate = (rawTimestamp: string | number | Date): Date | null => {
    return normalizeDateInput(rawTimestamp);
};
