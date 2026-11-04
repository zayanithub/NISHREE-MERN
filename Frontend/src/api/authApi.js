import { api } from './client';

let refreshPromise = null;

export const authApi = {
  register: (body) => api.post('/auth/register', body).then((response) => response.data),
  login: (body) => api.post('/auth/login', body).then((response) => response.data),
  verifyLoginOtp: (body) => api.post('/auth/login/verify-otp', body).then((response) => response.data),
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
