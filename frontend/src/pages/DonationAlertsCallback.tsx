import { useEffect, useState } from 'react';

import { API_BASE_URL } from '@/constants';
import { getSafeBackendAuthUrl } from '@/shared/utils/navigationSafety';

const DonationAlertsCallback: React.FC = () => {
    const [status, setStatus] = useState<string>('Обработка авторизации...');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error') || params.get('auth_error');
        const errorDescription = params.get('error_description');

        const backendParams = new URLSearchParams();
        if (code) backendParams.set('code', code);
        if (state) backendParams.set('state', state);
        if (error) backendParams.set('error', error);
        if (errorDescription) backendParams.set('error_description', errorDescription);

        if (!code && !error) {
            setStatus('DonationAlerts не вернул код авторизации.');
            window.setTimeout(() => window.location.replace('/dashboard/media?tab=memealerts'), 1500);
            return;
        }

        const redirectUrl = getSafeBackendAuthUrl(
            API_BASE_URL,
            `/auth/donationalerts/callback?${backendParams.toString()}`
        );
        if (!redirectUrl) {
            setStatus('Не удалось обработать callback DonationAlerts.');
            window.setTimeout(() => window.location.replace('/dashboard/media?tab=memealerts'), 1500);
            return;
        }

        window.location.replace(redirectUrl);
    }, []);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="rounded-lg border border-border bg-card p-6 text-center shadow-lg">
                <h2 className="mb-2 text-lg font-semibold text-foreground">DonationAlerts</h2>
                <p className="text-sm text-muted-foreground">{status}</p>
            </div>
        </div>
    );
};

export default DonationAlertsCallback;
