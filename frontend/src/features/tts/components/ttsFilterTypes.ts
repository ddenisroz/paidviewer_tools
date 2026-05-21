export interface BlockedUser {
    id?: number;
    username: string;
    platform: string;
    channel_name?: string;
}

export interface FilteredWord {
    id: number;
    word?: string;
    text?: string;
    platform?: string;
}
