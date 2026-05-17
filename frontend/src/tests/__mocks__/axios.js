// frontend/src/tests/__mocks__/axios.js
import axios from 'axios';

// Мокаем axios
const mockAxios = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    create: jest.fn(() => mockAxios),
    defaults: {
        baseURL: process.env.VITE_API_BASE_URL || 'http://localhost:8000',
        headers: {
            'Content-Type': 'application/json',
        },
    },
    interceptors: {
        request: {
            use: jest.fn(),
            eject: jest.fn(),
        },
        response: {
            use: jest.fn(),
            eject: jest.fn(),
        },
    },
};

// Устанавливаем мок по умолчанию
jest.mock('axios', () => mockAxios);

export default mockAxios;
