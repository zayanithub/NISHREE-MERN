const CHENNAI_PIN_START = 600001;
const CHENNAI_PIN_END = 600119;
const TAMIL_NADU_PIN_START = 600001;
const TAMIL_NADU_PIN_END = 643253;

export function getTamilNaduDeliveryEstimate(postalCode, city = '', state = '') {
  const pin = Number(String(postalCode || '').trim());
  if (!/^\d{6}$/.test(String(postalCode || '').trim())) return null;

  const normalizedState = state.trim().toLowerCase();
  if (normalizedState && !['tamil nadu', 'tamilnadu', 'tn'].includes(normalizedState)) {
    return null;
  }

  if (pin >= CHENNAI_PIN_START && pin <= CHENNAI_PIN_END) {
    return {
      region: 'Chennai',
      days: '2–3 days',
      message: 'Estimated delivery in Chennai: 2–3 days. Final PIN-code serviceability is confirmed at dispatch.',
    };
  }

  if (pin >= TAMIL_NADU_PIN_START && pin <= TAMIL_NADU_PIN_END) {
    return {
      region: city.trim() || 'Tamil Nadu',
      days: '4–5 days',
      message: 'Estimated delivery to other Tamil Nadu districts: 4–5 days. Final PIN-code serviceability is confirmed at dispatch.',
    };
  }

  return null;
}
