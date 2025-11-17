import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useChat } from '../context/ChatContext';

const useChatPause = () => {
    const location = useLocation();
    const { pauseChat, resumeChat, isChatConnected } = useChat();

    useEffect(() => {
        // Паузим чат если уходим с TTS страницы
        const isTtsPage = location.pathname.includes('/tts');
        
        if (isChatConnected) {
            if (isTtsPage) {
                resumeChat();
            } else {
                pauseChat();
            }
        }
    }, [location.pathname, isChatConnected, pauseChat, resumeChat]);
};

export default useChatPause;
