/**
 * Типы для стрим данных
 */

/**
 * Категория стрима
 */
export interface StreamCategory {
    id: string;
    name: string;
    title?: string;
    type?: string;
    box_art_url?: string;
    cover_url?: string;
    [key: string]: string | number | undefined;
}

/**
 * Данные стрима для платформы
 */
export interface PlatformStreamData {
    title: string;
    category: StreamCategory | null;
}

/**
 * Данные стрима для всех платформ
 */
export interface StreamData {
    twitch: PlatformStreamData;
    vk: PlatformStreamData;
}

/**
 * История стрима
 */
export interface StreamHistory {
    twitch?: {
        title: string;
        category: string;
        updated_at: string;
    }[];
    vk?: {
        title: string;
        category: string;
        updated_at: string;
    }[];
}

/**
 * Payload для обновления стрима
 */
export interface UpdateStreamPayload {
    twitch?: {
        title?: string;
        category_id?: string;
    };
    vk?: {
        title?: string;
        category_id?: string;
        category?: {
            id: string;
            name: string;
            title: string;
            type: string;
            cover_url?: string;
        };
    };
}
