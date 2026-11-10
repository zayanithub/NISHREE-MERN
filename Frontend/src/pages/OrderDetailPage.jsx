import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, CircleHelp, Clock3, Download, FileDown, Headphones, Mail, MapPin, MessageCircle, Navigation, Package, PackageCheck, Phone, Printer, RefreshCw, RotateCcw, Send, Truck, X } from 'lucide-react';
import { toast } from 'sonner';
import { customerApi } from '../api/customerApi';
import { contactApi } from '../api/contactApi';
import { paymentApi } from '../api/paymentApi';
import { normalizeApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { ErrorState, LoadingState } from '../components/States';
import { useStoreSettings } from '../settings/useStoreSettings';
import { formatDate, formatPrice } from '../utils/format';
import ResponsiveImage from '../components/ResponsiveImage';
import { downloadInvoicePdf, downloadOrderSummary } from '../utils/orderDocuments';

const readable = (value = '') => value.replaceAll('_', ' ');
const shipmentSteps = [
  { status: 'confirmed', title: 'Order confirmed', detail: 'Nishree has received and confirmed your order.', Icon: Check },
  { status: 'processing', title: 'Order processing', detail: 'Your pieces are being prepared for dispatch.', Icon: Package },
  { status: 'ready_to_ship', title: 'Order packed', detail: 'Your parcel is packed and ready for courier pickup.', Icon: PackageCheck },
  { status: 'shipped', title: 'Shipped', detail: 'The courier has received your parcel.', Icon: Truck },
  { status: 'in_transit', title: 'In transit', detail: 'The latest carrier update will appear here when available.', Icon: Navigation },
  { status: 'out_for_delivery', title: 'Out for delivery', detail: 'The carrier has marked your parcel for final delivery.', Icon: MapPin },
  { status: 'delivered', title: 'Delivered', detail: 'Your parcel has reached its delivery destination.', Icon: CheckCircle2 },
];
const shipmentProgressRank = {
  confirmed: 0,
  pending: 1,
  ready_to_ship: 2,
  shipped: 3,
  in_transit: 4,
  out_for_delivery: 5,
  delivered: 6,
  delivery_failed: 5,
  returned_to_sender: 4,
};
const orderProgressRank = { pending_payment: -1, confirmed: 0, processing: 1, shipped: 3, delivered: 6, cancelled: -1 };
const shipmentExceptions = {
  cancelled: { title: 'Shipment cancelled', detail: 'This shipment was cancelled. Contact customer care if you need help with your order.', Icon: X },
  delivery_failed: { title: 'Delivery attempt missed', detail: 'The carrier could not complete a delivery attempt. Check the carrier details or contact customer care for help.', Icon: AlertTriangle },
  returned_to_sender: { title: 'Returning to sender', detail: 'The carrier is returning this parcel to Nishree Attire. Contact customer care for assistance.', Icon: RotateCcw },
};
const getWhatsAppSupportUrl = (settings, orderNumber) => {
  const number = String(settings.whatsappNumber || '').replace(/[^\d]/g, '');
  if (number) {
    return `https://wa.me/${number}?text=${encodeURIComponent(`Delivery support request for order ${orderNumber}`)}`;
  }
  if (!settings.whatsappUrl) return '';
  try {
    const url = new URL(settings.whatsappUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const currentText = url.searchParams.get('text') || '';
    url.searchParams.set('text', `${currentText}${currentText ? '\n' : ''}Delivery support request · Order ID: ${orderNumber}`);
    return url.toString();
  } catch {
    return '';
  }
};
const loadRazorpay = () => new Promise((resolve, reject) => {
  if (window.Razorpay) { resolve(); return; }
  let script = document.querySelector('script[data-razorpay-checkout]');
  if (script) {
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Secure payment window could not be loaded.')), { once: true });
    return;
  }
  script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.dataset.razorpayCheckout = 'true';
  script.onload = () => resolve();
  script.onerror = () => reject(new Error('Secure payment window could not be loaded.'));
  document.body.appendChild(script);
});

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loadedOrderId, setLoadedOrderId] = useState('');
  const [shipment, setShipment] = useState(null);
  const [shipmentError, setShipmentError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [referenceTime, setReferenceTime] = useState(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [supportBusy, setSupportBusy] = useState(false);
  const settings = useStoreSettings();

  const load = useCallback(async () => {
    try {
      const result = await customerApi.order(orderId);
      setOrder(result);
      setReferenceTime(Date.now());
      setError('');
      setLoadedOrderId(orderId);
      setShipmentError('');
      try {
        const data = await customerApi.shipment(orderId);
        setShipment(data.shipment || null);
      } catch (shipmentRequestError) {
        setShipment(null);
        if (shipmentRequestError.response?.status !== 404) {
          setShipmentError(normalizeApiError(shipmentRequestError).message);
        }
      }
    } catch (requestError) { setError(normalizeApiError(requestError).message); setLoadedOrderId(orderId); }
    finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const cancelOrder = async () => {
    if (!window.confirm('Would you like to cancel this order?')) return;
    setBusy(true);
    try { setOrder(await customerApi.cancelOrder(order._id)); toast.success('Your order was cancelled.'); }
    catch (requestError) { toast.error(normalizeApiError(requestError).message); }
    finally { setBusy(false); }
  };

  const retryPayment = async () => {
    setBusy(true);
    try {
      const initialized = await paymentApi.createRazorpayOrder(order._id, `order-${order._id}-${crypto.randomUUID()}`);
      await loadRazorpay();
      const { checkout, payment } = initialized;
      if (!window.Razorpay || !checkout?.keyId || !payment?._id) throw new Error('Payment setup could not be verified.');
      let verifying = false;
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
          verifying = true;
          try {
            const result = await paymentApi.verifyRazorpayPayment({ paymentId: payment._id, razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature });
            setOrder(result.order);
            if (result.order?.orderStatus === 'confirmed' && ['authorized', 'paid'].includes(result.order.paymentStatus)) toast.success('Payment verified and order confirmed.');
            else toast.info('Payment is still awaiting confirmation.');
          } catch (requestError) { toast.error(`The latest payment status could not be verified. ${normalizeApiError(requestError).message}`); void load(); }
        },
        modal: { ondismiss: () => { if (!verifying) { toast.info('Payment was not confirmed. The order remains in its current state.'); void load(); } } },
      });
      gateway.on('payment.failed', () => { verifying = true; toast.error('Payment was not completed. You can try again from this order.'); void load(); });
      gateway.open();
    } catch (requestError) { toast.error(normalizeApiError(requestError).message); }
    finally { setBusy(false); }
  };

  if (loading || loadedOrderId !== orderId) return <div className="page-loading"><LoadingState label="Opening your order…" /></div>;
  if (error || !order) return <div className="page-wrap"><ErrorState message={error || 'This order could not be found.'} onRetry={load} /></div>;
  const isNewCodOrder = searchParams.get('placed') === '1' && order.paymentMethod === 'cod';
  const canRetryPayment = order.paymentMethod === 'razorpay' && order.orderStatus === 'pending_payment' && ['pending', 'failed'].includes(order.paymentStatus);
  const canCancel = ['pending_payment', 'confirmed'].includes(order.orderStatus) && order.paymentStatus === 'pending';
  const address = shipment?.shippingAddress || order.shippingAddress;
  const destination = [address?.addressLine1, address?.addressLine2, address?.landmark, address?.city, address?.state, address?.postalCode, address?.country]
    .filter(Boolean)
    .join(', ');
  const mapUrl = destination ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}` : '';
  const isExceptionalShipment = Boolean(shipmentExceptions[shipment?.status]);
  const currentStage = shipment
    ? shipmentProgressRank[shipment.status] ?? orderProgressRank[order.orderStatus] ?? -1
    : orderProgressRank[order.orderStatus] ?? -1;
  const shipmentRank = shipment ? shipmentProgressRank[shipment.status] ?? -1 : currentStage;
  const orderRank = orderProgressRank[order.orderStatus] ?? -1;
  const showTrackingPanel = Boolean(shipment) || Boolean(shipmentError) || ['pending_payment', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'].includes(order.orderStatus);
  const phoneNumber = String(settings.supportPhone || '').replace(/[^\d+]/g, '');
  const whatsappUrl = getWhatsAppSupportUrl(settings, order.orderNumber);
  const returnWindowDays = Number(settings.returnWindowDays || 0);
  const returnDeadline = order.deliveredAt ? new Date(order.deliveredAt) : null;
  if (returnDeadline) returnDeadline.setDate(returnDeadline.getDate() + returnWindowDays);
  const returnEligible = order.orderStatus === 'delivered'
    && Boolean(returnDeadline && Number.isFinite(returnDeadline.getTime()))
    && returnWindowDays > 0
    && Boolean(referenceTime && referenceTime <= returnDeadline.getTime());

  const printOrder = () => window.print();
  const printInvoice = () => {
    document.body.dataset.printMode = 'invoice';
    const reset = () => {
      delete document.body.dataset.printMode;
      window.removeEventListener('afterprint', reset);
    };
    window.addEventListener('afterprint', reset, { once: true });
    window.setTimeout(() => window.print(), 50);
  };

  const submitSupportRequest = async (event) => {
    event.preventDefault();
    if (supportMessage.trim().length < 10) {
      toast.error('Please describe your delivery question in a little more detail.');
      return;
    }
    setSupportBusy(true);
    try {
      await contactApi.sendMessage({
        fullName: user?.name || order.customerName || 'Nishree customer',
        email: user?.email || order.customerEmail,
        subject: `Delivery support · Order ${order.orderNumber}`,
        message: `${supportMessage.trim()}\n\nOrder ID: ${order.orderNumber}`,
      });
      setSupportMessage('');
      setSupportOpen(false);
      toast.success('Your delivery question has been sent to Nishree support.');
    } catch (requestError) {
      toast.error(normalizeApiError(requestError).message);
    } finally {
      setSupportBusy(false);
    }
  };

  return <div className="page-wrap order-detail-page"><div className="breadcrumbs"><Link to="/account/orders">Order history</Link><span>/</span><span>{order.orderNumber}</span></div>
    <div className={`order-result-banner${order.orderStatus === 'delivered' ? ' is-success' : ''}`}><span className="result-icon">{order.orderStatus === 'delivered' || isNewCodOrder ? <CheckCircle2 size={23} /> : <PackageCheck size={23} />}</span><div><span className="eyebrow">{isNewCodOrder ? 'ORDER PLACED' : order.orderStatus === 'delivered' ? 'DELIVERY CONFIRMED' : 'ORDER STATUS'}</span><h1>{isNewCodOrder ? 'Your order is on its way to the team.' : order.orderStatus === 'delivered' ? 'Delivered successfully' : order.orderNumber}</h1><p>{isNewCodOrder ? 'Your order was saved successfully. We will share updates as its status changes.' : `${order.orderNumber} · Placed ${formatDate(order.createdAt)} · ${readable(order.orderStatus)}`}</p></div><div className="order-print-actions"><button className="order-print-button" type="button" onClick={printOrder}><Printer size={15} /> Print order details</button><button className="order-print-button" type="button" onClick={() => downloadInvoicePdf(order, settings.storeName)}><FileDown size={15} /> Download invoice PDF</button><button className="order-print-button" type="button" onClick={printInvoice}><Printer size={15} /> Print invoice</button><button className="order-print-button" type="button" onClick={() => downloadOrderSummary(order)}><Download size={15} /> Download summary</button><button className="icon-button" type="button" onClick={load} aria-label="Refresh order status"><RefreshCw size={17} /></button></div></div>
    <div className="order-detail-columns"><div className="order-detail-main">
      {shipmentError && <p className="admin-inline-error" role="alert">Delivery details could not be loaded. {shipmentError}</p>}
      {showTrackingPanel && <section className="shipment-panel"><div className="shipment-panel-heading"><div><span className="eyebrow">Delivery updates</span><h2><Truck size={18} /> Shipment tracking</h2></div>{shipment?.lastTrackingUpdateAt && <span className="shipment-live-update"><span /> Updated {new Date(shipment.lastTrackingUpdateAt).toLocaleString('en-IN')}</span>}</div>
        {address && <div className="shipment-destination shipment-map-first">
          <div className="shipment-map-preview"><span className="shipment-map-street street-one" /><span className="shipment-map-street street-two" /><span className="shipment-map-no-live"><MapPin size={16} aria-hidden="true" /> Courier location unavailable</span><span className="shipment-map-label">Delivery destination</span></div>
          <div className="shipment-destination-details"><div><span className="shipment-destination-kicker"><MapPin size={14} /> Delivering to</span><strong>{address.fullName}</strong><p>{destination}</p>{address.phone && <small>{address.phone}</small>}</div>{mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer">Open in Maps <Navigation size={13} /></a>}</div>
          <p className="shipment-map-disclaimer">Destination preview only · No courier GPS location or route is available for this shipment.</p>
        </div>}
        {shipment ? <>
          <div className={`shipment-current-status${isExceptionalShipment ? ' is-exception' : ''}${shipment.status === 'delivered' ? ' is-delivered' : ''}`} aria-live="polite">
            <span className="shipment-current-icon">{(() => { const Icon = shipmentExceptions[shipment.status]?.Icon || shipmentSteps[shipmentRank]?.Icon || Truck; return <Icon size={20} />; })()}</span>
            <div><span className="shipment-current-label">Latest available delivery update</span><strong>{shipmentExceptions[shipment.status]?.title || shipmentSteps[shipmentRank]?.title || readable(shipment.status)}</strong><p>{shipmentExceptions[shipment.status]?.detail || shipmentSteps[shipmentRank]?.detail || 'Your delivery status will appear here as it is updated.'}</p></div>
          </div>
          {shipment.status === 'delivery_failed' && shipment.failureReason && <p className="shipment-exception-detail"><strong>Carrier update:</strong> {shipment.failureReason}</p>}
          <ol className={`shipment-progress${isExceptionalShipment ? ' has-exception' : ''}`} aria-label="Shipment progress">
            {shipmentSteps.map((step) => {
              const index = shipmentProgressRank[step.status];
              const complete = shipmentRank > index || (shipment.status === 'delivery_failed' && index < shipmentRank) || (shipment.status === 'returned_to_sender' && index < shipmentRank);
              const current = shipmentRank === index;
              const date = step.status === 'confirmed' ? order.confirmedAt : step.status === 'shipped' ? shipment.shippedAt : step.status === 'delivered' ? shipment.deliveredAt : current ? shipment.lastTrackingUpdateAt : null;
              const stageMessage = complete && !date ? 'Completed · carrier timestamp not provided' : current && !date ? 'Current stage · no timestamp supplied' : !complete && !current ? 'Waiting for the next available update' : step.detail;
              return <li className={`${complete ? 'is-complete' : ''}${current ? ' is-current' : ''}`} key={step.status}><span className="shipment-progress-marker">{complete ? <CheckCircle2 size={15} /> : current ? <step.Icon size={15} /> : <span>{index + 1}</span>}</span><span className="shipment-progress-copy"><strong>{step.title}</strong><small>{stageMessage}</small>{date && <time dateTime={date}>{new Date(date).toLocaleString('en-IN')}</time>}</span></li>;
            })}
            {isExceptionalShipment && (() => {
              const exception = shipmentExceptions[shipment.status];
              const ExceptionIcon = exception.Icon;
              return <li className={`is-current is-exception status-${shipment.status}`} key={shipment.status}><span className="shipment-progress-marker"><ExceptionIcon size={15} /></span><span className="shipment-progress-copy"><strong>{exception.title}</strong><small>{shipment.status === 'delivery_failed' && shipment.failureReason ? shipment.failureReason : exception.detail}</small>{shipment.lastTrackingUpdateAt && <time dateTime={shipment.lastTrackingUpdateAt}>{formatDate(shipment.lastTrackingUpdateAt)}</time>}</span></li>;
            })()}
          </ol>
          {shipment.status === 'cancelled' && <p className="shipment-next-step">Your order status is <strong>{readable(order.orderStatus)}</strong>. If you need help arranging a replacement shipment, <Link to="/contact">contact customer care <ArrowRight size={13} /></Link>.</p>}
          {shipment.status === 'returned_to_sender' && <p className="shipment-next-step">For help with the next steps for your order, <Link to="/contact">contact customer care <ArrowRight size={13} /></Link>.</p>}
          {(shipment.carrier || shipment.trackingNumber || shipment.estimatedDeliveryAt) && <div className="shipment-detail-grid">
            {shipment.carrier && <div className="shipment-detail-card"><span>Courier partner</span><strong>{shipment.carrier}</strong>{shipment.serviceType && <small>{readable(shipment.serviceType)} service</small>}</div>}
            {shipment.trackingNumber && <div className="shipment-detail-card"><span>Tracking number</span><strong className="shipment-tracking-number">{shipment.trackingNumber}</strong></div>}
            {shipment.estimatedDeliveryAt && <div className="shipment-detail-card"><span>Estimated delivery</span><strong>{formatDate(shipment.estimatedDeliveryAt)}</strong></div>}
            {shipment.deliveryAttempts > 0 && <div className="shipment-detail-card"><span>Delivery attempts</span><strong>{shipment.deliveryAttempts}</strong></div>}
          </div>}
          {shipment.trackingUrl && <a className="shipment-carrier-link" href={shipment.trackingUrl} target="_blank" rel="noreferrer">Open carrier tracking <ArrowRight size={14} /></a>}
          {shipment.deliveredAt && <p className="shipment-delivered-note"><CheckCircle2 size={15} /> Delivered on {formatDate(shipment.deliveredAt)}</p>}
          {shipment.deliveryNotes && <p className="shipment-delivery-notes">{shipment.deliveryNotes}</p>}
        </> : <>
          <div className="shipment-current-status">
            <span className="shipment-current-icon">{order.orderStatus === 'cancelled' ? <X size={20} /> : order.orderStatus === 'pending_payment' ? <Clock3 size={20} /> : <Package size={20} />}</span>
            <div><span className="shipment-current-label">Latest available order update</span><strong>{order.orderStatus === 'pending_payment' ? 'Awaiting payment' : order.orderStatus === 'cancelled' ? 'Order cancelled' : order.orderStatus === 'processing' ? 'Being prepared' : order.orderStatus === 'shipped' ? 'Shipped' : order.orderStatus === 'delivered' ? 'Delivered' : 'Order confirmed'}</strong><p>{order.orderStatus === 'pending_payment' ? 'We will begin preparing your order once payment is confirmed.' : order.orderStatus === 'cancelled' ? 'This order was cancelled before a shipment was created.' : order.orderStatus === 'delivered' ? 'Your order is marked delivered. Delivery confirmation is shown below.' : 'Courier tracking details will appear here when the shipment is created.'}</p></div>
          </div>
          <ol className="shipment-progress shipment-order-progress" aria-label="Order preparation progress">
            {shipmentSteps.map((step, index) => {
              const reached = orderRank >= index;
              const current = orderRank === index;
              const date = step.status === 'confirmed' ? order.confirmedAt : null;
              const stageMessage = reached && !date ? 'Completed · update timestamp not available' : current && !date ? 'Current stage · carrier updates are not available yet' : !reached ? 'Waiting for the next order update' : step.detail;
              return <li className={`${reached && !current ? 'is-complete' : ''}${current ? 'is-current' : ''}`} key={step.status}><span className="shipment-progress-marker">{reached && !current ? <CheckCircle2 size={15} /> : current ? <step.Icon size={15} /> : <span>{index + 1}</span>}</span><span className="shipment-progress-copy"><strong>{step.title}</strong><small>{stageMessage}</small>{date && <time dateTime={date}>{new Date(date).toLocaleString('en-IN')}</time>}</span></li>;
            })}
            {order.orderStatus === 'cancelled' && <li className="is-current is-exception status-cancelled"><span className="shipment-progress-marker"><X size={15} /></span><span className="shipment-progress-copy"><strong>Order cancelled</strong><small>Your order was cancelled before dispatch.</small>{order.cancelledAt && <time dateTime={order.cancelledAt}>{formatDate(order.cancelledAt)}</time>}</span></li>}
          </ol>
        </>}
        {shipmentError && <p className="shipment-load-warning" role="alert">We could not refresh delivery details. {shipmentError}</p>}
      </section>}
      <section className="order-status-panel">
        <span className="eyebrow">Order status</span>
        <div className="status-overview"><div><strong>{readable(order.orderStatus)}</strong><small>Payment · {readable(order.paymentStatus)}</small></div><span className={`status-pill status-${order.orderStatus}`}>{readable(order.orderStatus)}</span></div>
        {canRetryPayment && <div className="payment-pending-note"><Clock3 size={17} /><span>This order is awaiting payment. It is not marked paid until the payment service confirms it.</span></div>}
        {canRetryPayment && <button type="button" className="button button-primary" disabled={busy} onClick={retryPayment}>{busy ? 'Preparing secure payment…' : 'Continue to payment'}<ArrowRight size={15} /></button>}
        {canCancel && <button type="button" className="button button-quiet cancel-order-button" disabled={busy} onClick={cancelOrder}>{busy ? 'Cancelling…' : 'Cancel order'}</button>}
      </section>
      <section className="order-items-panel">
        <div className="section-heading-row"><div><span className="eyebrow">Your selection</span><h2>Items in this order</h2><p className="order-section-description">Every item and option included in this purchase.</p></div></div>
        {order.items?.map((item) => <article className="order-detail-item" key={item._id}>
          <div className="order-detail-image">{item.image && <ResponsiveImage src={item.image} alt={item.productName || ''} loading="lazy" decoding="async" width="140" height="170" sizes="(max-width: 600px) 54px, 83px" />}</div>
          <div className="order-detail-item-copy"><strong>{item.productName}</strong>{item.categoryName && <small>Category · {item.categoryName}</small>}{item.variantName && <small>Selected option · {item.variantName}</small>}<span>SKU · {item.sku}</span><span>Quantity · {item.quantity}</span><span>{formatPrice(item.unitPrice, order.currency)} each</span>{Number(item.discountAmount) > 0 && <span>Discount · −{formatPrice(item.discountAmount, order.currency)}</span>}
            {returnEligible && <div className="order-request-links"><Link to={`/account/returns?orderId=${order._id}&orderItemId=${item._id}&type=return`}>Request return</Link><Link to={`/account/returns?orderId=${order._id}&orderItemId=${item._id}&type=exchange`}>Request exchange</Link></div>}
          </div><strong>{formatPrice(item.lineTotal, order.currency)}</strong>
        </article>)}
      </section>
      {order.orderStatus === 'delivered' && <p className="shipment-delivered-note order-delivery-confirmation"><CheckCircle2 size={16} /> Delivered on {formatDate(shipment?.deliveredAt || order.deliveredAt)}. Thank you for shopping with Nishree.</p>}
      <section className="order-support-panel">
        <div className="order-support-heading"><span className="order-support-icon"><Headphones size={20} aria-hidden="true" /></span><div><span className="eyebrow">HERE FOR YOU</span><h2>Contact Nishree</h2><p>Need help with this delivery? Your order number is included in every support request.</p></div></div>
        <div className="order-support-actions">
          <button type="button" className="button button-primary" onClick={() => setSupportOpen((open) => !open)} aria-expanded={supportOpen} aria-controls="order-support-form"><MessageCircle size={15} />{supportOpen ? 'Close support form' : 'Contact support'}</button>
          {whatsappUrl && <a className="button button-outline" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={15} />WhatsApp</a>}
          {settings.supportEmail && <a className="button button-outline" href={`mailto:${settings.supportEmail}?subject=${encodeURIComponent(`Delivery support · Order ${order.orderNumber}`)}&body=${encodeURIComponent(`Order ID: ${order.orderNumber}\n\n`)}`}><Mail size={15} />Email support</a>}
          {phoneNumber && <a className="button button-outline" href={`tel:${phoneNumber}`}><Phone size={15} />Call support</a>}
          <Link className="order-help-link" to="/faq"><CircleHelp size={15} />Order help & FAQs</Link>
        </div>
        {supportOpen && <form id="order-support-form" className="order-support-form" onSubmit={(event) => void submitSupportRequest(event)}>
          <label htmlFor="order-support-message">How can we help with this delivery?</label>
          <textarea id="order-support-message" value={supportMessage} onChange={(event) => setSupportMessage(event.target.value)} minLength={10} maxLength={3000} required placeholder="Tell us what happened or what you would like to know." />
          <small>Order ID {order.orderNumber} will be attached automatically.</small>
          <button className="button button-primary" type="submit" disabled={supportBusy}>{supportBusy ? 'Sending…' : 'Send delivery question'}<Send size={14} /></button>
        </form>}
        <div className="order-support-footer"><button type="button" className="order-report-issue" onClick={() => setSupportOpen(true)}>Report a delivery issue <ArrowRight size={14} /></button>{returnEligible && <span>Return or exchange requests are available until {formatDate(returnDeadline)}.</span>}</div>
      </section>
      </div><aside className="order-detail-summary"><span className="eyebrow">Order details</span><h2>Summary</h2><div className="summary-line"><span>Order ID</span><strong>{order.orderNumber}</strong></div><div className="summary-line"><span>Order date</span><strong>{formatDate(order.createdAt)}</strong></div><div className="summary-line"><span>Payment method</span><strong>{readable(order.paymentMethod)}</strong></div><div className="summary-line"><span>Payment status</span><strong>{readable(order.paymentStatus)}</strong></div><div className="summary-line"><span>Subtotal</span><strong>{formatPrice(order.subtotal, order.currency)}</strong></div>{order.discountAmount > 0 && <div className="summary-line discount-line"><span>Discount{order.couponCode ? ` · ${order.couponCode}` : ''}</span><strong>−{formatPrice(order.discountAmount, order.currency)}</strong></div>}<div className="summary-line"><span>Shipping</span><strong>{formatPrice(order.shippingAmount, order.currency)}</strong></div>{order.taxAmount > 0 && <div className="summary-line"><span>Tax</span><strong>{formatPrice(order.taxAmount, order.currency)}</strong></div>}<div className="summary-line order-total-line"><span>Total</span><strong>{formatPrice(order.totalAmount, order.currency)}</strong></div><div className="order-address"><MapPin size={16} /><div><strong>Delivery address</strong><span>{order.shippingAddress?.fullName}</span><span>{order.shippingAddress?.addressLine1}{order.shippingAddress?.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ''}</span><span>{order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.postalCode}</span><span>{order.shippingAddress?.country}</span></div></div>{shipment?.estimatedDeliveryAt && <div className="summary-line"><span>Estimated delivery</span><strong>{formatDate(shipment.estimatedDeliveryAt)}</strong></div>}{shipment?.carrier && <div className="summary-line"><span>Courier partner</span><strong>{shipment.carrier}</strong></div>}{shipment?.trackingNumber && <div className="summary-line"><span>Tracking ID / AWB</span><strong>{shipment.trackingNumber}</strong></div>}<Link className="text-link" to="/account/orders">View order history <ArrowRight size={14} /></Link></aside></div>
    <section className="print-invoice-only" aria-hidden="true"><h1>{settings.storeName || 'Nishree Attire'}</h1><p className="eyebrow">INVOICE</p><h2>Order {order.orderNumber}</h2><p>Order date: {formatDate(order.createdAt)}</p><p>{order.customerName || order.shippingAddress?.fullName} · {order.customerEmail}</p><h3>Delivery address</h3><p>{destination}</p>{order.items?.map((item) => <div className="print-invoice-line" key={item._id}><span>{item.productName} · {item.categoryName || 'Item'}{item.variantName ? ` · ${item.variantName}` : ''} · Qty {item.quantity}</span><strong>{formatPrice(item.lineTotal, order.currency)}</strong></div>)}<div className="print-invoice-total"><p>Subtotal <strong>{formatPrice(order.subtotal, order.currency)}</strong></p><p>Discount <strong>−{formatPrice(order.discountAmount, order.currency)}</strong></p><p>Shipping <strong>{formatPrice(order.shippingAmount, order.currency)}</strong></p><p>Tax <strong>{formatPrice(order.taxAmount, order.currency)}</strong></p><p>Total <strong>{formatPrice(order.totalAmount, order.currency)}</strong></p></div><p>Payment: {readable(order.paymentMethod)} · {readable(order.paymentStatus)}</p></section>
  </div>;
}
