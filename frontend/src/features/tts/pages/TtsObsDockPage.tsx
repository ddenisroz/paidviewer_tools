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
        <div className="h-screen overflow-hidden bg-transparent text-slate-50 antialiased">
            <div className="h-full overflow-hidden bg-[#09070f]/92 shadow-[0_20px_70px_rgba(0,0,0,0.42)] backdrop-blur-md">
                <TtsPlayerSurface variant="dock" />
            </div>
        </div>
    );
};

export default TtsObsDockPage;
