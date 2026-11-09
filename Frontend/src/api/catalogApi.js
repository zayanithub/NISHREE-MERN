import { api } from './client';

export const catalogApi = {
  products: (params = {}, signal) => api.get('/products', { params, signal }).then((response) => response.data),
  facets: (signal) => api.get('/products/facets', { signal }).then((response) => response.data),
  bestSellers: (params = {}, signal) => api.get('/products/best-sellers', { params, signal }).then((response) => response.data),
  product: (slug, signal) => api.get(`/products/${encodeURIComponent(slug)}`, { signal }).then((response) => response.data),
  categories: (params = {}, signal) => api.get('/categories', { params, signal }).then((response) => response.data),
  category: (slug, signal) => api.get(`/categories/${encodeURIComponent(slug)}`, { signal }).then((response) => response.data),
  offers: (signal) => api.get('/coupons/offers', { signal }).then((response) => response.data),
  reviews: (slug, params = {}, signal) => api.get(`/products/${encodeURIComponent(slug)}/reviews`, { params, signal }).then((response) => response.data),
};
