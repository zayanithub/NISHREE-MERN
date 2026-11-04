import { api } from './client';

export const customerApi = {
  wishlist: () => api.get('/wishlist').then((response) => response.data.wishlist),
  addToWishlist: (productId) => api.post('/wishlist/products', { productId }).then((response) => response.data.wishlist),
  removeFromWishlist: (productId) => api.delete(`/wishlist/products/${productId}`).then((response) => response.data.wishlist),
  addresses: () => api.get('/addresses').then((response) => response.data.addresses),
  createAddress: (body) => api.post('/addresses', body).then((response) => response.data.address),
  updateAddress: (id, body) => api.patch(`/addresses/${id}`, body).then((response) => response.data.address),
  setDefaultAddress: (id) => api.patch(`/addresses/${id}/default`).then((response) => response.data.address),
  deleteAddress: (id) => api.delete(`/addresses/${id}`).then((response) => response.data),
  orders: (params = {}) => api.get('/orders', { params }).then((response) => response.data),
  orderSummary: () => api.get('/orders/summary').then((response) => response.data.summary),
  order: (id) => api.get(`/orders/${id}`).then((response) => response.data.order),
  shipment: (orderId) => api.get(`/orders/${orderId}/shipment`).then((response) => response.data),
  createOrder: (body) => api.post('/orders', body).then((response) => response.data.order),
  cancelOrder: (id) => api.patch(`/orders/${id}/cancel`).then((response) => response.data.order),
  returns: (params = {}) => api.get('/returns', { params }).then((response) => response.data.data),
  createReturn: (body) => api.post('/returns', body).then((response) => response.data.data.returnRequest),
  uploadReturnEvidence: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return api.post('/returns/evidence', formData).then((response) => response.data.data.evidenceImages);
  },
  cancelReturn: (id) => api.patch(`/returns/${id}/cancel`).then((response) => response.data.data.returnRequest),
  exchanges: (params = {}) => api.get('/exchanges', { params }).then((response) => response.data.data),
  createExchange: (body) => api.post('/exchanges', body).then((response) => response.data.data.exchangeRequest),
  cancelExchange: (id) => api.patch(`/exchanges/${id}/cancel`).then((response) => response.data.data.exchangeRequest),
  validateCoupon: (code) => api.post('/coupons/validate', { code }).then((response) => response.data.data),
  notifications: (params = {}) => api.get('/notifications', { params }).then((response) => response.data.data),
  notificationPreferences: () => api.get('/notifications/preferences').then((response) => response.data.data.preferences),
  updateNotificationPreferences: (body) => api.patch('/notifications/preferences', body).then((response) => response.data.data.preferences),
  markNotificationRead: (id) => api.patch(`/notifications/${id}/read`).then((response) => response.data.data.notification),
  markAllNotificationsRead: () => api.patch('/notifications/read-all').then((response) => response.data.data),
  clearNotifications: () => api.delete('/notifications').then((response) => response.data.data),
  reviews: (params = {}) => api.get('/reviews/me', { params }).then((response) => response.data.data),
  createReview: (productId, body) => api.post(`/reviews/products/${productId}`, body).then((response) => response.data.data.review),
  updateReview: (id, body) => api.patch(`/reviews/me/${id}`, body).then((response) => response.data.data.review),
  deleteReview: (id) => api.delete(`/reviews/me/${id}`).then((response) => response.data.data),
};
