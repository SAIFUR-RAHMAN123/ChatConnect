import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

export const TOKEN_KEY = 'chatconnect_token';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// AuthContext registers a callback so an expired/invalid token logs the user out
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthCall = /\/auth\/(login|register)/.test(err.config?.url || '');
    if (err.response?.status === 401 && !isAuthCall && onUnauthorized) onUnauthorized();
    return Promise.reject(err);
  }
);

// Turns any axios/network error into a user-friendly message
export const getErrorMessage = (err) => {
  if (err.response?.data?.message) return err.response.data.message;
  if (err.code === 'ERR_NETWORK' || !err.response) return 'Network error. Please check your connection and try again.';
  return 'Something went wrong. Please try again.';
};

export default api;
