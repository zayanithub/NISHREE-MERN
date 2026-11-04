import axios from 'axios';

const apiBaseURL = import.meta.env.PROD
  ? '/api/v1'
  : import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const api = axios.create({
  baseURL: apiBaseURL.replace(/\/$/, ''),
  withCredentials: true,
  headers: { Accept: 'application/json' },
  timeout: 20000,
});

let accessToken = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

export function normalizeApiError(error) {
  const response = error?.response;
  const payload = response?.data;
  let message = payload?.message || error?.message || 'Something went wrong. Please try again.';
  let fields = [];

  if (typeof message === 'string' && message.startsWith('[')) {
    try {
      fields = JSON.parse(message);
      message = fields.map((item) => item.message).filter(Boolean).join(' ');
    } catch {
      // Keep the server's original message when it is not a validation list.
    }
  }

  return {
    message: message || 'Something went wrong. Please try again.',
    status: response?.status ?? null,
    fields,
    isNetworkError: !response,
  };
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const message = String(error.response?.data?.message || '').toLowerCase();
    const errorCode = error.response?.data?.code;
    const isAuthEndpoint = /\/auth(?:\/|$)/.test(config?.url || '');
    const requiresAuthentication = [
      'AUTHENTICATION_REQUIRED',
      'ACCESS_TOKEN_INVALID',
      'CUSTOMER_AUTHENTICATION_REQUIRED',
    ].includes(errorCode) ||
      message.includes('authentication required') ||
      (message.includes('access token') && (message.includes('expired') || message.includes('invalid')));

    if (!config || config.__sessionRetry || isAuthEndpoint || error.response?.status !== 401 || !requiresAuthentication) {
      return Promise.reject(error);
    }

    config.__sessionRetry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${apiBaseURL.replace(/\/$/, '')}/auth/refresh`, {}, { withCredentials: true, timeout: 20000 })
          .then(({ data, status }) => {
            if (status === 204 || !data?.accessToken) {
              setAccessToken(null);
              return null;
            }
            setAccessToken(data.accessToken);
            window.dispatchEvent(new CustomEvent('nishree:session-refreshed', { detail: data }));
            return data.accessToken;
          })
          .finally(() => { refreshPromise = null; });
      }

      const refreshedToken = await refreshPromise;
      if (!refreshedToken) {
        setAccessToken(null);
        window.dispatchEvent(new Event('nishree:session-expired'));
        return Promise.reject(error);
      }
      return api(config);
    } catch {
      setAccessToken(null);
      window.dispatchEvent(new Event('nishree:session-expired'));
      return Promise.reject(error);
    }
  },
);

export const unwrapData = (response) => response.data;
