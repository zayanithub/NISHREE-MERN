import { api } from './client';

export const homepageApi = {
  images: (signal) => api.get('/homepage-images', { signal }).then((response) => response.data.images),
};
