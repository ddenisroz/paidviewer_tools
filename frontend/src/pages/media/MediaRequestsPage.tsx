import React from 'react';

import { useSearchParams } from 'react-router-dom';

import { MemeAlertsRewards } from '@/features/drops/components/MemeAlertsRewards';
import DropsMainPage from '@/features/drops/pages/DropsMainPage';
import YoutubeIntegrationPage from '@/pages/media/YoutubeIntegrationPage';
import PageWrapper from '@/shared/components/PageWrapper';
import { Card, CardContent } from '@/shared/components/ui/card';

const MediaRequestsPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'youtube';

    // Render content based on tab query parameter
    // Navigation is handled by sidebar, no need for tabs UI
    const renderContent = () => {
        switch (activeTab) {
            case 'youtube':
                return <YoutubeIntegrationPage />;
            case 'memealerts':
                return (
                    <Card className="card-glass">
                        <CardContent className="pt-6">
                            <MemeAlertsRewards />
                        </CardContent>
                    </Card>
                );
            case 'drops':
                return <DropsMainPage />;
            default:
                return <YoutubeIntegrationPage />;
        }
    };

    return (
        <PageWrapper title="Медиа запросы">
            <div className="container mx-auto max-w-7xl">
                {renderContent()}
            </div>
        </PageWrapper>
    );
};

export default MediaRequestsPage;
