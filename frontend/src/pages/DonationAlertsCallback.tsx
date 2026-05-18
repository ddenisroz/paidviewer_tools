import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

const DonationAlertsCallback: React.FC = () => {
    const [status, setStatus] = useState<string>('Обработка авторизации...');
    const navigate = useNavigate();

    useEffect(() => {
        const handleCallback = async (): Promise<void> => {
            const urlParams = new URLSearchParams(window.location.search);
            const error = urlParams.get('auth_error') || urlParams.get('error');
            const connected = urlParams.get('da_connected') === 'true';

            if (connected) {
                setStatus('DonationAlerts подключен.');
                window.dispatchEvent(new CustomEvent('donationalerts_connected', { detail: { success: true } }));
                window.dispatchEvent(new CustomEvent('auth_refresh_required'));
                setTimeout(() => navigate('/settings'), 1200);
                return;
            }

            setStatus(error ? `Ошибка авторизации: ${error}` : 'Авторизация DonationAlerts не завершена');
            setTimeout(() => navigate('/settings'), 2500);
        };

        handleCallback();
    }, [navigate]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="card-glass p-8 rounded-lg shadow-lg text-center border border-border">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-foreground mb-2">DonationAlerts</h2>
                <p className="text-muted-foreground">{status}</p>
            </div>
        </div>
    );
};

export default DonationAlertsCallback;
