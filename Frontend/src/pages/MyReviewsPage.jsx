import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { customerApi } from '../api/customerApi';
import { normalizeApiError } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import ResponsiveImage from '../components/ResponsiveImage';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { formatDate, productImage } from '../utils/format';

const valueId = (value) => String(value?._id || value || '');

function ReviewEditor({ mode, eligibleItems, review, onClose, onSave }) {
  const [selectedItem, setSelectedItem] = useState(eligibleItems[0] || null);
  const [rating, setRating] = useState(review?.rating || 5);
  const [title, setTitle] = useState(review?.title || '');
  const [comment, setComment] = useState(review?.comment || '');
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(null);
  useDialogFocus(true, dialogRef, onClose);

  const submit = async (event) => {
    event.preventDefault();
    if (mode === 'create' && !selectedItem) {
      toast.error('Choose a delivered product to review.');
      return;
    }
    setSaving(true);
    try {
      const saved = await onSave({ mode, selectedItem, review, values: { rating, title: title.trim(), comment: comment.trim() } });
      if (saved) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="review-editor-modal" role="dialog" aria-modal="true" aria-labelledby="review-editor-title">
        <header><div><span className="eyebrow">{mode === 'create' ? 'SHARE YOUR EXPERIENCE' : 'YOUR REVIEW'}</span><h2 id="review-editor-title">{mode === 'create' ? 'Write a review' : 'Edit review'}</h2></div><button className="icon-button" type="button" aria-label="Close review form" onClick={onClose}><X size={18} /></button></header>
        <form className="review-editor-form" onSubmit={(event) => void submit(event)}>
          {mode === 'create' && <label>Delivered product<select value={selectedItem ? `${selectedItem.orderId}:${selectedItem.productId}` : ''} onChange={(event) => setSelectedItem(eligibleItems.find((item) => `${item.orderId}:${item.productId}` === event.target.value) || null)}><option value="">Choose a product</option>{eligibleItems.map((item) => <option value={`${item.orderId}:${item.productId}`} key={`${item.orderId}:${item.productId}`}>{item.productName} · {item.orderNumber}</option>)}</select></label>}
          <fieldset className="review-rating-picker"><legend>Your rating</legend><div role="radiogroup" aria-label="Star rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} star${value === 1 ? '' : 's'}`} onClick={() => setRating(value)}><Star size={25} fill={value <= rating ? 'currentColor' : 'none'} /></button>)}</div><span>{rating} out of 5</span></fieldset>
          <label>Review title <span className="optional-label">Optional</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={150} /></label>
          <label>Your review <span className="optional-label">Optional</span><textarea rows={5} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} placeholder="What did you love about this piece?" /></label>
          <div className="form-actions"><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : mode === 'create' ? 'Submit review' : 'Save changes'} <ArrowRight size={15} /></button><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button></div>
        </form>
      </section>
    </div>
  );
}

export default function MyReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [busyReview, setBusyReview] = useState('');

  const load = useCallback(async () => {
    try {
      const [reviewData, orderData] = await Promise.all([
        customerApi.reviews({ page: 1, limit: 100 }),
        customerApi.orders({ page: 1, limit: 100 }),
      ]);
      setReviews(reviewData.reviews || []);
      setOrders(orderData.orders || []);
      setError('');
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const eligibleItems = useMemo(() => {
    const reviewed = new Set(reviews.map((review) => `${valueId(review.order)}:${valueId(review.product)}`));
    return orders
      .filter((order) => order.orderStatus === 'delivered')
      .flatMap((order) => (order.items || []).map((item) => ({
        orderId: valueId(order),
        orderNumber: order.orderNumber,
        productId: valueId(item.product),
        productName: item.productName || 'Nishree piece',
        image: item.image,
      })))
      .filter((item) => item.productId && !reviewed.has(`${item.orderId}:${item.productId}`));
  }, [orders, reviews]);

  const save = async ({ mode, selectedItem, review, values }) => {
    try {
      if (mode === 'create') {
        await customerApi.createReview(selectedItem.productId, { ...values, orderId: selectedItem.orderId });
        toast.success('Review submitted for moderation.');
      } else {
        await customerApi.updateReview(review._id, values);
        toast.success('Review updated and submitted for moderation.');
      }
      setLoading(true);
      await load();
      return true;
    } catch (requestError) {
      toast.error(normalizeApiError(requestError).message);
      return false;
    }
  };

  const remove = async (review) => {
    if (!window.confirm('Delete this review? This cannot be undone.')) return;
    setBusyReview(String(review._id));
    try {
      await customerApi.deleteReview(review._id);
      setReviews((current) => current.filter((item) => String(item._id) !== String(review._id)));
      toast.success('Review deleted.');
    } catch (requestError) {
      toast.error(normalizeApiError(requestError).message);
    } finally {
      setBusyReview('');
    }
  };

  return (
    <div className="page-wrap my-reviews-page">
      <div className="breadcrumbs"><Link to="/account">My account</Link><span>/</span><span>My reviews</span></div>
      <div className="page-title-row">
        <div><span className="eyebrow">YOUR NOTES ON THE PIECES</span><h1>My reviews</h1><p className="account-page-intro">A place for your thoughts and ratings on the pieces you’ve chosen.</p></div>
        {eligibleItems.length > 0 && <button type="button" className="button button-primary" onClick={() => setEditor({ mode: 'create' })}><Plus size={16} /> Write a review</button>}
      </div>
      {loading ? <LoadingState label="Gathering your reviews…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); void load(); }} /> : reviews.length ? (
        <div className="my-review-list">
          {reviews.map((review) => (
            <article className="my-review-card" key={review._id}>
              <div className="my-review-product">
                {productImage(review.product) && <ResponsiveImage src={productImage(review.product)} alt="" loading="lazy" decoding="async" width="94" height="116" sizes="84px" />}
                <div><span className="eyebrow">{review.order?.orderNumber || 'Verified order'}</span>{review.product?.slug ? <Link to={`/products/${review.product.slug}`}>{review.product.name}</Link> : <strong>{review.product?.name || 'Nishree piece'}</strong>}<small>Submitted {formatDate(review.createdAt)}</small></div>
              </div>
              <div className="my-review-copy">
                <span className="review-stars" aria-label={`${review.rating} out of 5 stars`}><Star size={14} fill="currentColor" /> {review.rating} / 5</span>
                {review.title && <h2>{review.title}</h2>}
                <p>{review.comment || 'You shared a rating for this piece.'}</p>
                <span className={`status-pill review-status-${review.status}`}>{review.status === 'pending' ? 'Awaiting moderation' : review.status}</span>
                {review.status === 'rejected' && review.rejectionReason && <p className="review-rejection-note">{review.rejectionReason}</p>}
                <div className="review-card-actions"><button className="text-link" type="button" onClick={() => setEditor({ mode: 'edit', review })}><Pencil size={14} /> Edit review</button><button className="remove-text" type="button" disabled={busyReview === String(review._id)} onClick={() => void remove(review)}><Trash2 size={14} /> Delete</button></div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Your review notes will live here.">
          <span>{eligibleItems.length ? 'Share your experience with a product you have received.' : 'After a piece is delivered, you can share your experience here.'}</span>
          {eligibleItems.length ? <button className="button button-primary" type="button" onClick={() => setEditor({ mode: 'create' })}><Plus size={15} /> Write your first review</button> : <Link to="/account/orders" className="button button-primary">View orders <ArrowRight size={15} /></Link>}
        </EmptyState>
      )}
      {editor && <ReviewEditor mode={editor.mode} eligibleItems={eligibleItems} review={editor.review} onClose={() => setEditor(null)} onSave={save} />}
    </div>
  );
}
