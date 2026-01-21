// src/components/StreamManagementCards.tsx
import React from 'react';

import StreamCategoryCard from './StreamCategoryCard';
import StreamTitleCard from './StreamTitleCard';

/**
 * Обертка для карточек управления стримом.
 * Отображает карточки управления названием и категорией стрима.
 */
const StreamManagementCards: React.FC = () => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StreamTitleCard />
            <StreamCategoryCard />
        </div>
    );
};

export default StreamManagementCards;
