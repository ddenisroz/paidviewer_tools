import { useEffect, useState } from 'react';
import { authService } from '../services/api/services/authService';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/prodLogger';

const DonationAlertsCallback = () => {
  const [status, setStatus] = useState('Обработка авторизации...');
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
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

        // Отправляем код на бэкенд для обмена на токен
        const response = await authService.handleDonationAlertsCallback(code, state || '');
        const result = response.data;
        
        setStatus('Успешно подключено к DonationAlerts!');
        
        // Обновляем контекст DonationAlerts
        window.dispatchEvent(new CustomEvent('donationalerts_connected', { 
          detail: { success: true, user_id: result.user_id } 
        }));
        
        // Принудительно обновляем данные аутентификации
        window.dispatchEvent(new CustomEvent('auth_refresh_required'));
        
        setTimeout(() => navigate('/settings'), 2000);
      } catch (error) {
        logger.error('DonationAlerts callback error:', error);
        setStatus(`Ошибка: ${error.message}`);
        setTimeout(() => navigate('/settings'), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-white mb-2">DonationAlerts</h2>
        <p className="text-gray-300">{status}</p>
      </div>
    </div>
  );
};

export default DonationAlertsCallback;
