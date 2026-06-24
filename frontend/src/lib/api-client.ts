import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

let getToken: (() => string | null) | null = null;
let logoutFn: (() => void) | null = null;

export function setAuthStoreRefs(getTokenFn: () => string | null, logout: () => void) {
  getToken = getTokenFn;
  logoutFn = logout;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = getToken?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      logoutFn?.();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export { apiClient };
