import axios from 'axios';
import { api } from '../api/client';

const baseURL = `${api.defaults.baseURL.replace(/\/$/, '')}/admin`;
const http = axios.create({ baseURL, withCredentials: true, timeout: 20000, headers: { Accept: 'application/json' } });
let accessToken = null;
let refreshPromise = null;
let sessionRestorePromise = null;

export const setAdminAccessToken = (token) => { accessToken = token || null; };

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

http.interceptors.response.use((response) => response, async (error) => {
  const config = error.config;
  const url = String(config?.url || '');
  if (error.response?.status !== 401 || !config || config.__adminRetried || url.includes('/auth/')) throw error;
  config.__adminRetried = true;
  try {
    refreshPromise ||= http.post('/auth/refresh').then(({ data, status }) => {
      if (status === 204) {
        setAdminAccessToken(null);
        return null;
      }
      setAdminAccessToken(data.accessToken);
      window.dispatchEvent(new CustomEvent('nishree:admin-session-refreshed', { detail: { admin: data.admin } }));
      return data.accessToken;
    }).finally(() => { refreshPromise = null; });
    const token = await refreshPromise;
    if (!token) throw error;
    config.headers.Authorization = `Bearer ${token}`;
    return http(config);
  } catch (refreshError) {
    setAdminAccessToken(null);
    window.dispatchEvent(new Event('nishree:admin-session-expired'));
    throw refreshError;
  }
});

const data = (request) => request.then((response) => response.data);
const createBlogPayload = (fields, image) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (['contentBlocks', 'tags'].includes(key)) form.append(key, JSON.stringify(value));
    else form.append(key, value == null ? '' : String(value));
  }
  if (image) form.append('image', image);
  return form;
};

export const adminApi = {
  login: (body) => data(http.post('/auth/login', body)),
  verifyLoginOtp: (body) => data(http.post('/auth/login/verify-otp', body)),
  resendLoginOtp: (body) => data(http.post('/auth/login/resend-otp', body)),
  refresh: () => http.post('/auth/refresh').then((response) => response.status === 204 ? null : response.data),
  logout: () => data(http.post('/auth/logout')),
  me: () => data(http.get('/auth/me')),
  overview: (params = {}) => data(http.get('/dashboard/overview', { params })).then((result) => result.data),
  sales: (params = {}) => data(http.get('/dashboard/sales', { params })).then((result) => result.data),
  products: (params = {}) => data(http.get('/products', { params })),
  productImageCompletion: (params = {}) => data(http.get('/products/image-completion', { params })),
  product: (id) => data(http.get(`/products/${id}`)).then((result) => result.product),
  createProduct: (body) => data(http.post('/products', body)).then((result) => result.product),
  updateProduct: (id, body) => data(http.patch(`/products/${id}`, body)).then((result) => result.product),
  updateProductStatus: (id, status) => data(http.patch(`/products/${id}/status`, { status })),
  deleteProduct: (id) => data(http.delete(`/products/${id}`)),
  uploadProductImages: (id, formData, onUploadProgress) => data(http.post(`/products/${id}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000, onUploadProgress })),
  productImages: (id) => data(http.get(`/products/${id}/images`)).then((result) => result.images || []),
  setPrimaryProductImage: (productId, imageId) => data(http.patch(`/products/${productId}/images/${imageId}/primary`)),
  reorderProductImages: (productId, imageIds) => data(http.patch(`/products/${productId}/images/order`, { imageIds })).then((result) => result.images || []),
  deleteProductImage: (productId, imageId) => data(http.delete(`/products/${productId}/images/${imageId}`)),
  removePrimaryProductImage: (productId) => data(http.delete(`/products/${productId}/primary-image`)),
  categories: (params = {}) => data(http.get('/categories', { params })),
  allCategories: async () => {
    const firstPage = await data(http.get('/categories', { params: { page: 1, limit: 100 } }));
    const remainingPages = await Promise.all(
      Array.from({ length: Math.max(0, (firstPage.pagination?.totalPages || 1) - 1) }, (_, index) =>
        data(http.get('/categories', { params: { page: index + 2, limit: 100 } })).then((result) => result.categories || [])
      ),
    );
    return {
      ...firstPage,
      categories: [...(firstPage.categories || []), ...remainingPages.flat()],
    };
  },
  createCategory: (body) => data(http.post('/categories', body)),
  updateCategory: (id, body) => data(http.patch(`/categories/${id}`, body)),
  updateCategoryStatus: (id, isActive) => data(http.patch(`/categories/${id}/status`, { isActive })),
  deleteCategory: (id) => data(http.delete(`/categories/${id}`)),
  inventory: (params = {}) => data(http.get('/inventory', { params })),
  inventoryByProduct: (id) => data(http.get(`/inventory/product/${id}`)),
  createInventory: (body) => data(http.post('/inventory', body)),
  adjustInventory: (id, adjustment) => data(http.patch(`/inventory/${id}/adjust`, { adjustment })),
  orders: (params = {}) => data(http.get('/orders', { params })),
  order: (id) => data(http.get(`/orders/${id}`)).then((result) => result.order),
  updateOrderStatus: (id, status) => data(http.patch(`/orders/${id}/status`, { status })).then((result) => result.order),
  shipments: (params = {}) => data(http.get('/shipping', { params })).then((result) => result.data),
  eligibleShipmentOrders: (params = {}) => data(http.get('/shipping/eligible-orders', { params })).then((result) => result.data),
  createShipment: (body) => data(http.post('/shipping', body)).then((result) => result.data.shipment),
  updateShipment: (id, body) => data(http.patch(`/shipping/${id}`, body)).then((result) => result.data.shipment),
  updateShipmentStatus: (id, status, details = {}) => data(http.patch(`/shipping/${id}/status`, { status, ...details })).then((result) => result.data.shipment),
  customers: (params = {}) => data(http.get('/customers', { params })),
  customer: (id) => data(http.get(`/customers/${id}`)),
  settings: () => data(http.get('/settings')).then((result) => result.settings),
  updateSettings: (body) => data(http.patch('/settings', body)).then((result) => result.settings),
  homepageImages: () => data(http.get('/homepage-images')).then((result) => result.images),
  uploadHomepageImages: (formData) => data(http.post('/homepage-images', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })).then((result) => result.images),
  updateHomepageImage: (id, formData) => data(http.patch(`/homepage-images/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })),
  reorderHomepageImages: (body) => data(http.patch('/homepage-images/reorder', body)).then((result) => result.images),
  deleteHomepageImage: (id) => data(http.delete(`/homepage-images/${id}`)),
  blogPosts: (params = {}) => data(http.get('/blogs', { params })),
  blogPost: (id) => data(http.get(`/blogs/${id}`)).then((result) => result.post),
  uploadBlogMedia: (image) => {
    const form = new FormData();
    form.append('image', image);
    return data(http.post('/blogs/media', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })).then((result) => result.image);
  },
  createBlogPost: (body, image) => data(http.post('/blogs', createBlogPayload(body, image), { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })).then((result) => result.post),
  updateBlogPost: (id, body, image) => data(http.patch(`/blogs/${id}`, createBlogPayload(body, image), { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })).then((result) => result),
  deleteBlogPost: (id) => data(http.delete(`/blogs/${id}`)),
  coupons: (params = {}) => data(http.get('/coupons', { params })).then((result) => result.data),
  createCoupon: (body) => data(http.post('/coupons', body)).then((result) => result.data.coupon),
  updateCoupon: (id, body) => data(http.patch(`/coupons/${id}`, body)).then((result) => result.data.coupon),
  updateCouponStatus: (id, isActive) => data(http.patch(`/coupons/${id}/status`, { isActive })).then((result) => result.data.coupon),
  deleteCoupon: (id) => data(http.delete(`/coupons/${id}`)),
  returnRequests: (params = {}) => data(http.get('/returns', { params })).then((result) => result.data),
  reviewReturn: (id, body) => data(http.patch(`/returns/${id}/review`, body)).then((result) => result.data.returnRequest),
  updateReturnWorkflow: (id, body) => data(http.patch(`/returns/${id}/workflow`, body)).then((result) => result.data.returnRequest),
  exchangeRequests: (params = {}) => data(http.get('/exchanges', { params })).then((result) => result.data),
  reviewExchange: (id, body) => data(http.patch(`/exchanges/${id}/review`, body)).then((result) => result.data.exchangeRequest),
  updateExchangeWorkflow: (id, body) => data(http.patch(`/exchanges/${id}/workflow`, body)).then((result) => result.data.exchangeRequest),
  settleExchangePriceDifference: (id, body) => data(http.patch(`/exchanges/${id}/price-difference`, body)).then((result) => result.data.exchangeRequest),
  refunds: (params = {}) => data(http.get('/refunds', { params })).then((result) => result.data),
  createRefundForReturn: (returnId) => data(http.post(`/refunds/returns/${returnId}`)).then((result) => result.data.refund),
  approveRefund: (id) => data(http.patch(`/refunds/${id}/approve`)).then((result) => result.data.refund),
  rejectRefund: (id, body) => data(http.patch(`/refunds/${id}/reject`, body)).then((result) => result.data.refund),
  processRefund: (id, body = {}) => data(http.post(`/refunds/${id}/process`, body)).then((result) => result.data.refund),
};

export async function restoreAdminSession() {
  if (!sessionRestorePromise) {
    sessionRestorePromise = adminApi.refresh()
      .then((session) => {
        if (!session) {
          setAdminAccessToken(null);
          return null;
        }
        setAdminAccessToken(session.accessToken);
        return session.admin || null;
      })
      .catch((error) => {
        setAdminAccessToken(null);
        console.error('Admin session restore failed:', error.message);
        return null;
      })
      .finally(() => { sessionRestorePromise = null; });
  }
  return sessionRestorePromise;
}
