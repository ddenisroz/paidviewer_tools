import React, { useEffect } from 'react';

import TtsPlayerSurface from '@/features/tts/components/TtsPlayerSurface';
import { useTtsPlayer } from '@/context/TtsPlayerContext';

const TtsPlayerPage: React.FC = () => {
    const { requestPrimaryPlayerTab } = useTtsPlayer();

    useEffect(() => {
        const previousTitle = document.title;
        document.title = 'TTS player';
        requestPrimaryPlayerTab();

        const claimPrimary = () => {
            if (document.visibilityState === 'visible') {
                requestPrimaryPlayerTab();
            }
        };

        window.addEventListener('focus', claimPrimary);
        document.addEventListener('visibilitychange', claimPrimary);

        return () => {
            document.title = previousTitle;
            window.removeEventListener('focus', claimPrimary);
            document.removeEventListener('visibilitychange', claimPrimary);
        };
    }, [requestPrimaryPlayerTab]);

    return (
        <div className="min-h-screen bg-background">
            <TtsPlayerSurface />
        </div>
    );
};

export default TtsPlayerPage;
