import React from 'react';

const LoginPage = () => {
  const handleLogin = () => {
    // Redirect to the backend's Twitch login endpoint
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/api/auth/twitch/login`;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
      <div className="text-center p-8 bg-slate-800 rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold mb-4">Twitch TTS Dashboard</h1>
        <p className="mb-6 text-slate-400">Please log in with your Twitch account to continue.</p>
        <button
          onClick={handleLogin}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-300"
        >
          Login with Twitch
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
