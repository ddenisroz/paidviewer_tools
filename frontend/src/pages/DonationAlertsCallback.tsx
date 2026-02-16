import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { authService } from '@/services/api/services/authService';
import { logger } from '@/shared/utils/prodLogger';

import type { ApiResponse } from '@/types/api';

interface DonationAlertsResponse {
  user_id?: string | number;
}

const DonationAlertsCallback: React.FC = () => {
  const [status, setStatus] = useState<string>('Обработка авторизации...');
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async (): Promise<void> => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        const state = urlParams.get('state');

        if (error) {
          setStatus(`Ошибка авторизации: ${error}`);
          setTimeout(() => navigate('/settings'), 3000);
          return;
        }

        if (!code) {
          setStatus('Код авторизации не получен');
          setTimeout(() => navigate('/settings'), 3000);
          return;
        }

        setStatus('Обмен кода на токен...');

        const response = await authService.handleDonationAlertsCallback(code, state || '');
        const result = response.data as ApiResponse<DonationAlertsResponse>;
        
        setStatus('Успешно подключено к DonationAlerts!');
        
        window.dispatchEvent(new CustomEvent('donationalerts_connected', { 
          detail: { success: true, user_id: result.data?.user_id } 
        }));
        
        window.dispatchEvent(new CustomEvent('auth_refresh_required'));
        
        setTimeout(() => navigate('/settings'), 2000);
      } catch (error: unknown) {
        const err = error as Error;
        logger.error('DonationAlerts callback error:', error);
        setStatus(`Ошибка: ${err.message || 'Неизвестная ошибка'}`);
        setTimeout(() => navigate('/settings'), 3000);
      }
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

