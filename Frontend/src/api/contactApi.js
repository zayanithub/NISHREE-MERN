import { api } from './client';

export const contactApi = {
  sendMessage: (body) => api.post('/contact', body).then((response) => response.data),
};
