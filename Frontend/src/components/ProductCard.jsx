import { useState } from 'react';
import { ArrowUpRight, Heart } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { useCart } from '../cart/useCart';
import { useWishlist } from '../wishlist/useWishlist';
import { formatPrice, productImage } from '../utils/format';

export default function ProductCard({ product, index = 0 }) {
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const { addItem } = useCart();
  const { has, toggle } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const image = productImage(product);
  const currentPrice = product.salePrice ?? product.basePrice;
  const isSaved = has(product._id);
  const isNewArrival = product.tags?.includes('new-arrival');
  const isFeatured = !isNewArrival && Boolean(product.isFeatured);
  const discountPercent = product.salePrice != null && product.salePrice < product.basePrice
    ? Math.round((1 - product.salePrice / product.basePrice) * 100)
    : 0;
  const availableQuantity = Number(product.availableQuantity || 0);
  const isAvailable = availableQuantity > 0;

  const save = async () => {
    if (!user) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    try { await toggle(product._id); } catch { /* Wishlist provider reports the failed request. */ }
  };

  const add = async () => {
    if (!isAvailable) return;
    setBusy(true);
    try {
      await addItem(product._id);
    } catch (error) {
      const message = error.response?.data?.message || '';
      if (/variant|option/i.test(message)) {
        toast.info('Choose the available colour or blouse option first.');
        navigate(`/products/${product.slug}`);
      } else {
        toast.error(message || 'This piece could not be added to your bag.');
      }
    } finally { setBusy(false); }
  };

  return <article className="product-card" style={{ '--card-index': index }}>
    <div className="product-card-image">
      <Link to={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
        {image ? <img src={image} alt={product.imageAltText || product.name} loading="lazy" decoding="async" width="700" height="850" /> : <div className="image-placeholder" aria-label="Product image unavailable">N</div>}
      </Link>
      <div className="product-badges">
        {isNewArrival && <span className="product-badge is-new-arrival">New arrival</span>}
        {isFeatured && <span className="product-badge is-suggestion">Best suggestion</span>}
      </div>
      {!isAvailable && <span className="product-stock-badge">Out of stock</span>}
      <button type="button" className={`icon-button wishlist-toggle${isSaved ? ' is-saved' : ''}`} onClick={save} aria-label={isSaved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`} aria-pressed={isSaved}><Heart size={17} fill={isSaved ? 'currentColor' : 'none'} /></button>
      <button className="quick-add" type="button" onClick={add} disabled={busy || !isAvailable} aria-label={isAvailable ? `Add ${product.name} to bag` : `${product.name} is out of stock`}>{busy ? 'Adding…' : isAvailable ? 'Add to bag' : 'Out of stock'}{isAvailable && <ArrowUpRight size={15} />}</button>
    </div>
    <div className="product-card-copy">
      <div><Link to={`/products/${product.slug}`} className="product-name">{product.name}</Link><span className="product-material">{product.material || product.category?.name || 'Nishree Attire'}</span></div>
      <div className="product-prices"><span>{formatPrice(currentPrice, product.currency)}</span>{discountPercent > 0 && <span className="product-card-offer">{discountPercent}% off</span>}{product.salePrice != null && product.salePrice < product.basePrice && <del>{formatPrice(product.basePrice, product.currency)}</del>}</div>
    </div>
    {product.reviewSummary?.reviewCount > 0 && <p className="product-rating">{Number(product.reviewSummary.averageRating).toFixed(1)} <span aria-hidden="true">✦</span> · {product.reviewSummary.reviewCount} {product.reviewSummary.reviewCount === 1 ? 'review' : 'reviews'}</p>}
  </article>;
}
