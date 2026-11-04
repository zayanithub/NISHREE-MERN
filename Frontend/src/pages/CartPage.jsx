import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Minus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { useCart } from '../cart/useCart';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { formatPrice, productImage } from '../utils/format';

export default function CartPage() {
  const { user } = useAuth();
  const { cart, loading, error, updateQuantity, removeItem, refresh } = useCart();
  const [busyItem, setBusyItem] = useState('');

  const adjust = async (item, quantity) => {
    setBusyItem(item._id);
    try {
      if (quantity < 1) await removeItem(item._id);
      else await updateQuantity(item._id, Math.min(20, quantity));
    } catch (error) { toast.error(normalizeApiError(error).message); }
    finally { setBusyItem(''); }
  };

  if (loading) return <div className="page-loading"><LoadingState label="Opening your bag…" /></div>;
  if (error) return <div className="page-wrap cart-page"><ErrorState message={error} onRetry={refresh} /></div>;
  if (!cart?.items?.length) return <div className="page-wrap cart-page"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><span>Your bag</span></div><EmptyState title="Your bag is waiting." ><span>Explore the collection and find a piece that feels like yours.</span><Link to="/shop" className="button button-primary">Explore sarees <ArrowRight size={16} /></Link></EmptyState></div>;

  return <div className="page-wrap cart-page"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><span>Your bag</span></div>
    <div className="page-title-row"><div><span className="eyebrow">A thoughtful selection</span><h1>Your bag <span>({cart.totalQuantity})</span></h1></div><Link to="/shop" className="text-link">Continue exploring <ArrowRight size={15} /></Link></div>
    <div className="cart-layout"><section className="cart-items" aria-label="Items in your bag">{cart.items.map((item) => {
      const image = item.variant?.image?.url || productImage(item.product);
      return <article className={`cart-row${item.isAvailable ? '' : ' is-unavailable'}`} key={item._id}>
        <Link to={item.product?.slug ? `/products/${item.product.slug}` : '/shop'} className="cart-row-image">{image && <img src={image} alt={item.product?.name || 'Saree'} loading="lazy" decoding="async" width="180" height="220" />}</Link>
        <div className="cart-row-details"><span className="eyebrow">{item.product?.category?.name || 'Nishree Attire'}</span><Link to={item.product?.slug ? `/products/${item.product.slug}` : '/shop'} className="cart-row-title">{item.product?.name || 'Unavailable piece'}</Link>{item.variant && <small>{item.variant.name}{item.variant.color ? ` · ${item.variant.color}` : ''}</small>}
          {!item.isAvailable && <p className="availability-error">This quantity is no longer available. Update it or remove the piece to continue.</p>}
          <div className="cart-row-actions"><div className="quantity-control"><button type="button" disabled={item.quantity <= 1 || busyItem === item._id} onClick={() => adjust(item, item.quantity - 1)} aria-label={`Decrease quantity of ${item.product?.name}`}><Minus size={14} /></button><span>{item.quantity}</span><button type="button" disabled={item.quantity >= 20 || item.quantity >= item.availableQuantity || busyItem === item._id} onClick={() => adjust(item, item.quantity + 1)} aria-label={`Increase quantity of ${item.product?.name}`}><Plus size={14} /></button></div><button type="button" className="remove-text" disabled={busyItem === item._id} onClick={() => adjust(item, 0)}><Trash2 size={14} /> Remove</button></div>
        </div>
        <strong className="cart-row-price">{formatPrice(item.lineTotal, item.product?.currency)}</strong>
      </article>;
    })}</section>
      <aside className="cart-summary"><span className="eyebrow">Your order</span><h2>Order summary</h2><div className="summary-line"><span>Subtotal · {cart.itemCount} {cart.itemCount === 1 ? 'piece' : 'pieces'}</span><strong>{formatPrice(cart.subtotal)}</strong></div><p>Final pricing and any applicable offer are confirmed by the store at checkout.</p>{!user && <p className="guest-bag-note">Guest and account bags are stored separately. Sign-in loads your saved account bag; guest items are not merged.</p>}{!cart.canCheckout && <p className="summary-alert">Please resolve the availability note beside each item before continuing.</p>}<Link className={`button button-primary${cart.canCheckout ? '' : ' is-disabled'}`} to="/checkout" aria-disabled={!cart.canCheckout} onClick={(event) => { if (!cart.canCheckout) event.preventDefault(); }}>Continue to checkout <ArrowRight size={16} /></Link><Link className="text-link summary-back" to="/shop">Continue shopping <ArrowRight size={14} /></Link><button className="cart-refresh" type="button" onClick={refresh}>Refresh availability</button><p className="secure-note">Your bag is saved securely for this browser session.</p></aside>
    </div>
  </div>;
}
