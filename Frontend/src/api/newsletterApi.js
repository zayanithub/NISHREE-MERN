import { api } from './client';

export const newsletterApi = {
  subscribe: (body, signal) => api.post('/newsletter', body, { signal }).then((response) => response.data),
};
