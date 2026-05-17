import { useEffect } from 'react';

import { useLocation } from 'react-router-dom';

import { useChat } from '@/context/ChatContext';

const useChatPause = (): void => {
    const location = useLocation();
    const { isConnected } = useChat();

    useEffect(() => {
        const isTtsPage = location.pathname.includes('/tts');
        // Pause/resume functionality not implemented in current ChatContext
        if (isConnected) {
            if (isTtsPage) {
                // Resume chat
            } else {
                // Pause chat
            }
        }
    }, [location.pathname, isConnected]);
};

export default useChatPause;
