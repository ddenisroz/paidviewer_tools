import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../constants';
import { useNavigate } from 'react-router-dom';

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
        const response = await fetch(`${API_BASE_URL}/auth/donationalerts/callback?code=${code}&state=${state || ''}`);
        
        if (response.ok) {
          const result = await response.json();
          setStatus('Успешно подключено к DonationAlerts!');
          
          // Обновляем контекст DonationAlerts
          window.dispatchEvent(new CustomEvent('donationalerts_connected', { 
            detail: { success: true, user_id: result.user_id } 
          }));
          
          // Принудительно обновляем данные аутентификации
          window.dispatchEvent(new CustomEvent('auth_refresh_required'));
          
          setTimeout(() => navigate('/settings'), 2000);
        } else {
          const error = await response.json();
          setStatus(`Ошибка: ${error.detail || 'Неизвестная ошибка'}`);
          setTimeout(() => navigate('/settings'), 3000);
        }
      } catch (error) {
        console.error('DonationAlerts callback error:', error);
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
