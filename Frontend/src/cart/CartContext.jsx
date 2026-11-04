import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cartApi, hydrateCart } from '../api/cartApi';
import { normalizeApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { CartContext } from './CartStore';

export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadedOwner, setLoadedOwner] = useState('');
  const [loadError, setLoadError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const ownerKey = user?.id || 'guest';

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try { setCart(await cartApi.get()); setLoadedOwner(ownerKey); }
    catch (error) { const message = normalizeApiError(error).message; setLoadError(message); setLoadedOwner(ownerKey); toast.error(message); }
    finally { setLoading(false); }
  }, [ownerKey]);

  useEffect(() => {
    if (authLoading) return undefined;
    let active = true;
    hydrateCart().then((nextCart) => {
      if (active) { setCart(nextCart); setLoadedOwner(ownerKey); setLoadError(''); }
    }).catch((error) => {
      if (active) { setLoadError(normalizeApiError(error).message); setLoadedOwner(ownerKey); }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [authLoading, ownerKey]);

  const addItem = useCallback(async (productId, quantity = 1, variantId) => {
    const updated = await cartApi.add(productId, quantity, variantId);
    setCart(updated);
    setDrawerOpen(true);
    toast.success('Added to your bag.');
    return updated;
  }, []);

  const updateQuantity = useCallback(async (itemId, quantity) => {
    const updated = await cartApi.update(itemId, quantity);
    setCart(updated);
    return updated;
  }, []);

  const removeItem = useCallback(async (itemId) => {
    const updated = await cartApi.remove(itemId);
    setCart(updated);
    toast.success('Removed from your bag.');
    return updated;
  }, []);

  const visibleLoading = authLoading || loading || loadedOwner !== ownerKey;
  const value = useMemo(() => ({
    cart,
    loading: visibleLoading,
    error: loadError,
    drawerOpen,
    setDrawerOpen,
    refresh,
    addItem,
    updateQuantity,
    removeItem,
    itemCount: visibleLoading ? 0 : cart?.totalQuantity || 0,
  }), [cart, visibleLoading, loadError, drawerOpen, refresh, addItem, updateQuantity, removeItem]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
