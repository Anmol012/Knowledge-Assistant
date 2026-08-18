import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

export const TOKEN_KEYS = {
  access: 'rag_access',
  refresh: 'rag_refresh',
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEYS.access);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.includes('/auth/');
    if (error.response?.status === 401 && !original._retry && !isAuthCall) {
      original._retry = true;
      const refreshToken = localStorage.getItem(TOKEN_KEYS.refresh);
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/v1/auth/refresh', {
            refresh_token: refreshToken,
          });
          localStorage.setItem(TOKEN_KEYS.access, data.access_token);
          localStorage.setItem(TOKEN_KEYS.refresh, data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch (refreshError) {
          localStorage.removeItem(TOKEN_KEYS.access);
          localStorage.removeItem(TOKEN_KEYS.refresh);
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;