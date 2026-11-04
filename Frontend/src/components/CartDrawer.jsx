import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Minus, Plus, Trash2, X } from 'lucide-react';
import { useCart } from '../cart/useCart';
import { formatPrice, productImage } from '../utils/format';
import { ErrorState } from './States';
import { toast } from 'sonner';
import { normalizeApiError } from '../api/client';

export default function CartDrawer() {
  const { cart, loading, error, drawerOpen, setDrawerOpen, updateQuantity, removeItem, refresh } = useCart();
  const closeRef = useRef(null);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previous = document.activeElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDrawerOpen(false);
      if (event.key === 'Tab') {
        const panel = document.querySelector('.cart-drawer-panel');
        const focusable = panel?.querySelectorAll('button:not(:disabled), a[href], input') || [];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [drawerOpen, setDrawerOpen]);

  if (!drawerOpen) return null;

  const changeQuantity = async (item, next) => {
    try {
      if (next < 1) await removeItem(item._id);
      else await updateQuantity(item._id, Math.min(20, next));
    } catch (error) { toast.error(normalizeApiError(error).message); }
  };

  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false); }}>
    <aside className="cart-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <header className="drawer-heading"><div><span className="eyebrow">Nishree Attire</span><h2 id="drawer-title">Your bag <span>({cart?.totalQuantity || 0})</span></h2></div><button ref={closeRef} className="icon-button" type="button" onClick={() => setDrawerOpen(false)} aria-label="Close shopping bag"><X size={19} /></button></header>
      {loading ? <div className="drawer-loading">Updating your bag…</div> : error ? <ErrorState message={error} onRetry={refresh} /> : cart?.items?.length ? <>
        <div className="drawer-items">{cart.items.map((item) => {
          const src = item.variant?.image?.url || productImage(item.product);
          return <div className="drawer-item" key={item._id}>
            <Link to={`/products/${item.product?.slug}`} onClick={() => setDrawerOpen(false)} className="drawer-item-image">{src && <img src={src} alt="" loading="lazy" width="90" height="110" />}</Link>
            <div className="drawer-item-copy"><Link to={`/products/${item.product?.slug}`} onClick={() => setDrawerOpen(false)}>{item.product?.name || 'Unavailable piece'}</Link>{item.variant?.name && <small>{item.variant.name}{item.variant.color ? ` · ${item.variant.color}` : ''}</small>}<span>{formatPrice(item.unitPrice, item.product?.currency)}</span><div className="quantity-control compact"><button type="button" onClick={() => changeQuantity(item, item.quantity - 1)} aria-label="Decrease quantity"><Minus size={13} /></button><span>{item.quantity}</span><button type="button" disabled={item.quantity >= 20 || item.quantity >= item.availableQuantity} onClick={() => changeQuantity(item, item.quantity + 1)} aria-label="Increase quantity"><Plus size={13} /></button></div></div>
            <button type="button" className="icon-button remove-item" onClick={async () => { try { await removeItem(item._id); } catch (error) { toast.error(normalizeApiError(error).message); } }} aria-label={`Remove ${item.product?.name || 'item'}`}><Trash2 size={16} /></button>
          </div>;
        })}</div>
        <div className="drawer-summary"><div className="summary-line"><span>Subtotal</span><strong>{formatPrice(cart.subtotal)}</strong></div><p>Delivery and any applicable offer are confirmed at checkout.</p><Link to="/bag" className="button button-outline" onClick={() => setDrawerOpen(false)}>View bag</Link><Link to="/checkout" className={`button button-primary${cart.canCheckout ? '' : ' is-disabled'}`} aria-disabled={!cart.canCheckout} onClick={(event) => { if (!cart.canCheckout) event.preventDefault(); else setDrawerOpen(false); }}>Continue to checkout<ArrowRight size={16} /></Link></div>
      </> : <div className="drawer-empty"><span className="eyebrow">Something beautiful, perhaps?</span><h3>Your bag is waiting.</h3><p>Explore the collection and find a piece that feels like yours.</p><Link to="/shop" className="button button-primary" onClick={() => setDrawerOpen(false)}>Explore sarees<ArrowRight size={15} /></Link></div>}
    </aside>
  </div>;
}
