import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from '../cart/useCart';
import { ErrorState, EmptyState, LoadingState } from '../components/States';
import { useWishlist } from '../wishlist/useWishlist';
import { formatPrice, productImage } from '../utils/format';

const getCartMatch = (cart, productId, variantId) => cart?.items?.find((item) => (
  String(item.product?._id) === String(productId)
  && String(item.variant?._id || '') === String(variantId || '')
));

export default function WishlistPage() {
  const { wishlist, loading, error, refresh, toggle } = useWishlist();
  const { cart, addItem, setDrawerOpen } = useCart();
  const navigate = useNavigate();
  const [busyProduct, setBusyProduct] = useState('');
  const [removingProduct, setRemovingProduct] = useState('');
  const [selectedVariants, setSelectedVariants] = useState({});
  const products = wishlist?.products?.map((entry) => entry.product).filter(Boolean) || [];

  const purchase = async (product, buyNow = false) => {
    const productId = String(product._id);
    const selectedVariantId = selectedVariants[productId] || '';
    const variant = product.variants?.find((item) => String(item._id) === selectedVariantId);
    if (product.variants?.length && !variant) {
      toast.info('Choose a colour or blouse option before adding this piece to your bag.');
      return;
    }
    const availableQuantity = Number(variant?.availableQuantity ?? product.availableQuantity ?? 0);
    if (availableQuantity < 1) {
      toast.error('This option is currently out of stock.');
      return;
    }

    setBusyProduct(productId);
    try {
      await addItem(product._id, 1, variant?._id);
      if (buyNow) {
        setDrawerOpen(false);
        navigate('/checkout');
      }
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'This piece could not be added to your bag.');
    } finally {
      setBusyProduct('');
    }
  };

  const remove = async (product) => {
    setBusyProduct(String(product._id));
    setRemovingProduct(String(product._id));
    try {
      await toggle(product._id);
    } catch {
      setRemovingProduct('');
    } finally {
      setBusyProduct('');
    }
  };

  if (loading) return <div className="page-loading"><LoadingState label="Finding your saved pieces…" /></div>;

  return (
    <div className="page-wrap wishlist-page account-wishlist-page">
      <div className="breadcrumbs"><Link to="/account">My account</Link><span>/</span><span>Favorites</span></div>
      <div className="page-title-row">
        <div><span className="eyebrow">Pieces you have saved</span><h1>Your wishlist <Heart size={22} aria-hidden="true" /></h1><p className="wishlist-intro">Keep your favourites close, check current availability and add the right option to your bag whenever you’re ready.</p></div>
        <Link to="/shop" className="text-link">Explore more <ArrowRight size={15} /></Link>
      </div>
      {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : products.length ? (
        <div className="wishlist-account-list">
          {products.map((product) => {
            const image = productImage(product);
            const productId = String(product._id);
            const variants = product.variants || [];
            const selectedVariantId = selectedVariants[productId] || '';
            const selectedVariant = variants.find((variant) => String(variant._id) === selectedVariantId);
            const availableQuantity = Number(selectedVariant?.availableQuantity ?? product.availableQuantity ?? 0);
            const price = Number(selectedVariant?.finalPrice ?? product.salePrice ?? product.basePrice ?? 0);
            const listPrice = Number(product.basePrice || 0) + Number(selectedVariant?.priceAdjustment || 0);
            const discount = listPrice > price ? Math.round((listPrice - price) / listPrice * 100) : 0;
            const cartMatch = getCartMatch(cart, product._id, selectedVariant?._id);
            return (
              <article className={`wishlist-account-card${removingProduct === productId ? ' is-removing' : ''}`} key={product._id}>
                <Link to={`/products/${product.slug}`} className="wishlist-account-image" aria-label={`View ${product.name}`}>
                  {image ? <img src={image} alt={product.imageAltText || product.name} loading="lazy" decoding="async" /> : <span aria-hidden="true">N</span>}
                </Link>
                <div className="wishlist-account-copy">
                  <span className="eyebrow">{product.material || product.category?.name || 'NISHREE ATTIRE'}</span>
                  <Link to={`/products/${product.slug}`} className="wishlist-account-name">{product.name}</Link>
                  <div className="wishlist-price-line"><strong>{formatPrice(price, product.currency)}</strong>{listPrice > price && <del>{formatPrice(listPrice, product.currency)}</del>}{discount > 0 && <span>{discount}% off</span>}</div>
                  <span className={`wishlist-availability${availableQuantity > 0 ? ' is-available' : ''}`}>{availableQuantity > 0 ? `${availableQuantity} available · ready to order` : 'Currently out of stock'}</span>
                  {variants.length > 0 && <label className="wishlist-variant-field">Choose a colour / option
                    <select value={selectedVariantId} onChange={(event) => setSelectedVariants((current) => ({ ...current, [productId]: event.target.value }))}>
                      <option value="">Select an option</option>
                      {variants.map((variant) => <option key={variant._id} value={variant._id} disabled={!variant.availableQuantity}>{variant.name}{variant.color ? ` · ${variant.color}` : ''}{variant.blouseOption ? ` · ${variant.blouseOption.replaceAll('_', ' ')}` : ''}{variant.availableQuantity ? '' : ' · Out of stock'}</option>)}
                    </select>
                  </label>}
                  {cartMatch && <span className="wishlist-cart-indicator"><Check size={14} aria-hidden="true" /> In your bag · quantity {cartMatch.quantity}</span>}
                </div>
                <div className="wishlist-account-actions">
                  <button type="button" className="button button-primary" onClick={() => void purchase(product)} disabled={busyProduct === productId || availableQuantity < 1 || Boolean(variants.length && !selectedVariant)}>
                    <ShoppingBag size={15} aria-hidden="true" />{busyProduct === productId ? 'Adding…' : cartMatch ? 'Add another' : 'Add to bag'}
                  </button>
                  <button type="button" className="button button-buy-now" onClick={() => void purchase(product, true)} disabled={busyProduct === productId || availableQuantity < 1 || Boolean(variants.length && !selectedVariant)}>
                    {busyProduct === productId ? 'Please wait…' : 'Buy now'} <ArrowRight size={14} aria-hidden="true" />
                  </button>
                  <button type="button" className="wishlist-remove-button" onClick={() => void remove(product)} disabled={busyProduct === productId}>
                    <Trash2 size={15} aria-hidden="true" /><span>Remove</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title="A little space for the pieces you love.">
          <span>Save a piece from the collection and it will be waiting here for you.</span>
          <Link to="/shop" className="button button-primary">Explore the collection <ArrowRight size={15} /></Link>
        </EmptyState>
      )}
    </div>
  );
}
