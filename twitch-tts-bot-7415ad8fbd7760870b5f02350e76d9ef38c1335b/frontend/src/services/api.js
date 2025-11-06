// src/services/api.js
import axios from 'axios';
import { toast } from 'sonner';

import { API_BASE_URL } from '../constants';

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

// Add a request interceptor to set the token
api.interceptors.request.use(
    (config) => {
        // Полностью полагаемся на httpOnly cookies с withCredentials
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Create a separate admin API client that uses admin_token
const adminApi = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

// Add a request interceptor for admin API
// Теперь полагаемся на httpOnly cookies с withCredentials
adminApi.interceptors.request.use(
    (config) => {
        // Админские токены теперь передаются через httpOnly cookies
        // с withCredentials: true, что безопаснее localStorage
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor for admin API
adminApi.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        let errorMessage = "Произошла неизвестная ошибка";

        if (error.response) {
            errorMessage = error.response.data?.detail || error.response.data?.message || `Ошибка ${error.response.status}`;
            
            // Не показываем toast для 401 ошибок (не авторизован)
            if (error.response.status === 401) {
                return Promise.reject(error);
            }
        } else if (error.request) {
            errorMessage = "Не удалось подключиться к серверу. Проверьте ваше интернет-соединение.";
        } else {
            errorMessage = error.message;
        }

        // Show a toast with the error message
        toast.error(errorMessage);

        return Promise.reject(error);
    }
);

// Add a response interceptor for global error handling
api.interceptors.response.use(
    (response) => {
        // Any status code that lie within the range of 2xx cause this function to trigger
        return response;
    },
    (error) => {
        // Any status codes that falls outside the range of 2xx cause this function to trigger
        let errorMessage = "Произошла неизвестная ошибка";

        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            errorMessage = error.response.data?.detail || error.response.data?.message || `Ошибка ${error.response.status}`;
            
            // Не показываем toast для 401 ошибок (не авторизован)
            if (error.response.status === 401) {
                return Promise.reject(error);
            }
        } else if (error.request) {
            // The request was made but no response was received
            errorMessage = "Не удалось подключиться к серверу. Проверьте ваше интернет-соединение.";
        } else {
            // Something happened in setting up the request that triggered an Error
            errorMessage = error.message;
        }

        // Show a toast with the error message
        toast.error(errorMessage);

        return Promise.reject(error);
    }
);


// ⚠️ УДАЛЕНО: Устаревшие методы ttsApi
// Используйте microservicesAPI из ./microservices.js вместо этого

export { adminApi };
export default api;
