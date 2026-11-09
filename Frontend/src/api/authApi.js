import { api } from './client';

let refreshPromise = null;

export const authApi = {
  googleStatus: () => api.get('/auth/google/status').then((response) => response.data),
  googleChallenge: (challengeId) => api.get(`/auth/google/challenge/${challengeId}`).then((response) => response.data),
  resendGoogleOtp: (body) => api.post('/auth/google/resend-otp', body).then((response) => response.data),
  verifyGoogleOtp: (body) => api.post('/auth/google/verify-otp', body).then((response) => response.data),
  startGoogleLogin: (returnTo) => {
    const query = new URLSearchParams({ returnTo });
    window.location.assign(`${api.defaults.baseURL}/auth/google?${query}`);
  },
  register: (body) => api.post('/auth/register', body).then((response) => response.data),
  resendRegistrationOtp: (body) => api.post('/auth/register/resend-otp', body).then((response) => response.data),
  login: (body) => api.post('/auth/login', body).then((response) => response.data),
  verifyRegistrationEmail: (body) => api.post('/auth/register/verify-email', body).then((response) => response.data),
  requestPasswordReset: (body) => api.post('/auth/forgot-password', body).then((response) => response.data),
  verifyPasswordResetOtp: (body) => api.post('/auth/forgot-password/verify-otp', body).then((response) => response.data),
  resetPassword: (body) => api.post('/auth/forgot-password/reset', body).then((response) => response.data),
  refresh: () => {
    if (!refreshPromise) {
      refreshPromise = api.post('/auth/refresh').then((response) => response.data).finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  },
  logout: () => api.post('/auth/logout').then((response) => response.data),
  me: () => api.get('/auth/me').then((response) => response.data),
  updateProfileImage: (formData) => api.post('/auth/me/profile-image', formData).then((response) => response.data),
  removeProfileImage: () => api.delete('/auth/me/profile-image').then((response) => response.data),
};
