// Types for react-player YouTube instance
export interface ReactPlayerInstance {
    seekTo?: (seconds: number, type?: 'seconds' | 'fraction') => void;
    getCurrentTime?: () => number;
    getDuration?: () => number;
    getInternalPlayer?: () => unknown;
    play?: () => Promise<void> | void;
    pause?: () => void;
    currentTime?: number;
    duration?: number;
    volume?: number;
    muted?: boolean;
}

/**
 * YouTubePlayer interface - matches PlayerContext's YouTubePlayer type
 * This is what gets passed to setPlayerRef in the context
 */
export interface YouTubePlayer {
    pauseVideo: () => void;
    playVideo: () => void;
    setVolume: (volume: number) => void;
    getVolume?: () => number;
    mute: () => void;
    unMute: () => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    destroy?: () => void;
    loadVideoById: (videoId: string, startSeconds?: number) => void;
    cueVideoById: (videoId: string, startSeconds?: number) => void;
}

// Video display type
export interface DisplayVideo {
    id: string | number;
    video_id: string;
    title: string;
    thumbnail?: string;
    thumbnail_url?: string;
    requester_name?: string;
    user_id?: string | number;
    played_at?: string;
}
