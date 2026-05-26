import React from 'react';

import TtsPlayerSurface from '@/features/tts/components/TtsPlayerSurface';

const TtsObsDockPage: React.FC = () => (
    <div className="h-screen overflow-hidden bg-background text-foreground" style={{ backgroundColor: '#0b0712', color: '#f8fafc' }}>
        <TtsPlayerSurface variant="dock" />
    </div>
);

export default TtsObsDockPage;
