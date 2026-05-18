import React from 'react';

import TtsPlayerSurface from '@/features/tts/components/TtsPlayerSurface';

const TtsObsDockPage: React.FC = () => (
    <div className="min-h-screen bg-background text-foreground">
        <TtsPlayerSurface variant="dock" />
    </div>
);

export default TtsObsDockPage;
