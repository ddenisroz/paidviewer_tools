// src/context/AuthContext.jsx
import { createContext, useState, useContext, useMemo, useCallback } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('authToken'));

  const login = useCallback((newToken) => {
    setToken(newToken);
    localStorage.setItem('authToken', newToken);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem('authToken');
  }, []);

  const value = useMemo(
    () => ({
      token,
      login,
      logout,
      isAuthenticated: !!token,
    }),
    [token, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
