import React from 'react';

import { useSearchParams } from 'react-router-dom';

import { MemeAlertsRewards } from '@/features/drops/components/MemeAlertsRewards';
import DropsMainPage from '@/features/drops/pages/DropsMainPage';
import YoutubeIntegrationPage from '@/pages/media/YoutubeIntegrationPage';
import PageWrapper from '@/shared/components/PageWrapper';

const MediaRequestsPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'youtube';

    const renderContent = () => {
        switch (activeTab) {
            case 'youtube':
                return <YoutubeIntegrationPage />;
            case 'memealerts':
                return <MemeAlertsRewards />;
            case 'drops':
                return <DropsMainPage />;
            default:
                return <YoutubeIntegrationPage />;
        }
    };

    return (
        <PageWrapper title="Медиа запросы">
            <div className="w-full">
                {renderContent()}
            </div>
        </PageWrapper>
    );
};

export default MediaRequestsPage;
