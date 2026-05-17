type PlatformCategory = {
    name?: string;
    title?: string;
    box_art_url?: string;
    cover_url?: string;
};

type StreamQueryData = Record<string, unknown>;

type PlatformInitialData = {
    category?: PlatformCategory | null;
};

type HomeInitialData = {
    twitch?: PlatformInitialData;
    vk?: PlatformInitialData;
};

type IntegrationsState = {
    twitch?: { enabled?: boolean };
    vk?: { enabled?: boolean };
};

export interface HomeStreamDataInput {
    integrations?: IntegrationsState | null;
    twitchStreamInfo?: { data?: StreamQueryData } | null;
    vkStreamInfo?: { data?: StreamQueryData } | null;
    initialData: HomeInitialData;
    combineCategories?: boolean;
}

const categoryName = (category?: PlatformCategory | null): string => category?.name || category?.title || '';
const categoryArt = (category?: PlatformCategory | null): string => category?.box_art_url || category?.cover_url || '';
const streamText = (streamInfo: StreamQueryData | undefined, key: string): string =>
    typeof streamInfo?.[key] === 'string' ? streamInfo[key] : '';
const streamNumber = (streamInfo: StreamQueryData | undefined, ...keys: string[]): number => {
    for (const key of keys) {
        const rawValue = streamInfo?.[key];
        const normalized = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (Number.isFinite(normalized)) return normalized;
    }
    return 0;
};
const firstText = (...values: string[]): string => values.find((value) => value.length > 0) ?? '';

const twitchFallbackCategory = (streamInfo?: StreamQueryData): PlatformCategory | null =>
    streamText(streamInfo, 'game_name')
        ? {
              name: streamText(streamInfo, 'game_name'),
              box_art_url: firstText(streamText(streamInfo, 'thumbnail_url'), streamText(streamInfo, 'box_art_url')),
          }
        : null;

const vkFallbackCategory = (streamInfo?: StreamQueryData): PlatformCategory | null =>
    streamText(streamInfo, 'category_name')
        ? { name: streamText(streamInfo, 'category_name'), cover_url: streamText(streamInfo, 'category_img_url') }
        : null;

const normalizeTwitchBoxArt = (url: string): string =>
    url.includes('{width}') ? url.replace('{width}', '52').replace('{height}', '72') : url;

const combinedCategory = (input: HomeStreamDataInput): PlatformCategory | null => {
    if (!input.combineCategories || !input.integrations?.twitch?.enabled || !input.integrations?.vk?.enabled)
        return null;
    return (
        input.initialData.twitch?.category ||
        input.initialData.vk?.category ||
        twitchFallbackCategory(input.twitchStreamInfo?.data) ||
        vkFallbackCategory(input.vkStreamInfo?.data)
    );
};

const buildTwitchData = (input: HomeStreamDataInput, combined: PlatformCategory | null) => {
    if (!input.integrations?.twitch?.enabled) return undefined;
    const category = input.initialData.twitch?.category;
    const fallback = input.twitchStreamInfo?.data;
    const name = firstText(categoryName(combined), categoryName(category), streamText(fallback, 'game_name'));
    const art = firstText(
        categoryArt(combined),
        categoryArt(category),
        streamText(fallback, 'thumbnail_url'),
        streamText(fallback, 'box_art_url')
    );
    return {
        isLive: Boolean(fallback?.is_live),
        viewerCount: streamNumber(fallback, 'viewers', 'viewer_count', 'viewerCount'),
        gameName: name,
        boxArtUrl: normalizeTwitchBoxArt(art),
    };
};

const buildVkData = (input: HomeStreamDataInput, combined: PlatformCategory | null) => {
    if (!input.integrations?.vk?.enabled) return undefined;
    const category = input.initialData.vk?.category;
    const fallback = input.vkStreamInfo?.data;
    const name = firstText(categoryName(combined), categoryName(category), streamText(fallback, 'category_name'));
    const art = firstText(categoryArt(combined), categoryArt(category), streamText(fallback, 'category_img_url'));
    return {
        isLive: Boolean(fallback?.is_live),
        viewerCount: streamNumber(fallback, 'viewers', 'viewer_count', 'viewerCount'),
        gameName: name,
        boxArtUrl: art,
    };
};

export const createHomeStreamData = (input: HomeStreamDataInput) => {
    const combined = combinedCategory(input);
    return {
        twitch: buildTwitchData(input, combined),
        vk: buildVkData(input, combined),
    };
};
