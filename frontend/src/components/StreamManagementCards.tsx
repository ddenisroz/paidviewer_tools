// src/components/StreamManagementCards.tsx
import React from 'react';

import StreamCategoryCard from './StreamCategoryCard';
import StreamTitleCard from './StreamTitleCard';

interface StreamManagementCardsProps {
    onTitleLinkStateChange?: (linked: boolean) => void;
    onCategoryLinkStateChange?: (linked: boolean) => void;
}

/**
 * Обертка для карточек управления стримом.
 * Отображает карточки управления названием и категорией стрима.
 */
const StreamManagementCards: React.FC<StreamManagementCardsProps> = ({
    onTitleLinkStateChange,
    onCategoryLinkStateChange
}) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StreamTitleCard onLinkStateChange={onTitleLinkStateChange} />
            <StreamCategoryCard onLinkStateChange={onCategoryLinkStateChange} />
        </div>
    );
};

export default StreamManagementCards;
