import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Printer, Search } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../adminApi';
import { formatPrice } from '../../utils/format';
import { downloadCsv } from '../../utils/exportCsv';

const statuses = ['pending_payment', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'];
const orderTransitions = {
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: [],
  shipped: [],
  delivered: [],
  cancelled: [],
  return_requested: [],
  returned: [],
};
const title = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function OrderSearchForm({ initialSearch, onSearch }) {
  const [search, setSearch] = useState(initialSearch);

  const submit = (event) => {
    event.preventDefault();
    onSearch(search.trim());
  };

  return <form className="admin-search" onSubmit={submit}><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order number, customer name or email" aria-label="Search orders" /><button type="submit">Search</button></form>;
}

export default function AdminOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [exporting, setExporting] = useState(false);
  const search = searchParams.get('search') || '';
  const filter = searchParams.get('status') || '';
  const requestedPage = Number(searchParams.get('page') || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState('');
  const selected = orders.find((order) => String(order._id) === searchParams.get('order')) || null;
  const load = useCallback(async () => {
    try {
      const result = await adminApi.orders({ page, limit: 20, search: search || undefined, status: filter || undefined });
      setOrders(result.orders || []);
      setPagination(result.pagination || { page, totalPages: 1, total: (result.orders || []).length });
      setError('');
      return result.orders || [];
    } catch (requestError) { setError(requestError.response?.data?.message || 'Orders could not be loaded.'); }
    finally { setLoading(false); }
    return [];
  }, [search, filter, page]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const submitSearch = (term) => {
    const next = new URLSearchParams(searchParams);
    if (term) next.set('search', term);
    else next.delete('search');
    next.delete('page');
    setSearchParams(next);
  };

  const changeFilter = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('status', value);
    else next.delete('status');
    next.delete('page');
    setSearchParams(next);
  };

  const changePage = (nextPage) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage > 1) next.set('page', String(nextPage));
    else next.delete('page');
    setSearchParams(next);
  };

  const exportOrders = async () => {
    setExporting(true);
    try {
      const firstPage = await adminApi.orders({ page: 1, limit: 100, search: search || undefined, status: filter || undefined });
      const allOrders = [...(firstPage.orders || [])];
      for (let currentPage = 2; currentPage <= (firstPage.pagination?.totalPages || 1); currentPage += 1) {
        const result = await adminApi.orders({ page: currentPage, limit: 100, search: search || undefined, status: filter || undefined });
        allOrders.push(...(result.orders || []));
      }
      downloadCsv('nishree-orders.csv', [
        ['Order number', (order) => order.orderNumber],
        ['Placed at', (order) => order.createdAt ? new Date(order.createdAt).toISOString() : ''],
        ['Customer', (order) => order.customerName],
        ['Email', (order) => order.customerEmail],
        ['Phone', (order) => order.customerPhone],
        ['Order status', (order) => title(order.orderStatus)],
        ['Payment method', (order) => title(order.paymentMethod)],
        ['Payment status', (order) => title(order.paymentStatus)],
        ['Currency', (order) => order.currency],
        ['Subtotal', (order) => order.subtotal],
        ['Shipping', (order) => order.shippingAmount],
        ['Discount', (order) => order.discountAmount],
        ['Tax', (order) => order.taxAmount],
        ['Total', (order) => order.totalAmount],
        ['City', (order) => order.shippingAddress?.city],
        ['State', (order) => order.shippingAddress?.state],
        ['Postal code', (order) => order.shippingAddress?.postalCode],
      ], allOrders);
      toast.success(`Exported ${allOrders.length} orders.`);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Orders could not be exported.');
    } finally {
      setExporting(false);
    }
  };

  const closeDetails = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('order');
    setSearchParams(next, { replace: true });
  };

  const updateStatus = async (order, status) => {
    if (status === order.orderStatus) return;
    setUpdating(String(order._id));
    try { await adminApi.updateOrderStatus(order._id, status); toast.success(`Order ${order.orderNumber} updated to ${title(status)}.`); await load(); }
    catch (requestError) { toast.error(requestError.response?.data?.message || 'This order status transition was not accepted.'); }
    finally { setUpdating(''); }
  };

  return <div className="admin-page"><div className="admin-page-heading"><div><span className="eyebrow">Customer purchases</span><h1>Orders</h1><p>Review order details and move each order through its allowed workflow.</p></div><button className="admin-button-secondary admin-export-button" type="button" onClick={() => void exportOrders()} disabled={exporting || !pagination.total}><Download size={15} />{exporting ? 'Preparing export…' : 'Export all orders'}</button></div>
    <div className="admin-toolbar"><OrderSearchForm key={search} initialSearch={search} onSearch={submitSearch} /><label>Status<select value={filter} onChange={(event) => changeFilter(event.target.value)}><option value="">All statuses</option><option value="open">Open orders</option>{statuses.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select></label></div>
    {error && <p className="admin-inline-error" role="alert">{error}</p>}
    {loading ? <div className="admin-empty-state">Loading orders…</div> : orders.length ? <div className="admin-table-wrap"><table className="admin-table admin-orders-table"><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Payment</th><th>Amount</th><th>Order status</th></tr></thead><tbody>{orders.map((order) => <tr key={order._id}><td><button className="admin-table-link" type="button" onClick={() => { const next = new URLSearchParams(searchParams); next.set('order', order._id); setSearchParams(next); }}>{order.orderNumber}</button></td><td>{order.customerName}<small>{order.customerEmail}</small></td><td>{new Date(order.createdAt).toLocaleDateString('en-IN')}</td><td>{title(order.paymentMethod)}<small>{title(order.paymentStatus)}</small></td><td>{formatPrice(order.totalAmount, order.currency)}</td><td><select aria-label={`Update status for ${order.orderNumber}`} value={order.orderStatus} disabled={updating === String(order._id) || !orderTransitions[order.orderStatus]?.length} onChange={(event) => void updateStatus(order, event.target.value)}><option value={order.orderStatus}>{title(order.orderStatus)}</option>{(orderTransitions[order.orderStatus] || []).map((item) => <option key={item} value={item}>{title(item)}</option>)}</select></td></tr>)}</tbody></table></div> : <div className="admin-empty-state">No orders match this view.</div>}
    {!loading && pagination.totalPages > 1 && <div className="admin-pagination"><button className="admin-button-secondary" type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button><span>Page {page} of {pagination.totalPages} · {pagination.total} orders</span><button className="admin-button-secondary" type="button" disabled={page >= pagination.totalPages} onClick={() => changePage(page + 1)}>Next</button></div>}
    {selected && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetails(); }}><section className="admin-modal admin-order-modal" role="dialog" aria-modal="true" aria-labelledby="order-details-title"><header><div><span className="eyebrow">Order details</span><h2 id="order-details-title">{selected.orderNumber}</h2></div><div className="admin-table-actions"><button className="admin-button-secondary admin-export-button" type="button" onClick={() => window.print()}><Printer size={15} /> Print</button><button className="admin-icon-button" type="button" onClick={closeDetails} aria-label="Close">×</button></div></header>
      <div className="admin-order-facts"><div><small>Customer</small><strong>{selected.customerName}</strong><span>{selected.customerEmail}</span><span>{selected.customerPhone}</span></div><div><small>Payment</small><strong>{title(selected.paymentMethod)} · {title(selected.paymentStatus)}</strong><span>{title(selected.orderStatus)}</span><span>{new Date(selected.createdAt).toLocaleString('en-IN')}</span></div></div>
      <h3>Items</h3><div className="admin-order-items">{(selected.items || []).map((item, index) => <div key={item._id || index}><span>{item.productName || item.name || 'Saree'} × {item.quantity}</span><strong>{formatPrice(item.lineTotal, selected.currency)}</strong></div>)}</div>
      <div className="admin-order-total"><span>Total</span><strong>{formatPrice(selected.totalAmount, selected.currency)}</strong></div>
      <h3>Shipping address</h3><address className="admin-shipping-address">{selected.shippingAddress?.fullName}<br />{selected.shippingAddress?.addressLine1}<br />{selected.shippingAddress?.addressLine2 && <>{selected.shippingAddress.addressLine2}<br /></>}{selected.shippingAddress?.city}, {selected.shippingAddress?.state} {selected.shippingAddress?.postalCode}<br />{selected.shippingAddress?.country}<br />{selected.shippingAddress?.phone}</address>
    </section></div>}
  </div>;
}
