import { api } from './client';

let hydrationPromise = null;

export const hydrateCart = () => {
  if (!hydrationPromise) {
    hydrationPromise = api.get('/cart').then((response) => response.data.cart).finally(() => { hydrationPromise = null; });
  }
  return hydrationPromise;
};

export const cartApi = {
  get: () => api.get('/cart').then((response) => response.data.cart),
  add: (product, quantity = 1, variant) => api.post('/cart/items', { product, quantity, ...(variant ? { variant } : {}) }).then((response) => response.data.cart),
  update: (itemId, quantity) => api.patch(`/cart/items/${itemId}`, { quantity }).then((response) => response.data.cart),
  remove: (itemId) => api.delete(`/cart/items/${itemId}`).then((response) => response.data.cart),
  clear: () => api.delete('/cart').then((response) => response.data.cart),
};
