import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { customerApi } from '../api/customerApi';
import { normalizeApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { WishlistContext } from './WishlistStore';

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [wishlist, setWishlist] = useState(null);
  const [loadedOwner, setLoadedOwner] = useState('');
  const [loadError, setLoadError] = useState('');

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoadError('');
    try { setWishlist(await customerApi.wishlist()); setLoadedOwner(String(userId)); }
    catch (error) { setLoadError(normalizeApiError(error).message); toast.error(normalizeApiError(error).message); }
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    customerApi.wishlist().then((value) => {
      if (active) { setWishlist(value); setLoadedOwner(String(userId)); setLoadError(''); }
    }).catch((error) => {
      if (active) {
        setLoadedOwner(String(userId));
        setLoadError(normalizeApiError(error).message);
        toast.error(normalizeApiError(error).message);
      }
    });
    return () => { active = false; };
  }, [userId]);

  const currentWishlist = userId && loadedOwner === String(userId) ? wishlist : null;
  const loading = Boolean(userId && loadedOwner !== String(userId));
  const has = useCallback((productId) => Boolean(currentWishlist?.products?.some((item) => String(item.product?._id || item.product) === String(productId))), [currentWishlist]);
  const toggle = useCallback(async (productId) => {
    try {
      const updated = has(productId)
        ? await customerApi.removeFromWishlist(productId)
        : await customerApi.addToWishlist(productId);
      setWishlist(updated);
      setLoadedOwner(String(userId));
      setLoadError('');
      toast.success(has(productId) ? 'Removed from your saved pieces.' : 'Saved to your wishlist.');
      return updated;
    } catch (error) {
      toast.error(normalizeApiError(error).message);
      throw error;
    }
  }, [has, userId]);

  const error = userId && loadedOwner === String(userId) ? loadError : '';
  const value = useMemo(() => ({ wishlist: currentWishlist, loading, error, refresh, has, toggle }), [currentWishlist, loading, error, refresh, has, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
