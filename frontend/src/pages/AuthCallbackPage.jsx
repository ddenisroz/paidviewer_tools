// src/pages/AuthCallbackPage.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallbackPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    // The backend redirects with the token directly in the hash fragment, e.g., #ey...
    // We just need to remove the leading '#' to get the token.
    const token = hash.substring(1);

    if (token) {
      login(token);
      navigate('/dashboard', { replace: true });
    } else {
      // If there's no token, redirect to login with a potential error message
      navigate('/login?error=auth_failed', { replace: true });
    }
  }, [login, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-xl">Processing authentication...</div>
    </div>
  );
}
