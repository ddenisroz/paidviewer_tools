import { describe, expect, it } from 'vitest';

import { getSevenTvFallbackEmotes, registerEmoteAliases } from './emotes';

describe('7TV fallback helpers', () => {
    it('includes live fallback entries for preview-critical emotes', () => {
        const emotes = getSevenTvFallbackEmotes();
        const names = emotes.map((emote) => emote.name);

        expect(names).toContain('HYPE');
        expect(names).toContain('Obsent');
        expect(names).toContain('imNOTcrying');
        expect(emotes.every((emote) => emote.url.includes('/api/proxy/7tv/'))).toBe(true);
    });

    it('registers lowercase and colon aliases for fallback emotes', () => {
        const map = new Map();
        const [hype] = getSevenTvFallbackEmotes().filter((emote) => emote.name === 'HYPE');

        registerEmoteAliases(map, hype);

        expect(map.get('HYPE')).toEqual(hype);
        expect(map.get('hype')).toEqual(hype);
        expect(map.get(':HYPE:')).toEqual(hype);
        expect(map.get(':hype:')).toEqual(hype);
    });
});
