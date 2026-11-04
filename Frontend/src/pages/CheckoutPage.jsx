import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { ArrowLeft, ArrowRight, Check, Plus, ShieldCheck, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { customerApi } from '../api/customerApi';
import { paymentApi } from '../api/paymentApi';
import { normalizeApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { useCart } from '../cart/useCart';
import { ErrorState, LoadingState } from '../components/States';
import { formatPrice, productImage } from '../utils/format';
import { useDialogFocus } from '../hooks/useDialogFocus';

const checkoutSchema = z.object({
  addressId: z.string().min(1, 'Choose a delivery address.'),
  useSeparateBilling: z.boolean(),
  billingAddressId: z.string().optional(),
  paymentMethod: z.enum(['cod', 'razorpay']),
  policiesAccepted: z.boolean().refine((accepted) => accepted, 'Please review and accept the store policies before placing your order.'),
  notes: z.string().trim().max(1000, 'Keep delivery notes under 1,000 characters.').optional(),
});
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

const loadRazorpay = () => new Promise((resolve, reject) => {
  if (window.Razorpay) { resolve(true); return; }
  const existing = document.querySelector('script[data-razorpay-checkout]');
  if (existing) {
    existing.addEventListener('load', () => resolve(true), { once: true });
    existing.addEventListener('error', () => reject(new Error('Razorpay checkout could not be loaded.')), { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.dataset.razorpayCheckout = 'true';
  script.onload = () => resolve(true);
  script.onerror = () => reject(new Error('Razorpay checkout could not be loaded.'));
  document.body.appendChild(script);
});

function AddressModal({ onClose, onCreated }) {
  const dialogRef = useRef(null);
  const [saving, setSaving] = useState(false);
  useDialogFocus(true, dialogRef, onClose);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(addressSchema), defaultValues: { country: 'India', addressType: 'home', addressFor: 'both' } });
  const submit = async (values) => {
    setSaving(true);
    try {
      const address = await customerApi.createAddress(values);
      toast.success('Delivery address saved.');
      onCreated(address);
      onClose();
    } catch (error) { toast.error(normalizeApiError(error).message); }
    finally { setSaving(false); }
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} className="address-modal" role="dialog" aria-modal="true" aria-labelledby="address-modal-title"><header><div><span className="eyebrow">Where should we send it?</span><h2 id="address-modal-title">Add a delivery address</h2></div><button className="icon-button" type="button" aria-label="Close address form" onClick={onClose}><X size={18} /></button></header>
    <form className="address-form" onSubmit={handleSubmit(submit)} noValidate>
      <div className="form-two-columns"><label>Full name<input autoComplete="name" {...register('fullName')} />{errors.fullName && <span className="field-error">{errors.fullName.message}</span>}</label><label>Phone<input type="tel" autoComplete="tel" {...register('phone')} />{errors.phone && <span className="field-error">{errors.phone.message}</span>}</label></div>
      <label>Address line 1<input autoComplete="address-line1" {...register('addressLine1')} />{errors.addressLine1 && <span className="field-error">{errors.addressLine1.message}</span>}</label>
      <div className="form-two-columns"><label>Address line 2 <span className="optional-label">Optional</span><input autoComplete="address-line2" {...register('addressLine2')} /></label><label>Landmark <span className="optional-label">Optional</span><input {...register('landmark')} /></label></div>
      <div className="form-two-columns"><label>City<input autoComplete="address-level2" {...register('city')} />{errors.city && <span className="field-error">{errors.city.message}</span>}</label><label>State<input autoComplete="address-level1" {...register('state')} />{errors.state && <span className="field-error">{errors.state.message}</span>}</label></div>
      <div className="form-two-columns"><label>Postal code<input autoComplete="postal-code" {...register('postalCode')} />{errors.postalCode && <span className="field-error">{errors.postalCode.message}</span>}</label><label>Country<input autoComplete="country-name" {...register('country')} />{errors.country && <span className="field-error">{errors.country.message}</span>}</label></div>
      <div className="form-two-columns"><label>Address label<select {...register('addressType')}><option value="home">Home</option><option value="work">Work</option><option value="other">Other</option></select></label><label>Use this address for<select {...register('addressFor')}><option value="both">Shipping and billing</option><option value="shipping">Shipping only</option><option value="billing">Billing only</option></select></label></div>
      <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save address'} <ArrowRight size={15} /></button>
    </form>
  </section></div>;
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cart, loading: cartLoading, refresh: refreshCart } = useCart();
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressError, setAddressError] = useState('');
  const [addressModal, setAddressModal] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef(null);
  const navigate = useNavigate();
  const closeAddressModal = useCallback(() => setAddressModal(false), []);
  const { register, handleSubmit, setValue, getValues, control, formState: { errors } } = useForm({ resolver: zodResolver(checkoutSchema), defaultValues: { addressId: '', useSeparateBilling: false, billingAddressId: '', paymentMethod: 'cod', policiesAccepted: false, notes: '' } });
  const selectedAddress = useWatch({ control, name: 'addressId' });
  const useSeparateBilling = useWatch({ control, name: 'useSeparateBilling' });
  const selectedBillingAddress = useWatch({ control, name: 'billingAddressId' });
  const shippingAddresses = addresses.filter((address) => address.addressFor !== 'billing');
  const billingAddresses = addresses.filter((address) => address.addressFor !== 'shipping');

  const loadAddresses = useCallback(async () => {
    setAddressesLoading(true);
    setAddressError('');
    try {
      const result = await customerApi.addresses();
      setAddresses(result || []);
      const availableShipping = (result || []).filter((address) => address.addressFor !== 'billing');
      const availableBilling = (result || []).filter((address) => address.addressFor !== 'shipping');
      if (availableShipping.length && !getValues('addressId')) setValue('addressId', String(availableShipping.find((item) => item.isDefault)?._id || availableShipping[0]._id));
      if (availableBilling.length && !getValues('billingAddressId')) setValue('billingAddressId', String(availableBilling.find((item) => item.isDefault)?._id || availableBilling[0]._id));
    } catch (error) { setAddressError(normalizeApiError(error).message); }
    finally { setAddressesLoading(false); }
  }, [getValues, setValue]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAddresses(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAddresses]);
  const activeCoupon = coupon && Number(coupon.subtotal) === Number(cart?.subtotal) ? coupon : null;

  const addAddress = (address) => {
    setAddresses((current) => [...current, address]);
    if (address.addressFor !== 'billing') setValue('addressId', String(address._id));
    if (address.addressFor !== 'shipping') setValue('billingAddressId', String(address._id));
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponBusy(true);
    try {
      const result = await customerApi.validateCoupon(couponCode.trim());
      setCoupon(result);
      toast.success('Coupon applied to your bag.');
    } catch (error) { setCoupon(null); toast.error(normalizeApiError(error).message); }
    finally { setCouponBusy(false); }
  };

  const handleRazorpay = async (order) => {
    const orderId = String(order._id);
    try {
      idempotencyKey.current ||= `checkout-${orderId}-${crypto.randomUUID()}`;
      const initialized = await paymentApi.createRazorpayOrder(orderId, idempotencyKey.current);
      await loadRazorpay();
      const checkout = initialized.checkout;
      const payment = initialized.payment;
      if (!checkout?.keyId || !checkout?.orderId || !payment?._id || !window.Razorpay) throw new Error('Payment setup could not be verified.');
      let verificationStarted = false;
      const gateway = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: 'Nishree Attire',
        description: `Order ${order.orderNumber}`,
        order_id: checkout.orderId,
        prefill: { name: user?.name || '', email: user?.email || '', contact: user?.phone || '' },
        theme: { color: '#5d1728' },
        handler: async (response) => {
          verificationStarted = true;
          try {
            const verified = await paymentApi.verifyRazorpayPayment({
              paymentId: payment._id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            const state = verified.order;
            if (state?.orderStatus === 'confirmed' && ['authorized', 'paid'].includes(state.paymentStatus)) {
              toast.success('Payment verified and your order is confirmed.');
            } else {
              toast.info('Payment was received but is awaiting confirmation. Check the order status for updates.');
            }
            navigate(`/account/orders/${orderId}`, { replace: true });
          } catch {
            toast.error(`We could not verify this payment yet. Check order ${order.orderNumber} for its latest status.`);
            navigate(`/account/orders/${orderId}`, { replace: true });
          }
        },
        modal: { ondismiss: () => {
          if (!verificationStarted) {
            toast.info('Payment was not confirmed. Your order is saved with its current payment status.');
            navigate(`/account/orders/${orderId}`, { replace: true });
          }
        } },
      });
      gateway.on('payment.failed', () => {
        verificationStarted = true;
        toast.error('The payment was not completed. Your order remains available to review.');
        navigate(`/account/orders/${orderId}`, { replace: true });
      });
      gateway.open();
    } catch (error) {
      const paymentError = normalizeApiError(error);
      const message = paymentError.status === 401
        ? 'Your sign-in session could not be restored. Sign in again, then retry payment from the order details.'
        : paymentError.message;
      toast.error(`Order ${order.orderNumber} was created, but payment setup failed: ${message}`);
      navigate(`/account/orders/${orderId}`, { replace: true });
    }
  };

  const submit = async (values) => {
    if (!cart?.items?.length || !cart.canCheckout) {
      toast.error('Please review your bag availability before placing the order.');
      return;
    }
    if (values.useSeparateBilling && !values.billingAddressId) {
      toast.error('Choose a billing address or add one in your address book.');
      return;
    }
    setSubmitting(true);
    try {
      const order = await customerApi.createOrder({
        shippingAddressId: values.addressId,
        ...(values.useSeparateBilling ? { billingAddressId: values.billingAddressId } : {}),
        paymentMethod: values.paymentMethod,
        policiesAccepted: values.policiesAccepted,
        ...(activeCoupon?.code ? { couponCode: activeCoupon.code } : {}),
        ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
      });
      await refreshCart();
      if (values.paymentMethod === 'cod') {
        toast.success('Your order has been placed.');
        navigate(`/account/orders/${order._id}?placed=1`, { replace: true });
      } else {
        await handleRazorpay(order);
      }
    } catch (error) { toast.error(normalizeApiError(error).message); }
    finally { setSubmitting(false); }
  };

  const checkoutSubmit = (event) => {
    event.preventDefault();
    void handleSubmit(submit)(event);
  };

  if (cartLoading || addressesLoading) return <div className="page-loading"><LoadingState label="Preparing your checkout…" /></div>;
  if (!cart?.items?.length) return <div className="page-wrap checkout-page"><ErrorState message="Your account bag is empty. Guest bags are separate and are not merged when you sign in." /><Link to="/bag" className="text-link">Review your bag <ArrowRight size={15} /></Link></div>;

  return <div className="page-wrap checkout-page"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to="/bag">Your bag</Link><span>/</span><span>Checkout</span></div>
    <div className="checkout-heading"><span className="eyebrow">A few final details</span><h1>Checkout</h1><p>Review your delivery details and payment method. Your order total is confirmed by the server when the order is created.</p></div>
    <form className="checkout-layout" onSubmit={checkoutSubmit} noValidate>
      <div className="checkout-fields">
        <section className="checkout-section"><div className="checkout-section-heading"><span>01</span><div><h2>Delivery address</h2><p>Choose where your order should arrive.</p></div><button type="button" className="text-link" onClick={() => setAddressModal(true)}><Plus size={15} /> Add address</button></div>
          {addressError ? <ErrorState message={addressError} onRetry={loadAddresses} /> : shippingAddresses.length ? <div className="address-options">{shippingAddresses.map((address) => <label className={`address-option${selectedAddress === String(address._id) ? ' is-selected' : ''}`} key={address._id}><input type="radio" value={address._id} {...register('addressId')} /><span className="address-check"><Check size={13} /></span><span className="address-copy"><strong>{address.fullName}</strong><span>{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}</span>{address.landmark && <span>{address.landmark}</span>}<span>{address.city}, {address.state} {address.postalCode}</span><span>{address.country} · {address.phone}</span></span><span className="address-type">{address.addressType || 'home'}{address.isDefault ? ' · default' : ''}</span></label>)}</div> : <div className="inline-empty"><p>You do not have a saved delivery address yet.</p><button className="button button-outline" type="button" onClick={() => setAddressModal(true)}><Plus size={15} /> Add delivery address</button></div>}
          {errors.addressId && <span className="field-error">{errors.addressId.message}</span>}
          <label className="separate-billing-toggle"><input type="checkbox" {...register('useSeparateBilling')} /><span>Use a different billing address</span></label>
          {useSeparateBilling && <div className="address-options billing-address-options">{billingAddresses.length ? billingAddresses.map((address) => <label className={`address-option${selectedBillingAddress === String(address._id) ? ' is-selected' : ''}`} key={address._id}><input type="radio" value={String(address._id)} {...register('billingAddressId')} /><span className="address-check"><Check size={13} /></span><span className="address-copy"><strong>{address.fullName}</strong><span>{address.addressLine1}</span><span>{address.city}, {address.state} {address.postalCode}</span><span>{address.country} · {address.phone}</span></span><span className="address-type">{address.addressType || 'home'}</span></label>) : <div className="inline-empty"><p>No billing addresses saved yet.</p><Link className="button button-outline" to="/account/addresses">Manage addresses <ArrowRight size={14} /></Link></div>}</div>}
        </section>
        <section className="checkout-section"><div className="checkout-section-heading"><span>02</span><div><h2>Payment</h2><p>Choose an available method.</p></div></div>
          <div className="payment-options"><label className="payment-option"><input type="radio" value="cod" {...register('paymentMethod')} /><span><strong>Cash on delivery</strong><small>Pay when your order arrives.</small></span><span className="payment-mark">COD</span></label><label className="payment-option"><input type="radio" value="razorpay" {...register('paymentMethod')} /><span><strong>Pay online</strong><small>Continue securely with Razorpay.</small></span><span className="payment-mark">R</span></label></div>
        </section>
        <section className="checkout-section"><div className="checkout-section-heading"><span>03</span><div><h2>Delivery note</h2><p>Optional instructions for the store.</p></div></div><label className="notes-field"><span>Order note <span className="optional-label">Optional</span></span><textarea rows={3} maxLength={1000} {...register('notes')} placeholder="Add a short note for this order" />{errors.notes && <span className="field-error">{errors.notes.message}</span>}</label></section>
        <section className="checkout-section checkout-policy-section">
          <div className="checkout-section-heading"><span>04</span><div><h2>Store policies</h2><p>Please review the store terms before placing your order.</p></div></div>
          <p className="checkout-policy-links">
            {[
              ['Shipping policy', 'shipping'],
              ['Returns & exchanges', 'returns'],
              ['Refund policy', 'refunds'],
              ['Terms & conditions', 'terms'],
            ].map(([label, key], index) => (
              <span key={key}>
                {index > 0 && <span aria-hidden="true"> · </span>}
                <Link to={`/policies/${key}`} target="_blank" rel="noreferrer">{label}</Link>
              </span>
            ))}
          </p>
          <label className="policy-acceptance">
            <input type="checkbox" {...register('policiesAccepted')} aria-invalid={Boolean(errors.policiesAccepted)} aria-describedby={errors.policiesAccepted ? 'policy-acceptance-error' : undefined} />
            <span>I have reviewed and agree to the store policies linked above.</span>
          </label>
          {errors.policiesAccepted && <span id="policy-acceptance-error" className="field-error" role="alert">{errors.policiesAccepted.message}</span>}
        </section>
      </div>
      <aside className="checkout-summary"><span className="eyebrow">Your selection</span><h2>Order summary</h2><div className="checkout-items">{cart.items.map((item) => <div className="checkout-item" key={item._id}><div className="checkout-item-image">{(item.variant?.image?.url || productImage(item.product)) && <img src={item.variant?.image?.url || productImage(item.product)} alt="" loading="lazy" decoding="async" width="74" height="90" />}<span>{item.quantity}</span></div><div><strong>{item.product?.name}</strong>{item.variant?.name && <small>{item.variant.name}</small>}</div><span>{formatPrice(item.lineTotal, item.product?.currency)}</span></div>)}</div>
        <div className="coupon-form"><label htmlFor="coupon-code">Have a coupon?</label><div><input id="coupon-code" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Enter code" autoComplete="off" maxLength={50} disabled={Boolean(activeCoupon)} /><button className="button button-outline" type="button" disabled={couponBusy || (!activeCoupon && !couponCode.trim())} onClick={activeCoupon ? () => { setCoupon(null); toast.info('Coupon removed.'); } : () => void applyCoupon()}>{couponBusy ? 'Checking…' : activeCoupon ? 'Remove' : 'Apply'}</button></div>{activeCoupon && <p className="coupon-success"><Check size={14} /> {activeCoupon.code} applied · {formatPrice(activeCoupon.discountAmount)} off</p>}</div>
        <div className="summary-line"><span>Subtotal</span><strong>{formatPrice(cart.subtotal)}</strong></div>{activeCoupon && <div className="summary-line discount-line"><span>Coupon · {activeCoupon.code}</span><strong>−{formatPrice(activeCoupon.discountAmount)}</strong></div>}<p className="checkout-total-note">Shipping and any remaining order charges are confirmed in your saved order.</p><div className="summary-line checkout-total"><span>Current subtotal</span><strong>{formatPrice(activeCoupon?.totalAmount ?? cart.subtotal)}</strong></div>
        {!cart.canCheckout && <p className="summary-alert">One or more items need your attention before checkout.</p>}
        <button className="button button-primary checkout-submit" type="submit" disabled={submitting || !cart.canCheckout || !addresses.length}>{submitting ? 'Creating your order…' : 'Place order'}<ArrowRight size={16} /></button><p className="secure-note"><ShieldCheck size={14} /> Payment is only marked successful after server verification.</p><Link className="text-link summary-back" to="/bag"><ArrowLeft size={14} /> Return to your bag</Link>
      </aside>
    </form>
    {addressModal && <AddressModal onClose={closeAddressModal} onCreated={addAddress} />}
  </div>;
}
