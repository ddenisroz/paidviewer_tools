import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

const IntegrationsContext = createContext();

export const useIntegrations = () => useContext(IntegrationsContext);

export const IntegrationsProvider = ({ children }) => {
    const auth = useAuth();
    
    // Проверяем, что auth инициализирован
    if (!auth) {
        return <div>Loading...</div>;
    }
    
    const { user, isAuthenticated, login, logout } = auth;
    const [isLoading, setIsLoading] = useState(true);
    const [integrations, setIntegrations] = useState({
        twitch: { enabled: false },
        vk: { enabled: false },
    });

    useEffect(() => {
        setIsLoading(true);
        const twitchEnabled = isAuthenticated && user?.platform === 'twitch';
        
        setIntegrations({
            twitch: { enabled: twitchEnabled },
            vk: { enabled: false },
        });
        setIsLoading(false);
    }, [user, isAuthenticated]);

    const updateTwitchIntegration = async (enabled) => {
        if (enabled) {
            login();
        } else {
            await logout();
            toast.success('Интеграция с Twitch отключена');
        }
    };
    
    const updateVkIntegration = () => {
        toast.info('Интеграция с VK Live пока не доступна.');
    };

    const value = {
        integrations,
        isLoading,
        updateTwitchIntegration,
        updateVkIntegration,
    };

    return (
        <IntegrationsContext.Provider value={value}>
            {children}
        </IntegrationsContext.Provider>
    );
};
