import React from 'react';

import { AdminPageHeader } from '@/features/admin/components/admin-ui';

import VoiceManagement from '../components/VoiceManagement';

const AdminTtsPage: React.FC = () => (
    <div className="space-y-6">
        <AdminPageHeader title="Голоса" description="Загрузка и управление голосовыми сэмплами для TTS." />
        <VoiceManagement />
    </div>
);

export default AdminTtsPage;
