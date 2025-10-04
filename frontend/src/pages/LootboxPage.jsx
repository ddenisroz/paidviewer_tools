import React from 'react';
import { useAuth } from '../context/AuthContext';
import LootboxSystem from '../components/LootboxSystem';

const LootboxPage = () => {
    const { user } = useAuth();

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-4">Войдите в систему</h1>
                    <p className="text-gray-400">Для доступа к системе лутбоксов необходимо войти в аккаунт</p>
                </div>
            </div>
        );
    }

    const channelName = user.display_name || user.username || 'yourchy';

    return (
        <div className="min-h-screen bg-gray-900">
            <div className="container mx-auto px-4 py-8">
                <LootboxSystem channelName={channelName} />
            </div>
        </div>
    );
};

export default LootboxPage;
