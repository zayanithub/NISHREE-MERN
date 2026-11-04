import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { ArrowRight, Bell, CalendarDays, Camera, Check, Clock3, MapPin, PackageCheck, Plus, Trash2, Upload, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { customerApi } from '../api/customerApi';
import { catalogApi } from '../api/catalogApi';
import { normalizeApiError } from '../api/client';
import { ErrorState, EmptyState, LoadingState } from '../components/States';
import { formatDate } from '../utils/format';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { tamilNaduDistricts, indianStatesAndTerritories, countrySuggestions } from '../data/addressOptions';
import { getTamilNaduDeliveryEstimate } from '../utils/deliveryEstimate';

const addressSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter a full name.').max(100),
  phone: z.string().trim().min(7, 'Enter a valid phone number.').max(20),
  addressLine1: z.string().trim().min(3, 'Enter a street address.').max(200),
  addressLine2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(150).optional(),
  city: z.string().trim().min(2, 'Enter a city.').max(100),
  state: z.string().trim().min(2, 'Enter a state.').max(100),
  postalCode: z.string().trim().min(4, 'Enter a valid postal code.').max(20),
  country: z.string().trim().min(2).max(80),
  addressType: z.enum(['home', 'work', 'other']),
  addressFor: z.enum(['shipping', 'billing', 'both']),
});

function AddressEditor({ address, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const { control, register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(addressSchema), defaultValues: { country: 'India', addressType: 'home', addressFor: 'both', ...address } });
  const [postalCode, city, state] = useWatch({ control, name: ['postalCode', 'city', 'state'] });
  const deliveryEstimate = getTamilNaduDeliveryEstimate(postalCode, city, state);
  const submit = async (values) => { setSaving(true); try { await onSave(values); onClose(); } finally { setSaving(false); } };
  return <form className="address-editor" onSubmit={handleSubmit(submit)} noValidate>
    <div className="form-two-columns">
      <label>Full name<input autoComplete="name" {...register('fullName')} />{errors.fullName && <span className="field-error">{errors.fullName.message}</span>}</label>
      <label>Phone<input type="tel" autoComplete="tel" {...register('phone')} />{errors.phone && <span className="field-error">{errors.phone.message}</span>}</label>
    </div>
    <label>Address line 1<input autoComplete="address-line1" {...register('addressLine1')} />{errors.addressLine1 && <span className="field-error">{errors.addressLine1.message}</span>}</label>
    <div className="form-two-columns">
      <label>Address line 2 <span className="optional-label">Optional</span><input autoComplete="address-line2" {...register('addressLine2')} /></label>
      <label>Landmark <span className="optional-label">Optional</span><input {...register('landmark')} /></label>
    </div>
    <div className="form-two-columns">
      <label>City or district<input list="tamil-nadu-districts" autoComplete="address-level2" {...register('city')} /><datalist id="tamil-nadu-districts">{tamilNaduDistricts.map((district) => <option value={district} key={district} />)}</datalist>{errors.city && <span className="field-error">{errors.city.message}</span>}</label>
      <label>State or union territory<input list="indian-states" autoComplete="address-level1" {...register('state')} /><datalist id="indian-states">{indianStatesAndTerritories.map((state) => <option value={state} key={state} />)}</datalist>{errors.state && <span className="field-error">{errors.state.message}</span>}</label>
    </div>
    <div className="form-two-columns">
      <label>PIN or postal code<input autoComplete="postal-code" inputMode="numeric" maxLength={12} {...register('postalCode')} />{errors.postalCode && <span className="field-error">{errors.postalCode.message}</span>}</label>
      <label>Country<input list="country-options" autoComplete="country-name" {...register('country')} /><datalist id="country-options">{countrySuggestions.map((country) => <option value={country} key={country} />)}</datalist>{errors.country && <span className="field-error">{errors.country.message}</span>}</label>
    </div>
    {deliveryEstimate && <p className="address-delivery-note">{deliveryEstimate.message}</p>}
    <div className="form-two-columns">
      <label>Address label<select {...register('addressType')}><option value="home">Home</option><option value="work">Work</option><option value="other">Other</option></select></label>
      <label>Use this address for<select {...register('addressFor')}><option value="both">Shipping and billing</option><option value="shipping">Shipping only</option><option value="billing">Billing only</option></select></label>
    </div>
    <div className="form-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : address ? 'Save changes' : 'Add address'} <ArrowRight size={15} /></button><button className="button button-quiet" type="button" onClick={onClose}>Cancel</button></div>
  </form>;
}

export function AddressesPage() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(undefined);
  const dialogRef = useRef(null);
  const closeEditor = useCallback(() => setEditor(undefined), []);
  useDialogFocus(editor !== undefined, dialogRef, closeEditor);
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => { try { setAddresses(await customerApi.addresses() || []); setError(''); } catch (requestError) { setError(normalizeApiError(requestError).message); } finally { setLoading(false); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const save = async (values) => {
    try {
      if (editor?._id) { const updated = await customerApi.updateAddress(editor._id, values); setAddresses((current) => current.map((item) => String(item._id) === String(updated._id) ? updated : item)); toast.success('Address updated.'); }
      else { const created = await customerApi.createAddress(values); setAddresses((current) => [...current, created]); toast.success('Address added.'); }
    } catch (requestError) { toast.error(normalizeApiError(requestError).message); throw requestError; }
  };
  const setDefault = async (id) => { setBusy(id); try { const address = await customerApi.setDefaultAddress(id); setAddresses((current) => current.map((item) => ({ ...item, isDefault: String(item._id) === String(address._id) }))); toast.success('Default address updated.'); } catch (requestError) { toast.error(normalizeApiError(requestError).message); } finally { setBusy(''); } };
  const remove = async (address) => { if (!window.confirm(`Remove the address for ${address.fullName}?`)) return; setBusy(address._id); try { await customerApi.deleteAddress(address._id); setAddresses((current) => current.filter((item) => item._id !== address._id)); toast.success('Address removed.'); } catch (requestError) { toast.error(normalizeApiError(requestError).message); } finally { setBusy(''); } };

  return <div className="page-wrap addresses-page">
    <div className="breadcrumbs"><Link to="/account">My account</Link><span>/</span><span>Addresses</span></div>
    <div className="page-title-row"><div><span className="eyebrow">A familiar destination</span><h1>Your addresses</h1><p className="address-page-intro">Keep your delivery details ready for a simpler checkout. Choose a default address and edit it whenever plans change.</p></div><button type="button" className="button button-primary" onClick={() => setEditor(null)}><Plus size={16} /> Add address</button></div>
    <div className="address-page-guide"><span className="address-guide-icon"><MapPin size={19} /></span><div><strong>Made for your next delivery</strong><p>Choose your district, state and country from the suggestions or enter another location. Tamil Nadu estimates are shown as a guide; exact PIN-code serviceability is confirmed at dispatch.</p></div><span className="address-count">{addresses.length} {addresses.length === 1 ? 'address' : 'addresses'}</span></div>
    {loading ? <LoadingState label="Gathering your saved addresses…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); void load(); }} /> : addresses.length ? <div className="address-card-grid">{addresses.map((address) => {
      const estimate = getTamilNaduDeliveryEstimate(address.postalCode, address.city, address.state);
      return <article className={`saved-address-card${address.isDefault ? ' is-default' : ''}`} key={address._id}>
        <div className="saved-address-heading"><span className="address-type-pill">{address.addressType}</span><span className="address-use-pill">{address.addressFor === 'shipping' ? 'Shipping' : address.addressFor === 'billing' ? 'Billing' : 'Shipping & billing'}</span>{address.isDefault && <span className="default-mark"><Check size={13} /> Default shipping</span>}</div>
        <MapPin size={18} />
        <strong>{address.fullName}</strong><span>{address.phone}</span>
        <span>{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}</span>
        {address.landmark && <span>Near {address.landmark}</span>}
        <span>{address.city}, {address.state} {address.postalCode}</span><span>{address.country}</span>
        {estimate && <span className="saved-address-estimate">Estimated delivery · {estimate.days}</span>}
        <div className="saved-address-actions"><button type="button" className="text-link" onClick={() => setEditor(address)}>Edit</button>{address.addressFor !== 'billing' && !address.isDefault && <button type="button" className="text-link" disabled={busy === address._id} onClick={() => setDefault(address._id)}>Set as default</button>}<button type="button" className="remove-text" disabled={busy === address._id} onClick={() => remove(address)}><Trash2 size={14} /> Remove</button></div>
      </article>;
    })}</div> : <EmptyState title="No saved addresses yet."><span>Add a delivery address to make your next checkout simpler.</span><button className="button button-primary" type="button" onClick={() => setEditor(null)}><Plus size={15} /> Add address</button></EmptyState>}
    {editor !== undefined && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}><section ref={dialogRef} className="address-modal" role="dialog" aria-modal="true" aria-labelledby="address-editor-title"><header><div><span className="eyebrow">Delivery details</span><h2 id="address-editor-title">{editor?._id ? 'Edit address' : 'Add an address'}</h2></div><button className="icon-button" type="button" aria-label="Close address editor" onClick={closeEditor}><X size={18} /></button></header><AddressEditor address={editor?._id ? editor : undefined} onClose={closeEditor} onSave={save} /></section></div>}
  </div>;
}

const preferenceGroups = [
  { title: 'In your Nishree account', fields: [['inAppNotifications', 'In-app notifications'], ['orderUpdates', 'Order updates'], ['paymentUpdates', 'Payment updates'], ['shippingUpdates', 'Shipping updates'], ['returnUpdates', 'Return updates'], ['exchangeUpdates', 'Exchange updates'], ['refundUpdates', 'Refund updates'], ['systemUpdates', 'Account and system updates']] },
  { title: 'Messages and offers', fields: [['emailNotifications', 'Transactional email'], ['smsNotifications', 'Transactional SMS'], ['whatsappNotifications', 'Transactional WhatsApp'], ['promotionalInApp', 'Offers in your account'], ['promotionalEmail', 'Offers by email'], ['promotionalSms', 'Offers by SMS'], ['promotionalWhatsapp', 'Offers by WhatsApp']] },
];

const notificationFilters = [
  { key: 'all', label: 'All updates', type: '' },
  { key: 'order', label: 'Orders', type: 'order' },
  { key: 'shipping', label: 'Delivery', type: 'shipping' },
  { key: 'payment', label: 'Payments', type: 'payment' },
  { key: 'promotion', label: 'Offers', type: 'promotion' },
  { key: 'aftercare', label: 'Returns & exchanges', type: 'aftercare' },
  { key: 'system', label: 'Account', type: 'system' },
];

const notificationTarget = (notification) => {
  if (notification.actionUrl?.startsWith('/')) return notification.actionUrl;
  const orderId = notification.relatedOrder?._id || notification.relatedOrder;
  if (orderId && ['order', 'payment', 'shipping', 'refund'].includes(notification.type)) return `/account/orders/${orderId}`;
  if (['return', 'exchange'].includes(notification.type)) return '/account/returns';
  if (notification.type === 'promotion') return '/shop';
  return '/account';
};

export function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const load = useCallback(async () => {
    try {
      const [list, prefs] = await Promise.all([customerApi.notifications({ page: 1, limit: 100 }), customerApi.notificationPreferences()]);
      setNotifications(list.notifications || []);
      setPreferences(prefs || {});
      setError('');
    } catch (requestError) { setError(normalizeApiError(requestError).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const markRead = async (notification) => {
    if (notification.isRead) return;
    try { const updated = await customerApi.markNotificationRead(notification._id); setNotifications((current) => current.map((item) => item._id === notification._id ? updated : item)); window.dispatchEvent(new Event('nishree:notifications-updated')); }
    catch (requestError) { toast.error(normalizeApiError(requestError).message); }
  };
  const toggle = async (field, checked) => {
    setSaving(field);
    try { const updated = await customerApi.updateNotificationPreferences({ [field]: checked }); setPreferences(updated); toast.success('Notification preference saved.'); }
    catch (requestError) { toast.error(normalizeApiError(requestError).message); }
    finally { setSaving(''); }
  };
  const markAll = async () => { try { await customerApi.markAllNotificationsRead(); setNotifications((current) => current.map((item) => ({ ...item, isRead: true }))); window.dispatchEvent(new Event('nishree:notifications-updated')); toast.success('Notifications marked as read.'); } catch (requestError) { toast.error(normalizeApiError(requestError).message); } };
  const clearAll = async () => {
    if (!window.confirm('Clear all notifications from your account? This cannot be undone.')) return;
    try { await customerApi.clearNotifications(); setNotifications([]); window.dispatchEvent(new Event('nishree:notifications-updated')); toast.success('Notifications cleared.'); }
    catch (requestError) { toast.error(normalizeApiError(requestError).message); }
  };
  const activeFilter = notificationFilters.find((item) => item.key === category);
  const visibleNotifications = category === 'aftercare'
    ? notifications.filter((item) => ['return', 'exchange'].includes(item.type))
    : activeFilter?.type
      ? notifications.filter((item) => item.type === activeFilter.type)
      : notifications;
  const unreadCount = visibleNotifications.filter((item) => !item.isRead).length;

  return <div className="page-wrap notifications-page"><div className="breadcrumbs"><Link to="/account">My account</Link><span>/</span><span>Notifications</span></div><div className="page-title-row"><div><span className="eyebrow">Keep in the know</span><h1>Notifications</h1><p className="account-page-intro">{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'} for you.` : 'Your order and account updates, gathered in one place.'}</p></div><div className="notification-actions">{unreadCount > 0 && <button type="button" className="button button-outline" onClick={() => void markAll()}><Check size={15} /> Mark all as read</button>}{notifications.length > 0 && <button type="button" className="button button-quiet" onClick={() => void clearAll()}><Trash2 size={15} /> Clear all</button>}</div></div>
    <div className="notification-category-tabs" role="tablist" aria-label="Filter notifications">{notificationFilters.map((filter) => <button key={filter.key} type="button" role="tab" aria-selected={category === filter.key} className={category === filter.key ? 'is-active' : ''} onClick={() => setCategory(filter.key)}>{filter.label}</button>)}</div>
    {loading ? <LoadingState label="Checking your account updates…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); void load(); }} /> : <div className="notification-layout"><section className="notification-list-panel"><div className="section-heading-row"><div><span className="eyebrow">Your updates</span><h2>{notificationFilters.find((item) => item.key === category)?.label || 'Recent notifications'}</h2></div></div>{visibleNotifications.length ? visibleNotifications.map((notification) => {
      const target = notificationTarget(notification);
      return <article className={`notification-item${notification.isRead ? '' : ' is-unread'}`} key={notification._id}><span className="notification-dot"><Bell size={16} /></span><div><time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time><Link to={target} className="notification-title-link" onClick={() => void markRead(notification)}>{notification.title}</Link><p>{notification.message}</p><Link to={target} onClick={() => void markRead(notification)}>View update <ArrowRight size={13} /></Link></div>{!notification.isRead && <button type="button" className="mark-read" aria-label="Mark notification as read" onClick={() => void markRead(notification)}><Check size={14} /></button>}</article>;
    }) : <p className="quiet-note">Your account updates will appear here.</p>}</section>
      <section className="preferences-panel"><div><span className="eyebrow">Your preferences</span><h2>How we keep in touch</h2><p>Choose which updates you would like to receive. Message delivery depends on the channels configured for your account.</p></div>{preferenceGroups.map((group) => <fieldset className="preference-group" key={group.title}><legend>{group.title}</legend>{group.fields.map(([field, label]) => <label className="preference-row" key={field}><span>{label}</span><input type="checkbox" checked={Boolean(preferences?.[field])} disabled={saving === field} onChange={(event) => void toggle(field, event.target.checked)} /><span className="toggle-track" aria-hidden="true" /></label>)}</fieldset>)}</section></div>}
  </div>;
}

const returnReasons = ['damaged_product', 'wrong_product', 'different_from_description', 'quality_issue', 'size_or_fit', 'other'];
const exchangeReasons = ['wrong_product', 'damaged_product', 'different_from_description', 'size_or_fit', 'color_change', 'other'];
const RETURN_EXCHANGE_WINDOW_DAYS = 5;
const titleCase = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const statusClass = (value = '') => `status-${String(value).toLowerCase().replaceAll('_', '-')}`;
const returnTimelineStages = [
  { label: 'Request submitted', statuses: ['requested', 'under_review', 'approved', 'rejected', 'pickup_scheduled', 'in_transit', 'received', 'inspection_passed', 'inspection_failed', 'refund_pending', 'completed'] },
  { label: 'Under review', statuses: ['under_review', 'approved', 'rejected', 'pickup_scheduled', 'in_transit', 'received', 'inspection_passed', 'inspection_failed', 'refund_pending', 'completed'] },
  { label: 'Approved', statuses: ['approved', 'pickup_scheduled', 'in_transit', 'received', 'inspection_passed', 'refund_pending', 'completed'] },
  { label: 'Pickup scheduled', statuses: ['pickup_scheduled', 'in_transit', 'received', 'inspection_passed', 'inspection_failed', 'refund_pending', 'completed'] },
  { label: 'Product received', statuses: ['received', 'inspection_passed', 'inspection_failed', 'refund_pending', 'completed'] },
  { label: 'Refund processing', statuses: ['refund_pending', 'completed'] },
  { label: 'Completed', statuses: ['completed'] },
];
const exchangeTimelineStages = [
  { label: 'Request submitted', statuses: ['requested', 'under_review', 'approved', 'rejected', 'pickup_scheduled', 'original_in_transit', 'original_received', 'inspection_passed', 'inspection_failed', 'replacement_pending', 'replacement_shipped', 'completed'] },
  { label: 'Under review', statuses: ['under_review', 'approved', 'rejected', 'pickup_scheduled', 'original_in_transit', 'original_received', 'inspection_passed', 'inspection_failed', 'replacement_pending', 'replacement_shipped', 'completed'] },
  { label: 'Approved', statuses: ['approved', 'pickup_scheduled', 'original_in_transit', 'original_received', 'inspection_passed', 'replacement_pending', 'replacement_shipped', 'completed'] },
  { label: 'Pickup scheduled', statuses: ['pickup_scheduled', 'original_in_transit', 'original_received', 'inspection_passed', 'inspection_failed', 'replacement_pending', 'replacement_shipped', 'completed'] },
  { label: 'Product received', statuses: ['original_received', 'inspection_passed', 'inspection_failed', 'replacement_pending', 'replacement_shipped', 'completed'] },
  { label: 'Replacement processing', statuses: ['replacement_pending', 'replacement_shipped', 'completed'] },
  { label: 'Completed', statuses: ['completed'] },
];

function requestStageIndex(status, type) {
  const stageByStatus = type === 'return'
    ? { requested: 0, under_review: 1, approved: 2, pickup_scheduled: 3, in_transit: 3, received: 4, inspection_passed: 4, inspection_failed: 4, refund_pending: 5, completed: 6 }
    : { requested: 0, under_review: 1, approved: 2, pickup_scheduled: 3, original_in_transit: 3, original_received: 4, inspection_passed: 4, inspection_failed: 4, replacement_pending: 5, replacement_shipped: 5, completed: 6 };
  return stageByStatus[status] ?? -1;
}

function requestStageDate(request, index, type, current) {
  const dateByStage = type === 'return'
    ? [request.requestedAt || request.createdAt, request.reviewedAt, request.approvedAt, null, request.receivedAt, null, request.completedAt]
    : [request.requestedAt || request.createdAt, request.reviewedAt, request.reviewedAt, null, request.originalReceivedAt, request.replacementShippedAt, request.completedAt];
  return dateByStage[index] || (index === current ? request.updatedAt : null);
}

function RequestTimeline({ request, type }) {
  const stages = type === 'return' ? returnTimelineStages : exchangeTimelineStages;
  const current = requestStageIndex(request.status, type);
  const exceptional = ['rejected', 'cancelled'].includes(request.status);
  return <ol className={`request-progress request-timeline${exceptional ? ' has-exception' : ''}`} aria-label={`${type} request progress`}>
    {stages.map(({ label }, index) => {
      const date = requestStageDate(request, index, type, current);
      const complete = !exceptional && current >= 0 && index < current;
      const active = !exceptional && index === current;
      return <li className={`${complete ? 'is-complete' : ''}${active ? ' is-current' : ''}`} key={label}>
        <span>{complete ? <Check size={13} aria-hidden="true" /> : index + 1}</span>
        <strong>{label}</strong>
        <small>{date ? formatDate(date) : 'Awaiting update'}</small>
      </li>;
    })}
    {exceptional && <li className={`is-current is-exception status-${request.status}`}><span>{request.status === 'cancelled' ? <X size={13} /> : '!'}</span><strong>{titleCase(request.status)}</strong><small>{formatDate(request.updatedAt || request.reviewedAt)}</small></li>}
  </ol>;
}

export function ReturnExchangePage() {
  const [query] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [products, setProducts] = useState([]);
  const [productVariants, setProductVariants] = useState([]);
  const [orderId, setOrderId] = useState(query.get('orderId') || '');
  const [orderItemId, setOrderItemId] = useState(query.get('orderItemId') || '');
  const [type, setType] = useState(query.get('type') === 'exchange' ? 'exchange' : 'return');
  const [quantity, setQuantity] = useState(1);
  const [requestedProductId, setRequestedProductId] = useState('');
  const [requestedVariantId, setRequestedVariantId] = useState('');
  const [variantProductId, setVariantProductId] = useState('');
  const [reason, setReason] = useState('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [busyRequest, setBusyRequest] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState([]);
  const [uploadedEvidence, setUploadedEvidence] = useState([]);
  const evidencePreviewUrls = useRef(new Set());
  const deliveredOrders = useMemo(() => orders.filter((order) => order.orderStatus === 'delivered'), [orders]);
  const orderItems = useMemo(() => deliveredOrders.flatMap((order) => (order.items || []).map((item) => {
    const deadline = order.deliveredAt ? new Date(order.deliveredAt) : null;
    if (deadline && !Number.isNaN(deadline.getTime())) deadline.setDate(deadline.getDate() + RETURN_EXCHANGE_WINDOW_DAYS);
    return {
      key: `${order._id}-${item._id}`,
      order,
      item,
      deadline,
      isEligible: Boolean(deadline && !Number.isNaN(deadline.getTime()) && Date.now() <= deadline.getTime()),
    };
  })), [deliveredOrders]);
  const selectedOrder = deliveredOrders.find((order) => String(order._id) === String(orderId));
  const selectedItem = selectedOrder?.items?.find((item) => String(item._id) === String(orderItemId));

  useEffect(() => () => {
    evidencePreviewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const load = useCallback(async () => {
    try {
      const [orderData, returnData, exchangeData, productData] = await Promise.all([
        customerApi.orders({ page: 1, limit: 100 }), customerApi.returns({ page: 1, limit: 50 }), customerApi.exchanges({ page: 1, limit: 50 }), catalogApi.products({ page: 1, limit: 100, sort: 'newest' }),
      ]);
      setOrders(orderData.orders || []);
      setRequests(returnData.requests || returnData.returnRequests || returnData.returns || returnData.items || []);
      setExchanges(exchangeData.requests || exchangeData.exchangeRequests || exchangeData.exchanges || exchangeData.items || []);
      setProducts(productData.products || []);
      const firstDelivered = (orderData.orders || []).find((order) => order.orderStatus === 'delivered');
      const chosenOrderId = query.get('orderId') || firstDelivered?._id || '';
      setOrderId(chosenOrderId);
      const chosenOrder = (orderData.orders || []).find((order) => String(order._id) === String(chosenOrderId));
      const chosenItemId = query.get('orderItemId') || chosenOrder?.items?.[0]?._id || '';
      setOrderItemId(chosenItemId);
      if (query.get('type') === 'exchange') setType('exchange');
    } catch (requestError) { setError(normalizeApiError(requestError).message); }
    finally { setLoading(false); }
  }, [query]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  useEffect(() => {
    if (type !== 'exchange' || !requestedProductId) return undefined;
    const product = products.find((item) => String(item._id) === String(requestedProductId));
    if (!product?.slug) return undefined;
    const controller = new AbortController();
    catalogApi.product(product.slug, controller.signal).then((response) => {
      const variants = response.product?.variants || [];
      setProductVariants(variants);
      setVariantProductId(String(requestedProductId));
      setRequestedVariantId(variants.length === 1 ? String(variants[0]._id) : '');
    }).catch(() => { if (!controller.signal.aborted) { setProductVariants([]); setVariantProductId(String(requestedProductId)); } });
    return () => controller.abort();
  }, [type, requestedProductId, products]);

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedOrder || !selectedItem) { toast.error('Choose a delivered order and a purchased item.'); return; }
    if (!orderItems.some((entry) => String(entry.order._id) === String(selectedOrder._id) && String(entry.item._id) === String(selectedItem._id) && entry.isEligible)) {
      toast.error('This item is outside the return and exchange window. Please contact support if you need help.');
      return;
    }
    if (!(type === 'return' ? returnReasons : exchangeReasons).includes(reason)) { toast.error('Choose a reason for this request.'); return; }
    if (type === 'exchange' && !requestedProductId) { toast.error('Choose the replacement piece you would like.'); return; }
    if (type === 'exchange' && productVariants.length && !requestedVariantId) { toast.error('Choose the replacement piece option.'); return; }
    setSubmitting(true);
    try {
      let evidenceImages = uploadedEvidence;
      if (type === 'return' && selectedEvidence.length) {
        evidenceImages = await customerApi.uploadReturnEvidence(selectedEvidence.map(({ file }) => file));
        setUploadedEvidence(evidenceImages);
        selectedEvidence.forEach(({ previewUrl }) => {
          URL.revokeObjectURL(previewUrl);
          evidencePreviewUrls.current.delete(previewUrl);
        });
        setSelectedEvidence([]);
      }
      const common = {
        orderId: String(selectedOrder._id),
        orderItemId: String(selectedItem._id),
        quantity: Number(quantity),
        reason,
        ...(reasonDetails.trim() ? { reasonDetails: reasonDetails.trim() } : {}),
      };
      if (type === 'return') await customerApi.createReturn({ ...common, ...(evidenceImages.length ? { evidenceImages } : {}) });
      else await customerApi.createExchange({ ...common, requestedProductId, ...(requestedVariantId ? { requestedVariantId } : {}) });
      toast.success(type === 'return' ? 'Your return request has been submitted.' : 'Your exchange request has been submitted.');
      setReason(''); setReasonDetails('');
      setUploadedEvidence([]);
      await load();
    } catch (requestError) { toast.error(normalizeApiError(requestError).message); }
    finally { setSubmitting(false); }
  };

  const cancelRequest = async (request, requestType) => {
    if (!window.confirm(`Cancel this ${requestType} request?`)) return;
    setBusyRequest(String(request._id));
    try {
      const updated = requestType === 'return'
        ? await customerApi.cancelReturn(request._id)
        : await customerApi.cancelExchange(request._id);
      const updateList = (current) => current.map((item) => String(item._id) === String(updated._id) ? updated : item);
      if (requestType === 'return') setRequests(updateList);
      else setExchanges(updateList);
      toast.success(`${titleCase(requestType)} request cancelled.`);
    } catch (requestError) {
      toast.error(normalizeApiError(requestError).message);
    } finally {
      setBusyRequest('');
    }
  };

  const beginRequest = (entry, requestType) => {
    setOrderId(String(entry.order._id));
    setOrderItemId(String(entry.item._id));
    setQuantity(1);
    setType(requestType);
    setReason('');
    setRequestedProductId('');
    setRequestedVariantId('');
    document.getElementById('returns-request-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const addEvidence = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const invalidFile = files.find((file) => !validTypes.includes(file.type) || file.size > 2 * 1024 * 1024);
    if (invalidFile) {
      toast.error('Choose JPG, PNG or WebP images no larger than 2 MB each.');
      return;
    }
    if (files.length + selectedEvidence.length + uploadedEvidence.length > 5) {
      toast.error('You can attach up to 5 images to a return request.');
      return;
    }
    const additions = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      evidencePreviewUrls.current.add(previewUrl);
      return { file, previewUrl };
    });
    setSelectedEvidence((current) => [...current, ...additions]);
  };

  const removeEvidence = (previewUrl) => {
    URL.revokeObjectURL(previewUrl);
    evidencePreviewUrls.current.delete(previewUrl);
    setSelectedEvidence((current) => current.filter((entry) => entry.previewUrl !== previewUrl));
  };

  const renderRequestCards = (items, requestType) => items.length
    ? items.map((request) => {
      const productName = requestType === 'return' ? request.productName : request.originalProductName;
      const requestNumber = requestType === 'return' ? request.returnNumber : request.exchangeNumber;
      return <article className="return-request-card" key={request._id}>
        <header className="return-request-card-heading">
          <div><span className="eyebrow">{requestNumber || `${titleCase(requestType)} request`}</span><h3>{productName || 'Order item'}</h3><p>{formatDate(request.requestedAt || request.createdAt)} · {titleCase(request.reason)}</p></div>
          <span className={`status-pill ${statusClass(request.status)}`}>{titleCase(request.status)}</span>
        </header>
        {request.reasonDetails && <p className="return-request-details">{request.reasonDetails}</p>}
        <RequestTimeline request={request} type={requestType} />
        {request.rejectionReason && <p className="return-request-update">{request.rejectionReason}</p>}
        {requestType === 'return' && request.pickupTrackingNumber && <p className="return-request-update">Pickup tracking: {request.pickupCarrier ? `${request.pickupCarrier} · ` : ''}{request.pickupTrackingNumber}</p>}
        {requestType === 'exchange' && request.replacementTrackingNumber && <p className="return-request-update">Replacement tracking: {request.replacementCarrier ? `${request.replacementCarrier} · ` : ''}{request.replacementTrackingNumber}</p>}
        {['requested', 'under_review'].includes(request.status) && <button className="remove-text" type="button" disabled={busyRequest === String(request._id)} onClick={() => void cancelRequest(request, requestType)}>{busyRequest === String(request._id) ? 'Cancelling…' : 'Cancel request'}</button>}
      </article>;
    })
    : <p className="return-empty-note">Your {requestType} requests will appear here once submitted.</p>;

  return <div className="page-wrap return-exchange-page">
    <div className="breadcrumbs"><Link to="/account">My account</Link><span>/</span><span>Returns &amp; exchanges</span></div>
    <header className="returns-hero">
      <div><span className="eyebrow">Thoughtful support, every step</span><h1>Returns &amp; exchanges</h1><p>Need a different piece or a little help with your order? Start a request in a few simple steps and follow every update here.</p></div>
      <Link className="returns-support-link" to="/contact">Contact support <ArrowRight size={15} aria-hidden="true" /></Link>
    </header>

    <section className="returns-overview" aria-labelledby="returns-how-title">
      <div className="returns-section-heading"><div><span className="eyebrow">A clear, considered process</span><h2 id="returns-how-title">How it works</h2></div><Link to="/policies/returns">Read the return policy <ArrowRight size={14} /></Link></div>
      <div className="returns-process-grid">
        <article><span>01</span><div><PackageCheck size={20} aria-hidden="true" /><h3>Choose an order</h3><p>Select an eligible delivered item from your order history.</p></div></article>
        <article><span>02</span><div><Camera size={20} aria-hidden="true" /><h3>Tell us what happened</h3><p>Choose a reason, add details and include photos for a return if helpful.</p></div></article>
        <article><span>03</span><div><Clock3 size={20} aria-hidden="true" /><h3>Follow your request</h3><p>Review decisions, pickup and refund or replacement updates in your account.</p></div></article>
      </div>
    </section>

    {loading ? <LoadingState label="Checking your orders and requests…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); void load(); }} /> : <>
      <section className="returns-orders-section" aria-labelledby="eligible-orders-title">
        <div className="returns-section-heading"><div><span className="eyebrow">Your recent deliveries</span><h2 id="eligible-orders-title">Eligible orders</h2><p>Requests are available for five days after delivery. The store confirms eligibility when you submit.</p></div><span className="returns-count">{orderItems.filter((entry) => entry.isEligible).length} eligible item{orderItems.filter((entry) => entry.isEligible).length === 1 ? '' : 's'}</span></div>
        {orderItems.length ? <div className="returns-order-grid">{orderItems.map(({ key, order, item, deadline, isEligible }) => <article className="returns-order-card" key={key}>
          <div className="returns-order-product">
            {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="returns-order-image-placeholder"><PackageCheck size={24} aria-hidden="true" /></span>}
            <div><span className="eyebrow">{order.orderNumber || 'Order'} · {String(order._id).slice(-8).toUpperCase()}</span><h3>{item.productName}</h3>{item.variantName && <p>{item.variantName}</p>}</div>
          </div>
          <div className="returns-order-meta">
            <span><CalendarDays size={15} aria-hidden="true" /> Purchased {formatDate(order.createdAt)}</span>
            <span><PackageCheck size={15} aria-hidden="true" /> Delivered {formatDate(order.deliveredAt)}</span>
            <span className={isEligible ? 'is-eligible' : 'is-expired'}>{isEligible ? <Check size={15} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}{deadline ? `${isEligible ? 'Request by' : 'Request window ended'} ${formatDate(deadline)}` : 'Delivery date unavailable'}</span>
          </div>
          {isEligible ? <div className="returns-order-actions"><button type="button" onClick={() => beginRequest({ order, item }, 'return')}>Request return <ArrowRight size={14} /></button><button type="button" onClick={() => beginRequest({ order, item }, 'exchange')}>Request exchange <ArrowRight size={14} /></button></div> : <p className="returns-order-expired">This item is outside the request window. <Link to="/contact">Contact support</Link> if you need help.</p>}
        </article>)}</div> : <div className="returns-no-orders"><PackageCheck size={25} aria-hidden="true" /><h3>No delivered orders yet</h3><p>When an order is delivered, you can start a return or exchange request here.</p><Link className="button button-outline" to="/account/orders">View your orders <ArrowRight size={14} /></Link></div>}
      </section>

      <section className="returns-request-section" id="returns-request-form" aria-labelledby="returns-request-title">
        <div className="returns-section-heading"><div><span className="eyebrow">We are here to help</span><h2 id="returns-request-title">Start a request</h2><p>Choose the delivered item and give us a few details. We will confirm your request with the store.</p></div></div>
        <div className="request-tabs" role="tablist" aria-label="Request type">
          <button type="button" role="tab" aria-selected={type === 'return'} className={type === 'return' ? 'is-active' : ''} onClick={() => setType('return')}>Request a return</button>
          <button type="button" role="tab" aria-selected={type === 'exchange'} className={type === 'exchange' ? 'is-active' : ''} onClick={() => setType('exchange')}>Request an exchange</button>
        </div>
        <form className="request-form returns-request-form" onSubmit={submit}>
          <div className="form-two-columns">
            <label>Delivered order<select required value={orderId} onChange={(event) => { setOrderId(event.target.value); setOrderItemId(''); setQuantity(1); }}><option value="">Choose an order</option>{deliveredOrders.map((order) => <option key={order._id} value={order._id}>{order.orderNumber || String(order._id).slice(-8)} · delivered {formatDate(order.deliveredAt)}</option>)}</select></label>
            <label>Product from this order<select required value={orderItemId} onChange={(event) => { setOrderItemId(event.target.value); setQuantity(1); }} disabled={!selectedOrder}><option value="">Choose an item</option>{selectedOrder?.items?.map((item) => <option value={item._id} key={item._id}>{item.productName} · quantity {item.quantity}</option>)}</select></label>
          </div>
          {selectedItem && <div className="form-two-columns"><label>Quantity to {type === 'return' ? 'return' : 'exchange'}<input type="number" min="1" max={selectedItem.quantity} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(selectedItem.quantity, Number(event.target.value) || 1)))} required /></label><p className="returns-selected-note">Selected item: <strong>{selectedItem.productName}</strong>{selectedOrder?.orderNumber && <span> · {selectedOrder.orderNumber}</span>}</p></div>}
          {type === 'exchange' && <>
            <label>Replacement product<select required value={requestedProductId} onChange={(event) => { setRequestedProductId(event.target.value); setRequestedVariantId(''); }}><option value="">Choose from the available collection</option>{products.map((product) => <option value={product._id} key={product._id}>{product.name}</option>)}</select></label>
            {variantProductId === String(requestedProductId) && productVariants.length > 0 && <label>Available colour / size / option<select required value={requestedVariantId} onChange={(event) => setRequestedVariantId(event.target.value)}><option value="">Choose an available option</option>{productVariants.map((variant) => <option key={variant._id} value={variant._id}>{variant.name}{variant.color ? ` · ${variant.color}` : ''}{variant.blouseOption ? ` · ${titleCase(variant.blouseOption)}` : ''}</option>)}</select></label>}
          </>}
          <label>{type === 'return' ? 'Return reason' : 'Exchange reason'}<select required value={reason} onChange={(event) => setReason(event.target.value)}><option value="">Choose a reason</option>{(type === 'return' ? returnReasons : exchangeReasons).map((item) => <option value={item} key={item}>{titleCase(item)}</option>)}</select></label>
          <label>Additional comments <span className="optional-label">Optional</span><textarea rows={4} maxLength={1500} value={reasonDetails} onChange={(event) => setReasonDetails(event.target.value)} placeholder="Share any details that will help us review your request." /></label>
          {type === 'return' && <div className="returns-evidence-field">
            <div><strong>Product photos</strong><span className="optional-label">Optional · up to 5 JPG, PNG or WebP images, 2 MB each</span></div>
            <label className="returns-upload-button"><Upload size={16} aria-hidden="true" /> Add photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addEvidence} disabled={selectedEvidence.length + uploadedEvidence.length >= 5} /></label>
            {(selectedEvidence.length > 0 || uploadedEvidence.length > 0) && <div className="returns-evidence-previews">{uploadedEvidence.map((image) => <span className="returns-evidence-preview" key={image.publicId || image.url}><img src={image.url} alt="Uploaded return evidence" /><small>Attached</small></span>)}{selectedEvidence.map(({ file, previewUrl }) => <span className="returns-evidence-preview" key={previewUrl}><img src={previewUrl} alt={`Preview of ${file.name}`} /><button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeEvidence(previewUrl)}><X size={13} /></button></span>)}</div>}
          </div>}
          <button className="button button-primary" type="submit" disabled={submitting || !deliveredOrders.length}>{submitting ? 'Submitting request…' : type === 'return' ? 'Submit return request' : 'Submit exchange request'} <ArrowRight size={15} /></button>
          {!deliveredOrders.length && <p className="quiet-note">Only delivered orders can be submitted for a return or exchange.</p>}
        </form>
      </section>

      <section className="returns-tracking-section" aria-labelledby="returns-tracking-title">
        <div className="returns-section-heading"><div><span className="eyebrow">Updates, all in one place</span><h2 id="returns-tracking-title">Track your requests</h2><p>Milestone dates appear when they are recorded by the store.</p></div></div>
        <div className="returns-requests-grid">
          <section><h3>Returns</h3>{renderRequestCards(requests, 'return')}</section>
          <section><h3>Exchanges</h3>{renderRequestCards(exchanges, 'exchange')}</section>
        </div>
      </section>

      <section className="returns-information-section" aria-labelledby="returns-information-title">
        <div className="returns-section-heading"><div><span className="eyebrow">Good to know</span><h2 id="returns-information-title">Returns, exchanges &amp; refunds</h2></div></div>
        <div className="returns-information-grid">
          <article><h3>Return policy</h3><p>Start a return request within five days of delivery. The store reviews each request and confirms eligibility before arranging next steps.</p><Link to="/policies/returns">View full policy <ArrowRight size={13} /></Link></article>
          <article><h3>Exchange policy</h3><p>Exchange requests are reviewed against your delivered order and the availability of the replacement product or option.</p><Link to="/policies/returns">View exchange details <ArrowRight size={13} /></Link></article>
          <article><h3>Refund information</h3><p>Refund processing begins after an approved return is received and reviewed. Check your order details for payment updates.</p><Link to="/policies/refunds">View refund information <ArrowRight size={13} /></Link></article>
        </div>
        <div className="returns-faq">
          <details><summary>How long do I have to make a request?</summary><p>Submit your request within five days of delivery. Final eligibility is checked by the store when you submit.</p></details>
          <details><summary>When will my refund or replacement arrive?</summary><p>Timing depends on review, pickup and inspection. We show the dates and updates recorded by the store in your request timeline.</p></details>
          <details><summary>What if my item is damaged or the return window has passed?</summary><p>Add clear product photos to a return request, or <Link to="/contact">contact support</Link> if your item is not currently eligible.</p></details>
        </div>
        <div className="returns-support-card"><div><span className="eyebrow">Need a hand?</span><h3>We are happy to help.</h3><p>Our team can answer questions about an order, eligibility or a request already in progress.</p></div><Link className="button button-outline" to="/contact">Contact support <ArrowRight size={14} /></Link></div>
      </section>
    </>}
  </div>;
}
