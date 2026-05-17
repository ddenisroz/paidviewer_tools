export const CHATBOX_BRAND_FONT = 'Tektur';

export const CHATBOX_FONT_OPTIONS = [
    CHATBOX_BRAND_FONT,
    'Rajdhani',
    'Chakra Petch',
    'Geist Sans',
    'Inter',
    'IBM Plex Sans',
    'Fira Sans',
    'Montserrat',
    'Rubik',
    'Oswald',
    'Russo One',
    'Comfortaa',
    'JetBrains Mono',
];

const BUNDLED_FONTS = new Set(['Tektur', 'Rajdhani', 'Chakra Petch', 'Geist Sans']);

const normalizeFontName = (fontFamily: string): string => {
    const firstFont = fontFamily.split(',')[0]?.trim() || fontFamily;
    return firstFont.replace(/^['"]|['"]$/g, '');
};

export const isBundledChatFont = (fontFamily: string): boolean => BUNDLED_FONTS.has(normalizeFontName(fontFamily));
