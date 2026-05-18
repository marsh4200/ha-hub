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
    const isUpdating = !!window.__hahubUpdating;
    const status = err?.response?.status;
    const url = err?.config?.url || '';

    // 1. Network error (server unreachable) — most likely an update is happening
    //    Don't redirect; let the caller deal with it / retry.
    if (!err.response) {
      return Promise.reject(err);
    }

    // 2. 401 during an update → DON'T redirect, just fail the call.
    //    The token is still valid; the API just restarted and there's a brief gap.
    if (status === 401 && isUpdating) {
      return Promise.reject(err);
    }

    // 3. Normal 401 — only kick to /login if this isn't an auth endpoint and
    //    no update is in progress.
    if (status === 401 && !url.includes('/auth/')) {
      localStorage.removeItem('ha-hub-token');
      if (location.pathname !== '/login' && location.pathname !== '/setup') {
        location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
