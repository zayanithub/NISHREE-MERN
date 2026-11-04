import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Camera,
  CheckCircle2,
  Clock3,
  Heart,
  ImagePlus,
  MapPinned,
  MessageSquareText,
  Package,
  ShoppingBag,
  Star,
  Trash2,
  Truck,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '../api/authApi';
import { customerApi } from '../api/customerApi';
import { normalizeApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { ErrorState } from '../components/States';
import { useWishlist } from '../wishlist/useWishlist';
import { formatDate, formatPrice } from '../utils/format';

const readable = (value = '') => value.replaceAll('_', ' ');

function ProfileAvatar({ image, name }) {
  return (
    <span className="account-welcome-avatar">
      {image
        ? <img src={image} alt="" />
        : name?.trim()?.slice(0, 1)?.toUpperCase() || <UserRound size={28} aria-hidden="true" />}
    </span>
  );
}

function AccountOrderSkeleton() {
  return <div className="account-skeleton-list" role="status" aria-label="Loading recent orders">
    {[0, 1, 2].map((item) => <div className="account-skeleton-row" key={item}><span /><div><i /><i /></div><b /></div>)}
  </div>;
}

export default function AccountPage() {
  const { user, updateUser } = useAuth();
  const { wishlist, loading: wishlistLoading, error: wishlistError } = useWishlist();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [overview, setOverview] = useState({ loading: true, orders: [], total: 0, active: 0, completed: 0, error: '' });
  const inputRef = useRef(null);
  const previewUrlRef = useRef('');

  const loadOverview = useCallback(async () => {
    setOverview((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [response, summary] = await Promise.all([
        customerApi.orders({ page: 1, limit: 3 }),
        customerApi.orderSummary(),
      ]);
      setOverview({
        loading: false,
        orders: response.orders || [],
        total: summary.total,
        active: summary.active,
        completed: summary.delivered,
        error: '',
      });
    } catch (error) {
      setOverview((current) => ({ ...current, loading: false, error: normalizeApiError(error).message }));
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [loadOverview]);

  const selectFile = (event) => {
    const next = event.target.files?.[0];
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      toast.error('Choose a JPG, PNG or WebP image.');
      event.target.value = '';
      return;
    }
    if (next.size > 2 * 1024 * 1024) {
      toast.error('Profile images must be 2 MB or smaller.');
      event.target.value = '';
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = URL.createObjectURL(next);
    setPreview(previewUrlRef.current);
    setFile(next);
  };

  const clearSelectedFile = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setPreview('');
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const saveImage = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('profileImage', file);
    setBusy(true);
    try {
      const result = await authApi.updateProfileImage(formData);
      updateUser({ profileImage: result.profileImage?.url || '' });
      clearSelectedFile();
      toast.success('Profile photo updated.');
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeImage = async () => {
    if (!user?.profileImage || !window.confirm('Remove your profile photo?')) return;
    setBusy(true);
    try {
      const result = await authApi.removeProfileImage();
      updateUser({ profileImage: result.profileImage?.url || '' });
      toast.success('Profile photo removed.');
    } catch (error) {
      toast.error(normalizeApiError(error).message);
    } finally {
      setBusy(false);
    }
  };

  const image = preview || user?.profileImage;
  const activeOrders = overview.active;
  const deliveredOrders = overview.completed;
  const recentOrders = overview.orders.slice(0, 3);

  return (
    <main className="page-wrap account-dashboard">
      <section className="account-welcome-card" aria-labelledby="account-welcome-title">
        <div className="account-welcome-copy">
          <span className="eyebrow">YOUR NISHREE ACCOUNT</span>
          <h1 id="account-welcome-title">Welcome back, {user?.name?.trim()?.split(/\s+/)[0] || 'there'}.</h1>
          <p>Your personal space for every order, saved piece and delivery update.</p>
          <div className="account-profile-details">
            {user?.name && <span><UserRound size={14} aria-hidden="true" />{user.name}</span>}
            {user?.email && <span>{user.email}</span>}
            {user?.phone && <span>{user.phone}</span>}
          </div>
        </div>
        <div className="account-photo-editor">
          <ProfileAvatar image={image} name={user?.name} />
          <input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} aria-label="Choose profile image" />
          <div className="account-photo-actions">
            <button type="button" className="button button-outline" onClick={() => inputRef.current?.click()} disabled={busy}>
              <ImagePlus size={15} aria-hidden="true" /> {user?.profileImage ? 'Change photo' : 'Add photo'}
            </button>
            {file && <>
              <button type="button" className="button button-primary" onClick={() => void saveImage()} disabled={busy}>
                <Camera size={15} aria-hidden="true" /> {busy ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="account-photo-cancel" onClick={clearSelectedFile} disabled={busy} aria-label="Cancel photo change"><X size={16} /></button>
            </>}
            {!file && user?.profileImage && <button type="button" className="account-photo-cancel" onClick={() => void removeImage()} disabled={busy} aria-label="Remove profile photo"><Trash2 size={16} /></button>}
          </div>
        </div>
      </section>

      <section className="account-activity" aria-labelledby="account-activity-title">
        <div className="account-section-heading">
          <div><span className="eyebrow">A QUICK OVERVIEW</span><h2 id="account-activity-title">Your activity</h2><p className="account-section-description">A clear snapshot of your Nishree shopping journey.</p></div>
          <Link className="text-link" to="/account/orders">View all orders <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        <div className="account-stat-grid">
          <article className="account-stat-card">
            <span className="account-stat-icon"><ShoppingBag size={19} aria-hidden="true" /></span>
            <div><span>Total orders</span><strong>{overview.loading ? <span className="account-skeleton account-skeleton-number" /> : overview.error ? '—' : overview.total}</strong></div>
          </article>
          <article className="account-stat-card">
            <span className="account-stat-icon is-warm"><Clock3 size={19} aria-hidden="true" /></span>
            <div><span>In progress</span><strong>{overview.loading ? <span className="account-skeleton account-skeleton-number" /> : overview.error ? '—' : activeOrders}</strong></div>
          </article>
          <article className="account-stat-card">
            <span className="account-stat-icon is-green"><CheckCircle2 size={19} aria-hidden="true" /></span>
            <div><span>Completed orders</span><strong>{overview.loading ? <span className="account-skeleton account-skeleton-number" /> : overview.error ? '—' : deliveredOrders}</strong></div>
          </article>
          <article className="account-stat-card">
            <span className="account-stat-icon is-wishlist"><Heart size={19} aria-hidden="true" /></span>
            <div><span>Wishlist items</span><strong>{wishlistLoading ? <span className="account-skeleton account-skeleton-number" /> : wishlistError ? '—' : wishlist?.itemCount ?? wishlist?.products?.length ?? 0}</strong></div>
          </article>
        </div>
      </section>

      <section className="account-quick-access" aria-labelledby="account-quick-access-title">
        <div className="account-section-heading">
          <div><span className="eyebrow">HERE WHEN YOU NEED IT</span><h2 id="account-quick-access-title">Quick access</h2><p className="account-section-description">Jump straight to the details and tools you use most.</p></div>
        </div>
        <div className="account-quick-grid">
          <Link to="/account/orders" className="account-quick-card"><span><ShoppingBag size={19} aria-hidden="true" /></span><strong>My orders</strong><small>Review purchases and track deliveries.</small><ArrowRight size={15} aria-hidden="true" /></Link>
          <Link to="/account/wishlist" className="account-quick-card"><span><Heart size={19} aria-hidden="true" /></span><strong>Wishlist</strong><small>Return to the pieces you have saved.</small><ArrowRight size={15} aria-hidden="true" /></Link>
          <Link to="/account/addresses" className="account-quick-card"><span><MapPinned size={19} aria-hidden="true" /></span><strong>Address book</strong><small>Manage your delivery destinations.</small><ArrowRight size={15} aria-hidden="true" /></Link>
          <Link to="/account/reviews" className="account-quick-card"><span><Star size={19} aria-hidden="true" /></span><strong>My reviews</strong><small>Share your experience with the collection.</small><ArrowRight size={15} aria-hidden="true" /></Link>
          <Link to="/account/notifications" className="account-quick-card"><span><Bell size={19} aria-hidden="true" /></span><strong>Notifications</strong><small>See order updates and important messages.</small><ArrowRight size={15} aria-hidden="true" /></Link>
          <Link to="/contact" className="account-quick-card"><span><MessageSquareText size={19} aria-hidden="true" /></span><strong>Contact Nishree</strong><small>We are here to help with your order.</small><ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="account-recent-orders" aria-labelledby="recent-orders-title">
        <div className="account-section-heading">
          <div><span className="eyebrow">THE LATEST</span><h2 id="recent-orders-title">Recent orders</h2><p className="account-section-description">Your three latest purchases, with their current status and total.</p></div>
          <Link className="text-link" to="/account/orders">Order history <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        {overview.loading ? <AccountOrderSkeleton /> : overview.error ? <ErrorState message={overview.error} onRetry={() => void loadOverview()} /> : recentOrders.length ? (
          <div className="account-recent-list">
            {recentOrders.map((order) => {
              const firstItem = order.items?.[0];
              return (
                <article className="account-recent-order" key={order._id}>
                  <Link to={`/account/orders/${order._id}`} className="account-recent-image" aria-label={`View order ${order.orderNumber}`}>
                    {firstItem?.image ? <img src={firstItem.image} alt="" loading="lazy" decoding="async" /> : <Package size={22} aria-hidden="true" />}
                    {order.items?.length > 1 && <span>+{order.items.length - 1}</span>}
                  </Link>
                  <div className="account-recent-order-copy">
                    <span className="account-order-number">{order.orderNumber}</span>
                    <strong>{firstItem?.productName || 'Your Nishree order'}</strong>
                    <span>{formatDate(order.createdAt)} · {order.items?.length || 0} {(order.items?.length || 0) === 1 ? 'piece' : 'pieces'}</span>
                  </div>
                  <div className="account-recent-order-meta">
                    <span className={`account-status status-${String(order.orderStatus || 'pending').toLowerCase().replaceAll('_', '-')}`}>{readable(order.orderStatus || 'pending')}</span>
                    <strong>{formatPrice(order.totalAmount, order.currency)}</strong>
                  </div>
                  <Link className="account-track-link" to={`/account/orders/${order._id}`} aria-label={`Track order ${order.orderNumber}`}>
                    <Truck size={16} aria-hidden="true" /><span>Track</span>
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="account-empty-orders">
            <span><Package size={22} aria-hidden="true" /></span>
            <div><strong>Your order story starts here.</strong><p>Once you place an order, its latest updates will appear here.</p></div>
            <Link className="button button-primary" to="/shop">Explore the collection <ArrowRight size={15} /></Link>
          </div>
        )}
      </section>
    </main>
  );
}
