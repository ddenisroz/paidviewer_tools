// src/hooks/useApi.js
import { useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export function useApi() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL,
    });

    instance.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // If we get a 401, our token is likely expired or invalid.
          // Log the user out and redirect to login.
          logout();
          navigate('/login', { replace: true });
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, [token, logout, navigate]);

  return api;
}
