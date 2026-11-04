export function currentCouponOffers(offers, now = Date.now()) {
  if (!Array.isArray(offers)) return [];

  return offers.filter((offer) => {
    const startsAt = Date.parse(offer?.startsAt);
    const expiresAt = Date.parse(offer?.expiresAt);
    return Number.isFinite(startsAt) && Number.isFinite(expiresAt) && startsAt <= now && expiresAt > now;
  });
}
