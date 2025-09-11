// src/services/api.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

// We will now attach the token dynamically inside a custom hook
// instead of using a static interceptor.

export default apiClient;
