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
        author: 'dimplik',
        message: 'Доброе утро Em',
        time: '12:00',
        role: 'Viewer',
        badges: [],
        avatar_url: 'https://placehold.co/40x40/1f2937/FFFFFF?text=D',
    },
    {
        id: 2,
        platform: 'twitch',
        author: 'podarok',
        message: 'аравудус подрубил Kappa',
        time: '12:01',
        role: 'VIP',
        badges: ['vip/1'],
        emotes: [{ id: '25', name: 'Kappa', url: 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0', start: 18, end: 22 }],
        avatar_url: 'https://placehold.co/40x40/4f46e5/FFFFFF?text=P',
    },
    {
        id: 3,
        platform: 'twitch',
        author: 'arolkish',
        message: 'Ребят, что выиграло на ауке? https://example.com',
        time: '12:02',
        role: 'Moderator',
        badges: ['moderator/1'],
        avatar_url: 'https://placehold.co/40x40/22c55e/FFFFFF?text=A',
    },
    {
        id: 4,
        platform: 'vk',
        author: 'Дмитрий Хохлов',
        message: 'когда уже игры будут? :lasqaJoyge:',
        time: '12:03',
        role: '',
        badges: [VK_BADGE],
        emotes: [{ id: 'e46b4fbd-901a-4f62-8924-da9eb4f094f8', name: 'lasqaJoyge', url: VK_EMOTE, start: 0, end: 0 }],
        avatar_url: 'https://placehold.co/40x40/ef4444/FFFFFF?text=DK',
    },
    {
        id: 5,
        platform: 'vk',
        author: 'Zavtra_Zavod',
        message: 'Доброе утро :lasqaPoPivu:',
        time: '12:04',
        role: '',
        badges: [VK_BADGE],
        emotes: [{ id: 'e46b4fbd-901a-4f62-8924-da9eb4f094f8', name: 'lasqaPoPivu', url: VK_EMOTE, start: 0, end: 0 }],
        avatar_url: 'https://placehold.co/40x40/ef4444/FFFFFF?text=ZZ',
    },
    {
        id: 6,
        platform: 'twitch',
        author: 'Posobachii',
        message: 'аравудус подрубил JustAnotherDay',
        time: '12:05',
        role: 'Viewer',
        badges: [],
        avatar_url: 'https://placehold.co/40x40/475569/FFFFFF?text=P',
    },
    {
        id: 7,
        platform: 'twitch',
        author: 'yourchy',
        message: 'новое сообщение в чате Kappa PogChamp',
        time: '12:06',
        role: 'Broadcaster',
        badges: ['broadcaster/1'],
        emotes: [
            { id: '25', name: 'Kappa', url: 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0', start: 24, end: 28 },
            { id: '88', name: 'PogChamp', url: 'https://static-cdn.jtvnw.net/emoticons/v2/88/default/dark/1.0', start: 30, end: 37 },
        ],
        avatar_url: 'https://placehold.co/40x40/22c55e/FFFFFF?text=Y',
    },
    {
        id: 8,
        platform: 'vk',
        author: 'podarok',
        message: 'тест горизонтального превью :lasqaJoyge:',
        time: '12:07',
        role: '',
        badges: [],
        emotes: [{ id: 'e46b4fbd-901a-4f62-8924-da9eb4f094f8', name: 'lasqaJoyge', url: VK_EMOTE, start: 0, end: 0 }],
        avatar_url: 'https://placehold.co/40x40/9147FF/FFFFFF?text=P',
    },
];
