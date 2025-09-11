// src/pages/LoginPage.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      switch (error) {
        case 'auth_failed_no_code':
          setAuthError('Аутентификация не удалась: Twitch не предоставил код авторизации.');
          break;
        case 'twitch_token_exchange_failed':
          setAuthError('Аутентификация не удалась: Не удалось проверить авторизацию в Twitch. Пожалуйста, попробуйте еще раз.');
          break;
        default:
          setAuthError('Произошла неизвестная ошибка аутентификации.');
          break;
      }
    }
  }, [searchParams]);

  const handleLogin = () => {
    if (!API_BASE_URL) {
      alert("Error: VITE_API_BASE_URL is not defined! Please check your .env file.");
      return;
    }
    // Redirect to the backend's Twitch login route
    window.location.href = `${API_BASE_URL}/auth/twitch`;
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white font-sans">
      <div className="text-center p-4">
        {authError && (
          <div className="bg-red-500 text-white p-4 rounded-lg mb-6">
              <h3 className="font-bold">Ошибка входа</h3>
              <p>{authError}</p>
          </div>
        )}
        {!API_BASE_URL && (
          <div className="bg-red-500 text-white p-4 rounded-lg mb-6">
            <h3 className="font-bold">Configuration Error</h3>
            <p>The application is missing the API server address.</p>
            <p>Please create a <code>.env</code> file in the <code>frontend</code> directory with the following content:</p>
            <pre className="bg-slate-800 p-2 mt-2 rounded"><code>VITE_API_BASE_URL=http://localhost:8000</code></pre>
          </div>
        )}
        <h1 className="text-4xl font-bold mb-4 text-purple-400">TTS_TTV</h1>
        <p className="text-slate-400 mb-8">Login to manage your TTS bot</p>
        <button
          onClick={handleLogin}
          className="bg-[#9146FF] hover:bg-[#7a3adc] text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex items-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 mr-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" // A generic icon, we can replace it with a Twitch icon later
            />
          </svg>
          Login with Twitch
        </button>
      </div>
    </div>
  );
}
