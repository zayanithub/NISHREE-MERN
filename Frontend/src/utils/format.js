export const formatPrice = (amount, currency = 'INR') => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency,
  maximumFractionDigits: 0,
}).format(Number(amount) || 0);

export const productImage = (product) => product?.primaryImage?.url || product?.images?.find((image) => image.isPrimary)?.url || product?.images?.[0]?.url || '';

export const getErrorMessage = (error) => error?.message || 'Please try again in a moment.';

export const formatDate = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : '—';
