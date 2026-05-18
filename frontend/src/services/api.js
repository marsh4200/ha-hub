import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ha-hub-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && !err.config?.url?.includes('/auth/')) {
      localStorage.removeItem('ha-hub-token');
      if (location.pathname !== '/login' && location.pathname !== '/setup') {
        location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
