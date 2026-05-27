import React, { useEffect } from 'react';

import TtsPlayerSurface from '@/features/tts/components/TtsPlayerSurface';

const TtsObsDockPage: React.FC = () => {
    useEffect(() => {
        const root = document.getElementById('root');
        const previousHtmlBackground = document.documentElement.style.background;
        const previousBodyBackground = document.body.style.background;
        const previousBodyMargin = document.body.style.margin;
        const previousRootBackground = root?.style.background;

        document.documentElement.style.background = 'transparent';
        document.body.style.background = 'transparent';
        document.body.style.margin = '0';
        if (root) {
            root.style.background = 'transparent';
        }

        return () => {
            document.documentElement.style.background = previousHtmlBackground;
            document.body.style.background = previousBodyBackground;
            document.body.style.margin = previousBodyMargin;
            if (root) {
                root.style.background = previousRootBackground || '';
            }
        };
    }, []);

    return (
        <div className="h-screen overflow-hidden bg-transparent text-foreground" style={{ color: '#f8fafc' }}>
            <TtsPlayerSurface variant="dock" />
        </div>
    );
};

export default TtsObsDockPage;
