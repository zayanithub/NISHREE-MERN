const STORAGE_KEY = 'nishree.recently-viewed.v1';
const MAX_RECENT_PRODUCTS = 8;

export function readRecentlyViewedSlugs() {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((slug) => typeof slug === 'string' && slug.trim()))]
      .slice(0, MAX_RECENT_PRODUCTS);
  } catch {
    return [];
  }
}

export function recordRecentlyViewedProduct(slug) {
  if (typeof window === 'undefined' || typeof slug !== 'string' || !slug.trim()) return;
  const normalizedSlug = slug.trim().toLowerCase();
  const next = [normalizedSlug, ...readRecentlyViewedSlugs().filter((item) => item !== normalizedSlug)]
    .slice(0, MAX_RECENT_PRODUCTS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing and storage restrictions should not block product pages.
  }
}
