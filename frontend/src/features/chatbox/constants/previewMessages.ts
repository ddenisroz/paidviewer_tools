import type { ChatEmote } from '@/types/chat';

export interface ChatBoxPreviewMessage {
    id: number;
    platform: 'twitch' | 'vk';
    author: string;
    message: string;
    time: string;
    role: string;
    badges: string[];
    emotes?: ChatEmote[];
    vk_role_icon_url?: string;
    avatar_url?: string;
}

const VK_BADGE =
    'https://images.live.vkvideo.ru/badge/69b9405b-81ae-40b4-abdb-2d47cff10637/icon/size/large?change_time=1733399731';
const VK_EMOTE =
    'https://images.live.vkvideo.ru/smile/e46b4fbd-901a-4f62-8924-da9eb4f094f8/icon/size/large?change_time=1759944303';

export const CHATBOX_PREVIEW_MESSAGES: ChatBoxPreviewMessage[] = [
    {
        id: 1,
        platform: 'twitch',
        author: 'petux_ukropov',
        message: 'какие нахуй игры, врубай аук HYPE',
        time: '12:00',
        role: 'Viewer',
        badges: [],
        avatar_url: 'https://placehold.co/40x40/1f2937/FFFFFF?text=PU',
    },
    {
        id: 2,
        platform: 'twitch',
        author: 'goodboiklek',
        message: 'генг генг генг Obsent',
        time: '12:01',
        role: 'VIP',
        badges: ['vip/1'],
        avatar_url: 'https://placehold.co/40x40/4f46e5/FFFFFF?text=G',
    },
    {
        id: 3,
        platform: 'vk',
        author: 'ilya_davydov',
        message: 'упал хуй сосать :lasqaJoyge: imNOTcrying',
        time: '12:02',
        role: '',
        badges: [VK_BADGE],
        emotes: [{ id: 'e46b4fbd-901a-4f62-8924-da9eb4f094f8', name: 'lasqaJoyge', url: VK_EMOTE, start: 0, end: 0 }],
        avatar_url: 'https://placehold.co/40x40/ef4444/FFFFFF?text=ID',
    },
    {
        id: 4,
        platform: 'twitch',
        author: 'dimpl_tv',
        message: 'смотри какая тётя стримит и крутит попочкой https://www.twitch.tv/arolfish HYPE Obsent',
        time: '12:03',
        role: 'Moderator',
        badges: ['moderator/1'],
        avatar_url: 'https://placehold.co/40x40/22c55e/FFFFFF?text=D',
    },
    {
        id: 5,
        platform: 'twitch',
        author: 'lemonych',
        message: 'люблю вас друзья imNOTcrying HYPE',
        time: '12:04',
        role: 'Viewer',
        badges: [],
        avatar_url: 'https://placehold.co/40x40/f59e0b/111827?text=L',
    },
];
