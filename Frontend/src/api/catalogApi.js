import { api } from './client';

const allCategoriesCacheDuration = 60_000;
let allCategoriesCache;
let allCategoriesCachedAt = 0;
let allCategoriesRequest;

async function fetchAllCategories() {
  const firstPage = await api.get('/categories', { params: { page: 1, limit: 100 } }).then((response) => response.data);
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, (firstPage.pagination?.totalPages || 1) - 1) }, (_, index) =>
      api.get('/categories', { params: { page: index + 2, limit: 100 } }).then((response) => response.data.categories || [])
    ),
  );
  return {
    ...firstPage,
    categories: [...(firstPage.categories || []), ...remainingPages.flat()],
  };
}

export const catalogApi = {
  products: (params = {}, signal) => api.get('/products', { params, signal }).then((response) => response.data),
  facets: (signal) => api.get('/products/facets', { signal }).then((response) => response.data),
  bestSellers: (params = {}, signal) => api.get('/products/best-sellers', { params, signal }).then((response) => response.data),
  product: (slug, signal) => api.get(`/products/${encodeURIComponent(slug)}`, { signal }).then((response) => response.data),
  categories: (params = {}, signal) => api.get('/categories', { params, signal }).then((response) => response.data),
  allCategories: (signal) => {
    if (signal?.aborted) {
      return Promise.reject(Object.assign(new Error('The category request was canceled.'), { name: 'AbortError' }));
    }

    if (allCategoriesCache && Date.now() - allCategoriesCachedAt < allCategoriesCacheDuration) {
      return Promise.resolve(allCategoriesCache);
    }

    if (!allCategoriesRequest) {
      allCategoriesRequest = fetchAllCategories()
        .then((result) => {
          allCategoriesCache = result;
          allCategoriesCachedAt = Date.now();
          return result;
        })
        .finally(() => {
          allCategoriesRequest = undefined;
        });
    }

    return allCategoriesRequest.then((result) => {
      if (signal?.aborted) {
        throw Object.assign(new Error('The category request was canceled.'), { name: 'AbortError' });
      }
      return result;
    });
  },
  category: (slug, signal) => api.get(`/categories/${encodeURIComponent(slug)}`, { signal }).then((response) => response.data),
  offers: (signal) => api.get('/coupons/offers', { signal }).then((response) => response.data),
  reviews: (slug, params = {}, signal) => api.get(`/products/${encodeURIComponent(slug)}/reviews`, { params, signal }).then((response) => response.data),
};
