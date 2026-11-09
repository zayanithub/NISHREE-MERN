import { api } from './client';

export const blogApi = {
  posts: (params = {}, signal) => api.get('/blogs', { params, signal }).then(({ data }) => data),
  post: (slug, signal) => api.get(`/blogs/${encodeURIComponent(slug)}`, { signal }).then(({ data }) => data),
};
