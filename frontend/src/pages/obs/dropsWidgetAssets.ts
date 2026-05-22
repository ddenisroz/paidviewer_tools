import commonClosed from '../../images/lootboxes/common/common_closed.png';
import commonOpened from '../../images/lootboxes/common/common_opened.png';
import epicClosed from '../../images/lootboxes/epic/epic_closed.png';
import epicOpened from '../../images/lootboxes/epic/epic_opened.png';
import legendaryClosed from '../../images/lootboxes/legendary/legendary_closed.png';
import legendaryOpened from '../../images/lootboxes/legendary/legendary_opened.png';
import mythycClosed from '../../images/lootboxes/mythyc/mythyc_closed.png';
import mythycOpened from '../../images/lootboxes/mythyc/mythyc_opened.png';
import rareClosed from '../../images/lootboxes/rare/rare_closed.png';
import rareOpened from '../../images/lootboxes/rare/rare_opened_.png';

export const qualityLabel = (quality?: string): string => {
    switch ((quality || '').toLowerCase()) {
        case 'common':
            return 'Обычный';
        case 'rare':
            return 'Редкий';
        case 'epic':
            return 'Эпический';
        case 'legendary':
            return 'Легендарный';
        case 'mythical':
        case 'mythyc':
            return 'Мифический';
        default:
            return 'Награда';
    }
};

export const qualityTone = (quality?: string): string => {
    switch ((quality || '').toLowerCase()) {
        case 'common':
            return 'border-slate-400/35 bg-slate-500/12 text-slate-100';
        case 'rare':
            return 'border-sky-400/35 bg-sky-500/12 text-sky-100';
        case 'epic':
            return 'border-violet-400/35 bg-violet-500/12 text-violet-100';
        case 'legendary':
            return 'border-amber-400/35 bg-amber-500/12 text-amber-100';
        case 'mythical':
        case 'mythyc':
            return 'border-pink-400/35 bg-pink-500/12 text-pink-100';
        default:
            return 'border-slate-400/35 bg-slate-500/12 text-slate-100';
    }
};

export const qualityGlowClass = (quality?: string): string => {
    switch ((quality || '').toLowerCase()) {
        case 'common':
            return 'from-slate-500/22 via-slate-100/4 to-transparent';
        case 'rare':
            return 'from-sky-500/28 via-sky-100/5 to-transparent';
        case 'epic':
            return 'from-violet-500/28 via-fuchsia-100/5 to-transparent';
        case 'legendary':
            return 'from-amber-500/30 via-yellow-100/7 to-transparent';
        case 'mythical':
        case 'mythyc':
            return 'from-pink-500/30 via-fuchsia-100/6 to-transparent';
        default:
            return 'from-slate-500/22 via-slate-100/4 to-transparent';
    }
};

const lootboxImages: Record<string, { closed: string; opened: string }> = {
    common: { closed: commonClosed, opened: commonOpened },
    rare: { closed: rareClosed, opened: rareOpened },
    epic: { closed: epicClosed, opened: epicOpened },
    legendary: { closed: legendaryClosed, opened: legendaryOpened },
    mythical: { closed: mythycClosed, opened: mythycOpened },
    mythyc: { closed: mythycClosed, opened: mythycOpened },
};

export const getLootboxImages = (quality?: string): { closed: string; opened: string } =>
    lootboxImages[(quality || '').toLowerCase()] || lootboxImages.common;
