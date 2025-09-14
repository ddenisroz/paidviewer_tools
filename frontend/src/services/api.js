// src/services/api.js
import axios from 'axios';
import { toast } from 'sonner';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    withCredentials: true,
});

// Add a request interceptor to set the token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
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


// TTS API functions
export const ttsApi = {
    // Получить статус TTS
    getStatus: async () => {
        const response = await api.get('/api/voices/tts/status');
        return response.data;
    },

    // Загрузить TTS движок
    loadEngine: async () => {
        console.log('API: Calling loadEngine endpoint...');
        try {
            const response = await api.post('/api/voices/tts/load');
            console.log('API: LoadEngine response:', response.data);
            return response.data;
        } catch (error) {
            console.error('API: LoadEngine error:', error);
            throw error;
        }
    },

    // Получить прогресс загрузки
    getProgress: async () => {
        const response = await api.get('/api/voices/tts/progress');
        return response.data;
    },

    // Принудительно перезагрузить TTS
    reloadEngine: async () => {
        const response = await api.post('/api/voices/tts/reload');
        return response.data;
    },

    // Выгрузить TTS из памяти
    unloadEngine: async () => {
        const response = await api.post('/api/voices/tts/unload');
        return response.data;
    },

    // Получить сообщения из чата
    getChatMessages: async () => {
        const response = await api.get('/api/chat/messages');
        return response.data;
    }
};

export default api;
