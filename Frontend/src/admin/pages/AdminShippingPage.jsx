import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, Save, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../adminApi';
import { formatDate, formatPrice } from '../../utils/format';
import { downloadCsv } from '../../utils/exportCsv';

const transitions = {
  pending: ['ready_to_ship', 'cancelled'],
  ready_to_ship: ['shipped', 'cancelled'],
  shipped: ['in_transit', 'out_for_delivery', 'delivery_failed', 'returned_to_sender'],
  in_transit: ['out_for_delivery', 'delivery_failed', 'returned_to_sender'],
  out_for_delivery: ['delivered', 'delivery_failed'],
  delivery_failed: ['in_transit', 'out_for_delivery', 'returned_to_sender'],
  delivered: [],
  returned_to_sender: [],
  cancelled: ['pending'],
};

const title = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';
const emptyDraft = {
  orderId: '',
  carrier: '',
  serviceType: 'standard',
  trackingNumber: '',
  trackingUrl: '',
  estimatedDeliveryAt: '',
  deliveryNotes: '',
};

export default function AdminShippingPage() {
  const [shipments, setShipments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shipmentPage, setShipmentPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [shipmentPagination, setShipmentPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [orderPagination, setOrderPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState('');
  const [editDraft, setEditDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [shipmentResult, orderResult] = await Promise.all([
        adminApi.shipments({ page: shipmentPage, limit: 20 }),
        adminApi.eligibleShipmentOrders({ page: orderPage, limit: 20 }),
      ]);
      const lastOrderPage = Math.max(1, orderResult?.pagination?.totalPages || 1);
      if (orderPage > lastOrderPage) {
        setOrderPage(lastOrderPage);
        return;
      }
      setShipments(shipmentResult?.shipments || []);
      setOrders(orderResult?.orders || []);
      setShipmentPagination(shipmentResult?.pagination || { page: shipmentPage, totalPages: 1, total: (shipmentResult?.shipments || []).length });
      setOrderPagination(orderResult?.pagination || { page: orderPage, totalPages: 1, total: (orderResult?.orders || []).length });
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Shipping details could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [orderPage, shipmentPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const createShipment = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await adminApi.createShipment({
        orderId: draft.orderId,
        carrier: draft.carrier.trim() || null,
        serviceType: draft.serviceType,
        trackingNumber: draft.trackingNumber.trim() || null,
        trackingUrl: draft.trackingUrl.trim() || null,
        estimatedDeliveryAt: draft.estimatedDeliveryAt || null,
        deliveryNotes: draft.deliveryNotes.trim(),
      });
      setDraft(emptyDraft);
      toast.success('Shipment created and linked to the order.');
      await load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'The shipment could not be created.');
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (shipment) => {
    setEditingId(String(shipment._id));
    setEditDraft({
      carrier: shipment.carrier || '',
      serviceType: shipment.serviceType || 'standard',
      trackingNumber: shipment.trackingNumber || '',
      trackingUrl: shipment.trackingUrl || '',
      estimatedDeliveryAt: dateInput(shipment.estimatedDeliveryAt),
      deliveryNotes: shipment.deliveryNotes || '',
    });
  };

  const saveDetails = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateShipment(editingId, {
        carrier: editDraft.carrier.trim() || null,
        serviceType: editDraft.serviceType,
        trackingNumber: editDraft.trackingNumber.trim() || null,
        trackingUrl: editDraft.trackingUrl.trim() || null,
        estimatedDeliveryAt: editDraft.estimatedDeliveryAt || null,
        deliveryNotes: editDraft.deliveryNotes.trim(),
      });
      setEditingId('');
      toast.success('Shipment details updated.');
      await load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Shipment details could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (shipment, status) => {
    if (status === shipment.status) return;
    const details = {};
    if (shipment.status === 'cancelled' && status === 'pending') {
      const reopen = window.confirm('Reopen this shipment? The previous carrier and tracking number will be cleared so you can enter replacement details.');
      if (!reopen) return;
    }
    if (status === 'delivery_failed') {
      const failureReason = window.prompt('Enter the delivery failure reason:');
      if (!failureReason?.trim()) return;
      details.failureReason = failureReason.trim();
    }
    setSaving(true);
    try {
      await adminApi.updateShipmentStatus(shipment._id, status, details);
      toast.success(`Shipment updated to ${title(status)}.`);
      await load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'The shipment status could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  const setDraftField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const setEditField = (field, value) => setEditDraft((current) => ({ ...current, [field]: value }));

  const exportShipments = async () => {
    setExporting(true);
    try {
      const firstPage = await adminApi.shipments({ page: 1, limit: 100 });
      const allShipments = [...(firstPage.shipments || [])];
      for (let currentPage = 2; currentPage <= (firstPage.pagination?.totalPages || 1); currentPage += 1) {
        const result = await adminApi.shipments({ page: currentPage, limit: 100 });
        allShipments.push(...(result.shipments || []));
      }
      downloadCsv('nishree-shipments.csv', [
        ['Order number', (shipment) => shipment.order?.orderNumber],
        ['Customer', (shipment) => shipment.order?.customerName],
        ['Order status', (shipment) => title(shipment.order?.orderStatus)],
        ['Carrier', (shipment) => shipment.carrier],
        ['Service type', (shipment) => title(shipment.serviceType)],
        ['Tracking number', (shipment) => shipment.trackingNumber],
        ['Tracking URL', (shipment) => shipment.trackingUrl],
        ['Shipment status', (shipment) => title(shipment.status)],
        ['Created at', (shipment) => shipment.createdAt ? new Date(shipment.createdAt).toISOString() : ''],
        ['Estimated delivery', (shipment) => shipment.estimatedDeliveryAt ? new Date(shipment.estimatedDeliveryAt).toISOString() : ''],
        ['Shipped at', (shipment) => shipment.shippedAt ? new Date(shipment.shippedAt).toISOString() : ''],
        ['Delivered at', (shipment) => shipment.deliveredAt ? new Date(shipment.deliveredAt).toISOString() : ''],
        ['Delivery attempts', (shipment) => shipment.deliveryAttempts],
        ['Failure reason', (shipment) => shipment.failureReason],
        ['Delivery notes', (shipment) => shipment.deliveryNotes],
        ['Delivery city', (shipment) => shipment.shippingAddress?.city],
        ['Delivery state', (shipment) => shipment.shippingAddress?.state],
        ['Postal code', (shipment) => shipment.shippingAddress?.postalCode],
      ], allShipments);
      toast.success(`Exported ${allShipments.length} shipments.`);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Shipments could not be exported.');
    } finally {
      setExporting(false);
    }
  };

  return <div className="admin-page">
    <div className="admin-page-heading">
      <div><span className="eyebrow">Order fulfilment</span><h1>Shipping</h1><p>Create shipments, update delivery details, and keep customers informed from their order page.</p></div>
      <div className="admin-shipping-actions"><button className="admin-button-secondary admin-export-button" type="button" onClick={() => void exportShipments()} disabled={exporting || !shipmentPagination.total}><Download size={15} />{exporting ? 'Preparing export…' : 'Export all'}</button><button className="admin-button-secondary" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Refresh</button></div>
    </div>

    {error && <p className="admin-inline-error" role="alert">{error}</p>}

    <form className="admin-panel admin-form-grid" onSubmit={createShipment}>
      <h2><Truck size={18} /> Create a shipment</h2>
      <label>Confirmed or processing order<select value={draft.orderId} onChange={(event) => setDraftField('orderId', event.target.value)} required><option value="">Choose an order</option>{orders.map((order) => <option key={order._id} value={order._id}>{order.orderNumber} · {order.customerName} · {title(order.orderStatus)}</option>)}</select><span className="admin-form-note">Confirmed orders move into processing and commit reserved stock when shipment creation begins.</span>{orderPagination.totalPages > 1 && <span className="admin-form-note">Page {orderPage} of {orderPagination.totalPages} · {orderPagination.total} eligible orders</span>}</label>
      {orderPagination.totalPages > 1 && <div className="admin-pagination admin-shipping-pagination"><button className="admin-button-secondary" type="button" disabled={orderPage <= 1 || loading} onClick={() => setOrderPage((page) => Math.max(1, page - 1))}>Previous orders</button><span>Page {orderPage} of {orderPagination.totalPages}</span><button className="admin-button-secondary" type="button" disabled={orderPage >= orderPagination.totalPages || loading} onClick={() => setOrderPage((page) => page + 1)}>Next orders</button></div>}
      <label>Carrier<input value={draft.carrier} onChange={(event) => setDraftField('carrier', event.target.value)} maxLength={120} placeholder="Courier name" /></label>
      <label>Service type<select value={draft.serviceType} onChange={(event) => setDraftField('serviceType', event.target.value)}><option value="standard">Standard</option><option value="express">Express</option><option value="same_day">Same day</option><option value="other">Other</option></select></label>
      <label>Tracking number<input value={draft.trackingNumber} onChange={(event) => setDraftField('trackingNumber', event.target.value)} maxLength={100} /></label>
      <label>Tracking URL<input type="url" value={draft.trackingUrl} onChange={(event) => setDraftField('trackingUrl', event.target.value)} maxLength={2048} placeholder="https://" /></label>
      <label>Estimated delivery<input type="date" value={draft.estimatedDeliveryAt} onChange={(event) => setDraftField('estimatedDeliveryAt', event.target.value)} /></label>
      <label className="admin-field-wide">Delivery notes<textarea value={draft.deliveryNotes} onChange={(event) => setDraftField('deliveryNotes', event.target.value)} maxLength={1000} rows={2} placeholder="Optional delivery information customers can see" /></label>
      <button className="admin-button-primary" type="submit" disabled={saving || !draft.orderId}><Truck size={15} /> {saving ? 'Saving…' : 'Create shipment'}</button>
      {!orders.length && !loading && <p className="admin-form-note">No confirmed or processing orders are currently eligible for shipment.</p>}
    </form>

    <section className="admin-panel">
      <div className="admin-panel-heading"><h2>Shipments</h2><span>{shipmentPagination.total} total · {shipments.length} on this page</span></div>
      {loading ? <div className="admin-empty-state">Loading shipments…</div> : shipments.length ? <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Order</th><th>Carrier and tracking</th><th>Estimated delivery</th><th>Shipping status</th><th>Details</th></tr></thead>
        <tbody>{shipments.map((shipment) => <tr key={shipment._id}>
          <td><strong>{shipment.order?.orderNumber || 'Order'}</strong><small>{shipment.order?.customerName || 'Customer'} · {formatPrice(shipment.shippingCost || 0, shipment.order?.currency || 'INR')}</small></td>
          <td>{shipment.carrier || 'Carrier not set'}<small>{shipment.trackingNumber || 'Tracking number not set'}</small>{shipment.trackingUrl && <a href={shipment.trackingUrl} target="_blank" rel="noreferrer">Open carrier tracking</a>}{shipment.deliveryAttempts > 0 && <small>Delivery attempts · {shipment.deliveryAttempts}</small>}{shipment.failureReason && <small className="admin-inline-error">{shipment.failureReason}</small>}{shipment.deliveryNotes && <small>{shipment.deliveryNotes}</small>}</td>
          <td>{shipment.estimatedDeliveryAt ? formatDate(shipment.estimatedDeliveryAt) : 'Not estimated'}</td>
          <td><select aria-label={`Update shipment status for ${shipment.order?.orderNumber || 'order'}`} value={shipment.status} disabled={saving || !transitions[shipment.status]?.length} onChange={(event) => void updateStatus(shipment, event.target.value)}><option value={shipment.status}>{title(shipment.status)}</option>{(transitions[shipment.status] || []).map((next) => <option key={next} value={next}>{title(next)}</option>)}</select></td>
          <td><button className="admin-button-secondary" type="button" disabled={saving} onClick={() => editingId === String(shipment._id) ? setEditingId('') : beginEdit(shipment)}>{editingId === String(shipment._id) ? 'Cancel' : 'Edit details'}</button></td>
        </tr>)}</tbody>
      </table></div> : <div className="admin-empty-state">No shipments have been created yet.</div>}
      {editingId && <form className="admin-form-grid admin-shipment-edit" onSubmit={saveDetails}>
        <h3>Update shipment details</h3>
        <label>Carrier<input value={editDraft.carrier || ''} onChange={(event) => setEditField('carrier', event.target.value)} maxLength={120} /></label>
        <label>Service type<select value={editDraft.serviceType || 'standard'} onChange={(event) => setEditField('serviceType', event.target.value)}><option value="standard">Standard</option><option value="express">Express</option><option value="same_day">Same day</option><option value="other">Other</option></select></label>
        <label>Tracking number<input value={editDraft.trackingNumber || ''} onChange={(event) => setEditField('trackingNumber', event.target.value)} maxLength={100} /></label>
        <label>Tracking URL<input type="url" value={editDraft.trackingUrl || ''} onChange={(event) => setEditField('trackingUrl', event.target.value)} maxLength={2048} /></label>
        <label>Estimated delivery<input type="date" value={editDraft.estimatedDeliveryAt || ''} onChange={(event) => setEditField('estimatedDeliveryAt', event.target.value)} /></label>
        <label className="admin-field-wide">Delivery notes<textarea value={editDraft.deliveryNotes || ''} onChange={(event) => setEditField('deliveryNotes', event.target.value)} maxLength={1000} rows={3} /></label>
        <button className="admin-button-primary" type="submit" disabled={saving}><Save size={15} /> Save details</button>
      </form>}
      {shipmentPagination.totalPages > 1 && <div className="admin-pagination"><button className="admin-button-secondary" type="button" disabled={shipmentPage <= 1 || loading} onClick={() => setShipmentPage((page) => Math.max(1, page - 1))}>Previous shipments</button><span>Page {shipmentPage} of {shipmentPagination.totalPages}</span><button className="admin-button-secondary" type="button" disabled={shipmentPage >= shipmentPagination.totalPages || loading} onClick={() => setShipmentPage((page) => page + 1)}>Next shipments</button></div>}
    </section>
  </div>;
}
