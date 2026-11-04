import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Copy, Heart, Minus, Plus, Star, Tag, ZoomIn, X } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { catalogApi } from '../api/catalogApi';
import { customerApi } from '../api/customerApi';
import { normalizeApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { useCart } from '../cart/useCart';
import { useWishlist } from '../wishlist/useWishlist';
import { ErrorState, LoadingState } from '../components/States';
import ProductSection from '../components/ProductSection';
import { formatDate, formatPrice, productImage } from '../utils/format';
import { getTamilNaduDeliveryEstimate } from '../utils/deliveryEstimate';
import { currentCouponOffers } from '../utils/couponOffers';
import { useStoreSettings } from '../settings/useStoreSettings';

const reviewSchema = z.object({
  orderId: z.string().min(1, 'Choose the delivered order this review is for.'),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(150, 'Keep the title under 150 characters.').optional(),
  comment: z.string().trim().max(2000, 'Keep your review under 2,000 characters.').optional(),
});

function ReviewForm({ product }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loadedForProduct, setLoadedForProduct] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm({ resolver: zodResolver(reviewSchema), defaultValues: { orderId: '', rating: 5, title: '', comment: '' } });

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    customerApi.orders({ page: 1, limit: 100, status: 'delivered' }).then((result) => {
      const eligible = (result.orders || []).filter((order) => order.items?.some((item) => String(item.product?._id || item.product) === String(product._id)));
      if (active) { setOrders(eligible); setLoadedForProduct(`${user.id}:${product._id}`); }
    }).catch(() => { if (active) { setOrders([]); setLoadedForProduct(`${user.id}:${product._id}`); } });
    return () => { active = false; };
  }, [user, product._id]);

  const submit = async (values) => {
    setSubmitting(true);
    try {
      await customerApi.createReview(product._id, values);
      toast.success('Thank you. Your review has been submitted for moderation.');
      reset({ orderId: '', rating: 5, title: '', comment: '' });
    } catch (error) { toast.error(normalizeApiError(error).message); }
    finally { setSubmitting(false); }
  };

  if (!user) return <div className="review-signin"><p>Purchased this piece? Sign in to share your experience after delivery.</p><Link to="/login" state={{ from: window.location.pathname }} className="text-link">Sign in to write a review <ArrowRight size={15} /></Link></div>;
  if (loadedForProduct !== `${user.id}:${product._id}`) return <LoadingState compact label="Checking eligible orders…" />;
  if (!orders.length) return <div className="review-signin"><p>Reviews are available to customers who have received this piece. Your eligible orders will appear here after delivery.</p></div>;

  return <form className="review-form" onSubmit={handleSubmit(submit)}>
    <h3>Share your experience</h3>
    <label>Delivered order<select {...register('orderId')}><option value="">Choose an order</option>{orders.map((order) => <option value={order._id} key={order._id}>{order.orderNumber} · delivered {formatDate(order.deliveredAt)}</option>)}</select>{errors.orderId && <span className="field-error">{errors.orderId.message}</span>}</label>
    <label>Your rating<select {...register('rating', { valueAsNumber: true })}><option value="5">5 — Loved it</option><option value="4">4 — Beautiful</option><option value="3">3 — Lovely</option><option value="2">2 — Could be better</option><option value="1">1 — Not for me</option></select>{errors.rating && <span className="field-error">{errors.rating.message}</span>}</label>
    <label>Review title <span className="optional-label">Optional</span><input {...register('title')} placeholder="A few words about your piece" maxLength={150} />{errors.title && <span className="field-error">{errors.title.message}</span>}</label>
    <label>Your review <span className="optional-label">Optional</span><textarea {...register('comment')} placeholder="What would you like another customer to know?" rows={4} maxLength={2000} />{errors.comment && <span className="field-error">{errors.comment.message}</span>}</label>
    <button className="button button-primary" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Submit review'} <ArrowRight size={15} /></button>
  </form>;
}

export default function ProductPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { addItem, setDrawerOpen } = useCart();
  const { has, toggle } = useWishlist();
  const settings = useStoreSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState(null);
  const [offers, setOffers] = useState([]);
  const [offerTime, setOfferTime] = useState(() => Date.now());
  const [offersLoading, setOffersLoading] = useState(true);
  const [offersError, setOffersError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadedSlug, setLoadedSlug] = useState('');
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsSlug, setReviewsSlug] = useState('');
  const [reviewsError, setReviewsError] = useState('');
  const [reviewSummary, setReviewSummary] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState(null);
  const [relatedError, setRelatedError] = useState('');
  const [adding, setAdding] = useState(false);
  const [pincode, setPincode] = useState('');
  const [pincodeMessage, setPincodeMessage] = useState('');
  const [zoomOpen, setZoomOpen] = useState(false);
  const actionLock = useRef(false);
  const zoomDialogRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    catalogApi.product(slug, controller.signal).then((response) => {
      const found = response.product;
      setProduct(found);
      setError('');
      setRelatedProducts(null);
      setRelatedError('');
      const gallery = found?.images || [];
      setActiveImage(gallery.find((image) => image.isPrimary)?.url || gallery[0]?.url || productImage(found));
      setVariantId('');
      setLoadedSlug(slug);
    }).catch((fetchError) => { if (fetchError.name !== 'CanceledError') { setError(fetchError.response?.data?.message || 'We could not find this piece.'); setLoadedSlug(slug); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug]);

  useEffect(() => {
    const controller = new AbortController();
    catalogApi.offers(controller.signal)
      .then((response) => {
        setOffers(Array.isArray(response.offers) ? response.offers : []);
        setOfferTime(Date.now());
        setOffersError('');
      })
      .catch((requestError) => {
        if (requestError.name !== 'CanceledError') {
          setOffersError(requestError.response?.data?.message || 'Current offers could not be loaded.');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setOffersLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!product?.category?.slug) return undefined;
    const controller = new AbortController();
    catalogApi.products({ page: 1, limit: 5, category: product.category.slug }, controller.signal)
      .then((response) => {
        setRelatedProducts((response.products || []).filter((item) => String(item._id) !== String(product._id)).slice(0, 4));
        setRelatedError('');
      })
      .catch((requestError) => {
        if (requestError.name !== 'CanceledError') {
          setRelatedProducts([]);
          setRelatedError(normalizeApiError(requestError).message);
        }
      })
    return () => controller.abort();
  }, [product]);

  useEffect(() => {
    const dialog = zoomDialogRef.current;
    if (!dialog) return;
    if (zoomOpen && !dialog.open) dialog.showModal();
    if (!zoomOpen && dialog.open) dialog.close();
  }, [zoomOpen]);

  useEffect(() => {
    const controller = new AbortController();
    catalogApi.reviews(slug, { page: 1, limit: 6 }, controller.signal).then((response) => {
      const result = response.data || {};
      setReviews(result.reviews || []);
      setReviewSummary(result.summary || null);
      setReviewsError('');
      setReviewsSlug(slug);
    }).catch((requestError) => { if (!controller.signal.aborted) { setReviews([]); setReviewSummary(null); setReviewsError(normalizeApiError(requestError).message); setReviewsSlug(slug); } }).finally(() => { if (!controller.signal.aborted) setReviewsLoading(false); });
    return () => controller.abort();
  }, [slug]);

  const selectedVariant = useMemo(() => product?.variants?.find((variant) => String(variant._id) === String(variantId)), [product, variantId]);
  const currentOffers = useMemo(() => currentCouponOffers(offers, offerTime), [offers, offerTime]);
  const images = useMemo(() => {
    const values = [...(product?.images || [])];
    if (product?.primaryImage?.url && !values.some((image) => image.url === product.primaryImage.url)) values.unshift({ url: product.primaryImage.url, altText: product.name, isPrimary: true });
    return values.filter((image) => image.url);
  }, [product]);
  const activeImageIndex = images.findIndex((image) => image.url === activeImage);
  const showGalleryImage = (index) => {
    const image = images[index];
    if (!image) return;
    setActiveImage(image.url);
    setVariantId('');
  };
  const currentPrice = selectedVariant?.finalPrice ?? Number(product?.salePrice ?? product?.basePrice ?? 0) + Number(selectedVariant?.priceAdjustment ?? 0);
  const listPrice = Number(product?.basePrice || 0) + Number(selectedVariant?.priceAdjustment || 0);
  const savings = listPrice > currentPrice ? listPrice - currentPrice : 0;
  const savingsPercent = savings ? Math.round(savings / listPrice * 100) : 0;
  const availableQuantity = Number(selectedVariant?.availableQuantity ?? product?.availableQuantity ?? 0);
  const isCataloguePreview = product?.tags?.includes('catalogue-preview');
  const isSaved = product ? has(product._id) : false;

  useEffect(() => {
    const nextExpiry = currentOffers
      .reduce((soonest, offer) => Math.min(soonest, Date.parse(offer.expiresAt)), Infinity);
    if (!Number.isFinite(nextExpiry)) return undefined;
    const timer = window.setTimeout(() => setOfferTime(Date.now()), Math.max(0, nextExpiry - offerTime + 10));
    return () => window.clearTimeout(timer);
  }, [currentOffers, offerTime]);

  const copyOfferCode = async (code) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
      await navigator.clipboard.writeText(code);
      toast.success(`Coupon code ${code} copied.`);
    } catch {
      toast.error('Could not copy this code. Please select it and copy manually.');
    }
  };

  const save = async () => {
    if (!user) { navigate('/login', { state: { from: `${location.pathname}${location.search}` } }); return; }
    try { await toggle(product._id); } catch { /* Wishlist provider reports the failed request. */ }
  };
  const addToBag = async (goToCheckout = false) => {
    if (product?.variants?.length && !selectedVariant) { toast.info('Please choose a colour or blouse option first.'); return; }
    if (actionLock.current) return;
    actionLock.current = true;
    setAdding(true);
    try {
      await addItem(product._id, quantity, selectedVariant?._id);
      if (goToCheckout) {
        setDrawerOpen(false);
        navigate('/checkout');
      }
    }
    catch (addError) { toast.error(normalizeApiError(addError).message); }
    finally { actionLock.current = false; setAdding(false); }
  };

  const checkPincode = (event) => {
    event.preventDefault();
    const normalized = pincode.trim();
    if (!/^\d{6}$/.test(normalized)) {
      setPincodeMessage('Enter a valid six-digit Indian PIN code.');
      return;
    }
    const estimate = getTamilNaduDeliveryEstimate(normalized);
    setPincodeMessage(estimate
      ? estimate.message
      : 'Online delivery estimates are currently available only for Tamil Nadu PIN codes. Please contact us to confirm serviceability for this address.');
  };

  if (loading || loadedSlug !== slug) return <div className="page-loading"><LoadingState label="Unfolding the details…" /></div>;
  if (error || !product) return <div className="page-wrap"><ErrorState message={error || 'This piece is no longer available.'} onRetry={() => window.location.reload()} /></div>;

  return <div className="page-wrap product-detail-page">
    <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to="/shop">The collection</Link><span>/</span><span>{product.name}</span></div>
    <div className="product-detail-grid">
      <div className="product-gallery"><div className="product-main-image">{(selectedVariant?.image?.url || activeImage) ? <button className="product-image-trigger" type="button" onClick={() => setZoomOpen(true)} aria-label="Enlarge product image"><img src={selectedVariant?.image?.url || activeImage} alt={product.imageAltText || product.name} fetchPriority="high" decoding="async" width="950" height="1160" /><span><ZoomIn size={15} /> Enlarge</span></button> : <div className="image-placeholder">N</div>}{images.length > 1 && <><button className="product-gallery-arrow is-previous" type="button" aria-label="View previous product image" onClick={() => showGalleryImage(activeImageIndex < 0 ? images.length - 1 : (activeImageIndex - 1 + images.length) % images.length)}><ChevronLeft size={21} aria-hidden="true" /></button><button className="product-gallery-arrow is-next" type="button" aria-label="View next product image" onClick={() => showGalleryImage((activeImageIndex + 1) % images.length)}><ChevronRight size={21} aria-hidden="true" /></button></>}</div>{product.imageCredit && <p className="product-image-credit">Image credit: {product.imageSourceUrl ? <a href={product.imageSourceUrl} target="_blank" rel="noopener noreferrer">{product.imageCredit}</a> : product.imageCredit}</p>}{images.length > 1 && <div className="product-thumbnails" aria-label="Product images">{images.map((image, index) => <button type="button" className={activeImage === image.url ? 'is-active' : ''} key={image._id || image.url} onClick={() => { setActiveImage(image.url); setVariantId(''); }} aria-label={`View image ${index + 1}`} aria-pressed={activeImage === image.url}><img src={image.url} alt="" loading="lazy" decoding="async" width="110" height="135" /></button>)}</div>}</div>
      <div className="product-detail-copy"><div className="breadcrumbs detail-category"><Link to={`/collections/${product.category?.slug || ''}`}>{product.category?.name || 'Nishree collection'}</Link><span>·</span><span>SKU {product.sku}</span></div><h1>{product.name}</h1>{product.shortDescription && <p className="product-short-description">{product.shortDescription}</p>}
        {reviewSummary?.reviewCount > 0 && <a className="review-jump" href="#customer-reviews"><Star size={14} fill="currentColor" /> {Number(reviewSummary.averageRating).toFixed(1)} <span>({reviewSummary.reviewCount} {reviewSummary.reviewCount === 1 ? 'review' : 'reviews'})</span></a>}
        <div className="detail-price"><strong>{formatPrice(currentPrice, product.currency)}</strong>{listPrice > currentPrice && <del>{formatPrice(listPrice, product.currency)}</del>}{savings > 0 && <span className="detail-savings">{savingsPercent}% off · Save {formatPrice(savings, product.currency)}</span>}</div>
        <section className="product-offers" aria-labelledby="product-offers-heading">
          <h2 id="product-offers-heading">Current offers</h2>
          {offersLoading ? <p className="product-offers-status" role="status">Checking current offers…</p> : offersError ? <p className="product-offers-status is-error" role="alert">{offersError}</p> : currentOffers.length ? <div className="product-offer-list">{currentOffers.map((offer) => <article className="product-offer-card" key={offer.code}>
            <span className="product-offer-discount"><Tag size={14} />{offer.discountType === 'percentage' ? `${offer.discountValue}% off` : `${formatPrice(offer.discountValue)} off`}</span>
            <strong className="product-offer-code">{offer.code}</strong>
            <button className="product-offer-copy" type="button" onClick={() => void copyOfferCode(offer.code)} aria-label={`Copy coupon code ${offer.code}`}><Copy size={13} /> Copy code</button>
          </article>)}</div> : <p className="product-offers-status">There are no current offers. Check back soon.</p>}
        </section>
        {isCataloguePreview && <p className="catalogue-preview-note">Sample catalogue preview. This image, description, material, colour and price are illustrative references; current product details and stock are not confirmed. Please <Link to="/contact">contact Nishree Attire</Link> before ordering.</p>}
        <p className={`availability-note${availableQuantity < 1 ? ' is-unavailable' : ''}`}>{availableQuantity > 0 ? <Check size={15} /> : null}{availableQuantity > 0 ? `${availableQuantity} available` : 'Currently out of stock — contact us to check availability.'}</p>
        {product.color && <div className="detail-attribute"><span>Colour</span><strong>{product.color}</strong></div>}
        {product.material && <div className="detail-attribute"><span>Fabric</span><strong>{product.material}</strong></div>}
        {product.sareeLength && <div className="detail-attribute"><span>Saree length</span><strong>{product.sareeLength}</strong></div>}
        {product.blouseIncluded && <div className="detail-attribute"><span>Blouse</span><strong>{product.blouseType === 'stitched' ? 'Stitched blouse' : product.blouseType === 'unstitched' ? 'Unstitched blouse piece' : 'Included'}</strong></div>}
        {product.variants?.length > 0 && <fieldset className="variant-picker"><legend>Choose an option</legend><div className="variant-options">{product.variants.map((variant) => <button type="button" key={variant._id} className={`variant-option${String(variant._id) === String(variantId) ? ' is-selected' : ''}`} onClick={() => { setVariantId(String(variant._id)); if (variant.image?.url) setActiveImage(variant.image.url); }} aria-pressed={String(variant._id) === String(variantId)}>{variant.colorCode && <span className="variant-swatch" style={{ backgroundColor: variant.colorCode }} />}{variant.name}{variant.blouseOption && <small>{variant.blouseOption.replaceAll('_', ' ')}</small>}</button>)}</div></fieldset>}
        <div className="purchase-row"><div className="quantity-control"><button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={15} /></button><span aria-live="polite">{quantity}</span><button type="button" aria-label="Increase quantity" disabled={quantity >= 20 || quantity >= availableQuantity} onClick={() => setQuantity((value) => Math.min(20, availableQuantity, value + 1))}><Plus size={15} /></button></div><button type="button" className="button button-primary" onClick={() => void addToBag()} disabled={adding || availableQuantity < 1 || Boolean(product.variants?.length && !selectedVariant)}>{adding ? 'Adding…' : availableQuantity > 0 ? 'Add to bag' : 'Out of stock'}<ArrowRight size={16} /></button><button type="button" className="button button-buy-now" onClick={() => void addToBag(true)} disabled={adding || availableQuantity < 1 || Boolean(product.variants?.length && !selectedVariant)}>{adding ? 'Please wait…' : 'Buy now'}</button><button type="button" className={`icon-button detail-heart${isSaved ? ' is-saved' : ''}`} onClick={save} aria-label={isSaved ? 'Remove from wishlist' : 'Save to wishlist'} aria-pressed={isSaved}><Heart size={19} fill={isSaved ? 'currentColor' : 'none'} /></button></div>
        <form className="delivery-checker" onSubmit={checkPincode} noValidate>
          <label htmlFor="delivery-pincode">Check delivery details</label>
          <div className="delivery-checker-controls">
            <input id="delivery-pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={pincode} onChange={(event) => { setPincode(event.target.value.replace(/\D/g, '').slice(0, 6)); setPincodeMessage(''); }} placeholder="Enter 6-digit PIN code" aria-describedby="delivery-pincode-message" />
            <button type="submit" className="button button-outline">Check delivery estimate</button>
          </div>
          <p id="delivery-pincode-message" className={pincodeMessage ? 'delivery-checker-message' : 'delivery-checker-note'} role="status">{pincodeMessage || 'Chennai is estimated at 2–3 days and other Tamil Nadu districts at 4–5 days. Final PIN-code coverage is confirmed at dispatch.'}</p>
          <Link to="/contact">Contact Nishree support</Link>
        </form>
        <div className="product-detail-divider" />
        <details className="detail-accordion" open><summary>About this piece</summary><p>{product.description}</p></details>
        {product.fabricCare && <details className="detail-accordion"><summary>Care instructions</summary><p>{product.fabricCare}</p></details>}
        {product.occasion?.length > 0 && <details className="detail-accordion"><summary>Occasions</summary><p>{product.occasion.join(' · ')}</p></details>}
        <details className="detail-accordion"><summary>Shipping and returns</summary><p>{settings.policies?.shipping?.content || 'Please contact us to confirm dispatch and delivery details.'} <Link to="/policies/returns">Read the return and exchange policy.</Link></p></details>
      </div>
    </div>
    <section className="customer-reviews" id="customer-reviews"><div className="section-heading-row"><div><span className="eyebrow">From the Nishree community</span><h2>Notes from <em>you.</em></h2></div>{reviewSummary?.reviewCount > 0 && <span className="review-summary"><Star size={15} fill="currentColor" /> {Number(reviewSummary.averageRating).toFixed(1)} · {reviewSummary.reviewCount} reviews</span>}</div>
      <div className="reviews-layout"><div className="reviews-list">{reviewsLoading || reviewsSlug !== slug ? <LoadingState compact label="Gathering customer reviews…" /> : reviewsError ? <ErrorState message={reviewsError} /> : reviews.length ? reviews.map((review) => <article className="review-card" key={review._id}><div className="review-card-meta"><span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span><time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time></div>{review.title && <h3>{review.title}</h3>}<p>{review.comment || 'A customer shared a rating for this piece.'}</p><small>{review.user?.name || 'Nishree customer'}</small></article>) : <div className="review-signin"><p>There are no published reviews for this piece yet.</p><span>Reviews are shown after store moderation.</span></div>}</div><ReviewForm product={product} /></div>
    </section>
    {product.category?.slug && (relatedProducts === null || relatedError || relatedProducts.length > 0) && <ProductSection title="You may also like" kicker="A few more from this edit" products={relatedProducts || []} loading={relatedProducts === null} error={relatedError} onRetry={() => { setRelatedError(''); setRelatedProducts(null); catalogApi.products({ page: 1, limit: 5, category: product.category.slug }).then((response) => setRelatedProducts((response.products || []).filter((item) => String(item._id) !== String(product._id)).slice(0, 4))).catch((requestError) => { setRelatedProducts([]); setRelatedError(normalizeApiError(requestError).message); }); }} link={`/collections/${product.category.slug}`} linkText="View the collection" />}
    <dialog ref={zoomDialogRef} className="product-image-dialog" aria-label={`Enlarged image of ${product.name}`} onClose={() => setZoomOpen(false)}>
      <button type="button" className="product-image-dialog-close" onClick={() => setZoomOpen(false)} aria-label="Close enlarged image"><X size={20} /></button>
      <img src={selectedVariant?.image?.url || activeImage} alt={product.imageAltText || product.name} />
    </dialog>
  </div>;
}
