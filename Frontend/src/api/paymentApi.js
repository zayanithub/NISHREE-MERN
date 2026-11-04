import { api } from './client';

export const paymentApi = {
  createRazorpayOrder: (orderId, idempotencyKey) => api.post('/payments/razorpay/order', { orderId }, { headers: { 'Idempotency-Key': idempotencyKey } }).then((response) => response.data),
  verifyRazorpayPayment: (body) => api.post('/payments/razorpay/verify', body).then((response) => response.data),
};
