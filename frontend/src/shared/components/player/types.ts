/**
 * YouTubePlayer interface - matches PlayerContext's YouTubePlayer type
 * This is what gets passed to setPlayerRef in the context
 */
export interface YouTubePlayer {
    pauseVideo: () => void;
    playVideo: () => void;
    setVolume: (volume: number) => void;
    getVolume?: () => number;
    isMuted?: () => boolean;
    mute: () => void;
    unMute: () => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
    destroy?: () => void;
    loadVideoById: (videoId: string, startSeconds?: number) => void;
    cueVideoById: (videoId: string, startSeconds?: number) => void;
}

// Video display type
export interface DisplayVideo {
    id: string | number;
    video_id: string;
    title: string;
    url?: string;
    thumbnail?: string;
    thumbnail_url?: string;
    requester_name?: string;
    added_by?: string;
    user_id?: string | number;
    played_at?: string;
    duration?: string;
    is_paid?: boolean;
    paid_source?: string | null;
    paid_amount?: number | null;
    paid_currency?: string | null;
}
