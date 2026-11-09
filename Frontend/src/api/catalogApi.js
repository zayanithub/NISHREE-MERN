import { api } from './client';

export const catalogApi = {
  products: (params = {}, signal) => api.get('/products', { params, signal }).then((response) => response.data),
  facets: (signal) => api.get('/products/facets', { signal }).then((response) => response.data),
  bestSellers: (params = {}, signal) => api.get('/products/best-sellers', { params, signal }).then((response) => response.data),
  product: (slug, signal) => api.get(`/products/${encodeURIComponent(slug)}`, { signal }).then((response) => response.data),
  categories: (params = {}, signal) => api.get('/categories', { params, signal }).then((response) => response.data),
  allCategories: async (signal) => {
    const firstPage = await api.get('/categories', { params: { page: 1, limit: 100 }, signal }).then((response) => response.data);
    const remainingPages = await Promise.all(
      Array.from({ length: Math.max(0, (firstPage.pagination?.totalPages || 1) - 1) }, (_, index) =>
        api.get('/categories', { params: { page: index + 2, limit: 100 }, signal }).then((response) => response.data.categories || [])
      ),
    );
    return {
      ...firstPage,
      categories: [...(firstPage.categories || []), ...remainingPages.flat()],
    };
  },
  category: (slug, signal) => api.get(`/categories/${encodeURIComponent(slug)}`, { signal }).then((response) => response.data),
  offers: (signal) => api.get('/coupons/offers', { signal }).then((response) => response.data),
  reviews: (slug, params = {}, signal) => api.get(`/products/${encodeURIComponent(slug)}/reviews`, { params, signal }).then((response) => response.data),
};
