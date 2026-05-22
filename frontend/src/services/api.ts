import axios from 'axios';

/**
 * - Si `VITE_API_URL` est défini (fichier .env), il est utilisé tel quel (tous modes).
 * - En **développement** sans `VITE_API_URL`, on utilise `/api` pour passer par le
 *   proxy Vite (`vite.config.ts` → backend). Évite « Network Error » si le backend
 *   n’est pas joignable sur une URL absolue ou si le port diffère.
 * - En **production** sans variable, repli sur localhost:5000 (build local / preview).
 */
function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.length > 0) return t.replace(/\/+$/, '');
  }
  if (import.meta.env.DEV) {
    return '/api';
  }
  return 'http://127.0.0.1:5000/api';
}

const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the JWT token in headers
api.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData && config.headers) {
      delete (config.headers as Record<string, unknown>)['Content-Type'];
    }
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle unauthorized errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = String(error.config?.url ?? "");
    const isAuthAttempt =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/logout") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/reset-password");
    if (status === 401 && !isAuthAttempt) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      localStorage.removeItem("id_role");
      const path = window.location.pathname || "";
      if (
        !path.startsWith("/login") &&
        !path.startsWith("/register") &&
        !path.startsWith("/forgot-password") &&
        !path.startsWith("/reset-password")
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
