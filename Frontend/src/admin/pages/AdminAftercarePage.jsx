import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../adminApi';
import { formatPrice } from '../../utils/format';
import AdminDataTools from '../components/AdminDataTools';

const tabs = [
  { id: 'returns', label: 'Returns', statuses: ['requested', 'under_review', 'approved', 'rejected', 'pickup_scheduled', 'in_transit', 'received', 'inspection_passed', 'inspection_failed', 'refund_pending', 'completed', 'cancelled'] },
  { id: 'exchanges', label: 'Exchanges', statuses: ['requested', 'under_review', 'approved', 'rejected', 'pickup_scheduled', 'original_in_transit', 'original_received', 'inspection_passed', 'inspection_failed', 'replacement_pending', 'replacement_shipped', 'completed', 'cancelled'] },
  { id: 'refunds', label: 'Refunds', statuses: ['requested', 'approved', 'processing', 'processed', 'rejected', 'failed', 'cancelled'] },
];

const returnTransitions = {
  approved: ['pickup_scheduled'],
  pickup_scheduled: ['in_transit'],
  in_transit: ['received'],
  received: ['inspection_passed', 'inspection_failed'],
  inspection_passed: ['refund_pending'],
};
const exchangeTransitions = {
  approved: ['pickup_scheduled'],
  pickup_scheduled: ['original_in_transit'],
  original_in_transit: ['original_received'],
  original_received: ['inspection_passed', 'inspection_failed'],
  inspection_passed: ['replacement_pending'],
  replacement_pending: ['replacement_shipped'],
  replacement_shipped: ['completed'],
};
const title = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const requestDate = (value) => value ? new Date(value).toLocaleDateString('en-IN') : '—';
const textField = (label, name, value, onChange, required = false) => <label key={name}>{label}<input value={value || ''} onChange={(event) => onChange(name, event.target.value)} required={required} maxLength={name.toLowerCase().includes('tracking') ? 200 : 1500} /></label>;

export default function AdminAftercarePage() {
  const [tab, setTab] = useState('returns');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [drafts, setDrafts] = useState({});
  const [rejecting, setRejecting] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = tab === 'returns'
        ? await adminApi.returnRequests({ page, limit: 25, status: filter || undefined })
        : tab === 'exchanges'
          ? await adminApi.exchangeRequests({ page, limit: 25, status: filter || undefined })
          : await adminApi.refunds({ page, limit: 25, status: filter || undefined });
      const list = tab === 'returns' ? result.requests : tab === 'exchanges' ? result.requests : result.refunds;
      setRecords(list || []);
      setPagination(result.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (requestError) {
      setRecords([]);
      setError(requestError.response?.data?.message || `${title(tab)} could not be loaded. Check your admin permissions and try again.`);
    } finally {
      setLoading(false);
    }
  }, [filter, page, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const changeTab = (nextTab) => {
    setTab(nextTab);
    setFilter('');
    setPage(1);
    setDrafts({});
    setRejecting('');
  };
  const setDraft = (id, name, value) => setDrafts((current) => ({
    ...current,
    [id]: { ...current[id], [name]: value },
  }));
  const run = async (id, action, successMessage) => {
    setBusy(String(id));
    try {
      await action();
      toast.success(successMessage);
      setDrafts((current) => { const next = { ...current }; delete next[id]; return next; });
      setRejecting('');
      await load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'The request could not be updated.');
    } finally {
      setBusy('');
    }
  };
  const review = (item, decision, reason = '') => {
    const id = String(item._id);
    if (tab === 'returns') {
      const body = decision === 'reject' ? { decision, rejectionReason: reason } : { decision };
      return run(id, () => adminApi.reviewReturn(id, body), `Return ${item.returnNumber} updated.`);
    }
    return run(id, () => adminApi.reviewExchange(id, decision === 'rejected'
      ? { status: decision, rejectionReason: reason }
      : { status: decision }), `Exchange ${item.exchangeNumber} updated.`);
  };
  const transition = (item) => {
    const id = String(item._id);
    const draft = drafts[id] || {};
    const body = tab === 'returns'
      ? { status: draft.status }
      : { status: draft.status };
    const fields = tab === 'returns'
      ? { pickupCarrier: draft.carrier, pickupTrackingNumber: draft.tracking, inspectionNotes: draft.notes, rejectionReason: draft.reason }
      : {
          originalPickupCarrier: draft.carrier,
          originalPickupTrackingNumber: draft.tracking,
          replacementCarrier: draft.carrier,
          replacementTrackingNumber: draft.tracking,
          inspectionNotes: draft.notes,
        };
    Object.entries(fields).forEach(([key, value]) => {
      if (value?.trim()) body[key] = value.trim();
    });
    const action = tab === 'returns'
      ? () => adminApi.updateReturnWorkflow(id, body)
      : () => adminApi.updateExchangeWorkflow(id, body);
    return run(id, action, `${title(tab.slice(0, -1))} workflow updated.`);
  };
  const createRefund = (item) => run(item._id, () => adminApi.createRefundForReturn(item._id), `Refund created for ${item.returnNumber}.`);

  const exportColumns = tab === 'returns'
    ? [
        ['Request ID', (item) => item.returnNumber],
        ['Date', (item) => item.createdAt ? new Date(item.createdAt).toISOString() : ''],
        ['Customer', (item) => item.user?.name || ''],
        ['Email', (item) => item.user?.email || ''],
        ['Order', (item) => item.order?.orderNumber || ''],
        ['Product', (item) => item.productName || item.product?.name || ''],
        ['Reason', (item) => title(item.reason)],
        ['Status', (item) => title(item.status)],
      ]
    : tab === 'exchanges'
      ? [
          ['Request ID', (item) => item.exchangeNumber],
          ['Date', (item) => item.createdAt ? new Date(item.createdAt).toISOString() : ''],
          ['Customer', (item) => item.user?.name || ''],
          ['Email', (item) => item.user?.email || ''],
          ['Order', (item) => item.order?.orderNumber || ''],
          ['Original product', (item) => item.originalProductName || ''],
          ['Replacement product', (item) => item.requestedProductName || item.requestedProduct?.name || ''],
          ['Status', (item) => title(item.status)],
        ]
      : [
          ['Refund ID', (item) => item.refundNumber],
          ['Date', (item) => item.createdAt ? new Date(item.createdAt).toISOString() : ''],
          ['Customer', (item) => item.user?.name || ''],
          ['Email', (item) => item.user?.email || ''],
          ['Order', (item) => item.order?.orderNumber || ''],
          ['Amount', (item) => Number(item.amount || 0)],
          ['Currency', (item) => item.currency || 'INR'],
          ['Reason', (item) => title(item.reason)],
          ['Status', (item) => title(item.status)],
        ];
  const exportFilteredRecords = async () => {
    const loadPage = (currentPage) => tab === 'returns'
      ? adminApi.returnRequests({ page: currentPage, limit: 100, status: filter || undefined })
      : tab === 'exchanges'
        ? adminApi.exchangeRequests({ page: currentPage, limit: 100, status: filter || undefined })
        : adminApi.refunds({ page: currentPage, limit: 100, status: filter || undefined });
    const recordsFrom = (result) => tab === 'refunds' ? result.refunds || [] : result.requests || [];
    const first = await loadPage(1);
    const allRecords = [...recordsFrom(first)];
    for (let currentPage = 2; currentPage <= (first.pagination?.totalPages || 1); currentPage += 1) {
      allRecords.push(...recordsFrom(await loadPage(currentPage)));
    }
    return allRecords;
  };

  const returnFields = (item, draft) => {
    if (draft.status === 'pickup_scheduled') return <>
      {textField('Pickup carrier', 'carrier', draft.carrier, (name, value) => setDraft(item._id, name, value), true)}
      {textField('Pickup tracking number (if available)', 'tracking', draft.tracking, (name, value) => setDraft(item._id, name, value))}
    </>;
    if (draft.status === 'inspection_passed') return textField('Inspection notes', 'notes', draft.notes, (name, value) => setDraft(item._id, name, value));
    if (draft.status === 'inspection_failed') return <>
      {textField('Inspection notes', 'notes', draft.notes, (name, value) => setDraft(item._id, name, value))}
      {textField('Failure reason', 'reason', draft.reason, (name, value) => setDraft(item._id, name, value), true)}
    </>;
    return null;
  };
  const exchangeFields = (item, draft) => {
    if (draft.status === 'pickup_scheduled') return <>
      {textField('Pickup carrier', 'carrier', draft.carrier, (name, value) => setDraft(item._id, name, value))}
      {textField('Pickup tracking number', 'tracking', draft.tracking, (name, value) => setDraft(item._id, name, value))}
    </>;
    if (draft.status === 'original_in_transit') return <>
      {textField('Original pickup carrier', 'carrier', draft.carrier || item.originalPickupCarrier, (name, value) => setDraft(item._id, name, value), true)}
      {textField('Original pickup tracking number', 'tracking', draft.tracking || item.originalPickupTrackingNumber, (name, value) => setDraft(item._id, name, value), true)}
    </>;
    if (draft.status === 'inspection_passed' || draft.status === 'inspection_failed') return textField('Inspection notes', 'notes', draft.notes, (name, value) => setDraft(item._id, name, value), draft.status === 'inspection_failed');
    if (draft.status === 'replacement_shipped') return <>
      {textField('Replacement carrier', 'carrier', draft.carrier, (name, value) => setDraft(item._id, name, value), true)}
      {textField('Replacement tracking number', 'tracking', draft.tracking, (name, value) => setDraft(item._id, name, value), true)}
    </>;
    return null;
  };

  const reviewControls = (item, number, status, rejectedStatus) => <div className="admin-aftercare-actions">
    {['requested', 'under_review'].includes(status) && <>
      {tab === 'returns' && status === 'requested' && <button className="admin-button-secondary" type="button" disabled={busy === String(item._id)} onClick={() => void review(item, 'under_review')}>Mark under review</button>}
      <button className="admin-button-primary" type="button" disabled={busy === String(item._id)} onClick={() => void review(item, tab === 'returns' ? 'approve' : 'approved')}>Approve</button>
      {rejecting === String(item._id)
        ? <form className="admin-reject-form" onSubmit={(event) => { event.preventDefault(); const reason = new FormData(event.currentTarget).get('reason'); void review(item, rejectedStatus, String(reason || '').trim()); }}>
            <label>Reason for rejection<input name="reason" required maxLength={1500} /></label><button className="admin-button-secondary" type="submit" disabled={busy === String(item._id)}>Confirm rejection</button><button className="admin-button-secondary" type="button" onClick={() => setRejecting('')}>Cancel</button>
          </form>
        : <button className="admin-button-secondary" type="button" disabled={busy === String(item._id)} onClick={() => setRejecting(String(item._id))}>Reject</button>}
    </>}
    {number && <span className={`admin-status status-${status}`}>{title(status)}</span>}
  </div>;

  const renderReturn = (item) => {
    const id = String(item._id);
    const draft = drafts[id] || {};
    const nextStatuses = returnTransitions[item.status] || [];
    return <article className="admin-aftercare-card" key={id}>
      <div className="admin-aftercare-card-heading"><div><span className="eyebrow">{item.returnNumber} · {requestDate(item.createdAt)}</span><h2>{item.productName || item.product?.name || 'Return request'}{item.sku ? ` · ${item.sku}` : ''}</h2></div><span className={`admin-status status-${item.status}`}>{title(item.status)}</span></div>
      <div className="admin-aftercare-details"><span><small>Customer</small>{item.user?.name || item.user?.email || 'Customer'}{item.user?.email && item.user?.name && <small>{item.user.email}</small>}</span><span><small>Order</small>{item.order?.orderNumber || 'Order details unavailable'}</span><span><small>Quantity</small>{item.quantity}</span><span><small>Reason</small>{title(item.reason)}</span></div>
      {item.reasonDetails && <p className="admin-aftercare-note">{item.reasonDetails}</p>}
      {reviewControls(item, item.returnNumber, item.status, 'reject')}
      {nextStatuses.length > 0 && <form className="admin-workflow-form" onSubmit={(event) => { event.preventDefault(); void transition(item); }}>
        <label>Next workflow step<select required value={draft.status || ''} onChange={(event) => setDraft(id, 'status', event.target.value)}><option value="">Choose status</option>{nextStatuses.map((status) => <option key={status} value={status}>{title(status)}</option>)}</select></label>
        {returnFields(item, draft)}
        <button className="admin-button-secondary" type="submit" disabled={busy === id || !draft.status}>{busy === id ? 'Saving…' : 'Update return'}</button>
      </form>}
      {item.status === 'refund_pending' && (item.refund
        ? <p className="admin-aftercare-note">A refund record is linked to this return. Review its current status in Refunds.</p>
        : <button className="admin-button-primary" type="button" disabled={busy === id} onClick={() => void createRefund(item)}>Create refund</button>)}
      {item.pickupCarrier && <p className="admin-aftercare-note">Pickup: {item.pickupCarrier}{item.pickupTrackingNumber ? ` · ${item.pickupTrackingNumber}` : ''}</p>}
    </article>;
  };

  const renderExchange = (item) => {
    const id = String(item._id);
    const draft = drafts[id] || {};
    const nextStatuses = exchangeTransitions[item.status] || [];
    const difference = Number(item.priceDifference || 0);
    return <article className="admin-aftercare-card" key={id}>
      <div className="admin-aftercare-card-heading"><div><span className="eyebrow">{item.exchangeNumber} · {requestDate(item.createdAt)}</span><h2>{item.originalProductName || 'Exchange request'}</h2></div><span className={`admin-status status-${item.status}`}>{title(item.status)}</span></div>
      <div className="admin-aftercare-details"><span><small>Customer</small>{item.user?.name || item.user?.email || 'Customer'}{item.user?.email && item.user?.name && <small>{item.user.email}</small>}</span><span><small>Order</small>{item.order?.orderNumber || 'Order details unavailable'}</span><span><small>Requested replacement</small>{item.requestedProductName || item.requestedProduct?.name || 'Replacement variant'}</span><span><small>Quantity</small>{item.quantity}</span></div>
      {item.reasonDetails && <p className="admin-aftercare-note">{item.reasonDetails}</p>}
      {reviewControls(item, item.exchangeNumber, item.status, 'rejected')}
      {nextStatuses.length > 0 && <form className="admin-workflow-form" onSubmit={(event) => { event.preventDefault(); void transition(item); }}>
        <label>Next workflow step<select required value={draft.status || ''} onChange={(event) => setDraft(id, 'status', event.target.value)}><option value="">Choose status</option>{nextStatuses.map((status) => <option key={status} value={status}>{title(status)}</option>)}</select></label>
        {exchangeFields(item, draft)}
        <button className="admin-button-secondary" type="submit" disabled={busy === id || !draft.status}>{busy === id ? 'Saving…' : 'Update exchange'}</button>
      </form>}
      {item.status === 'replacement_pending' && item.priceDifferenceStatus === 'pending' && <form className="admin-workflow-form" onSubmit={(event) => { event.preventDefault(); const settlement = difference > 0 ? 'paid' : 'refunded'; if (!window.confirm(`Record this ${settlement} only after verifying the actual payment or refund has completed.`)) return; void run(id, () => adminApi.settleExchangePriceDifference(id, { status: settlement, reference: draft.reference }), `Exchange price difference recorded as ${title(settlement)}.`); }}>
        <strong>Price difference: {formatPrice(Math.abs(difference))} · {difference > 0 ? 'collect payment' : 'refund customer'}</strong>
        {textField('Verified payment/refund reference', 'reference', draft.reference, (name, value) => setDraft(id, name, value), true)}
        <button className="admin-button-secondary" type="submit" disabled={busy === id || !draft.reference?.trim()}>Record verified settlement</button>
      </form>}
      {item.replacementCarrier && <p className="admin-aftercare-note">Replacement: {item.replacementCarrier}{item.replacementTrackingNumber ? ` · ${item.replacementTrackingNumber}` : ''}</p>}
    </article>;
  };

  const renderRefund = (item) => {
    const id = String(item._id);
    const draft = drafts[id] || {};
    const manual = item.refundMethod === 'manual';
    return <article className="admin-aftercare-card" key={id}>
      <div className="admin-aftercare-card-heading"><div><span className="eyebrow">{item.refundNumber} · {requestDate(item.createdAt)}</span><h2>{formatPrice(item.amount, item.currency)} refund</h2></div><span className={`admin-status status-${item.status}`}>{title(item.status)}</span></div>
      <div className="admin-aftercare-details"><span><small>Order</small>{item.order?.orderNumber || 'Order details unavailable'}</span><span><small>Customer</small>{item.user?.name || item.user?.email || 'Customer'}{item.user?.email && item.user?.name && <small>{item.user.email}</small>}</span><span><small>Method</small>{manual ? 'Manual payout' : 'Original payment'}</span><span><small>Reason</small>{title(item.reason)}</span></div>
      {item.reasonDetails && <p className="admin-aftercare-note">{item.reasonDetails}</p>}
      {item.status === 'requested' && <div className="admin-aftercare-actions">
        <button className="admin-button-primary" type="button" disabled={busy === id} onClick={() => void run(id, () => adminApi.approveRefund(id), `Refund ${item.refundNumber} approved.`)}>Approve refund</button>
        <button className="admin-button-secondary" type="button" disabled={busy === id} onClick={() => setRejecting(rejecting === id ? '' : id)}>Reject refund</button>
      </div>}
      {item.status === 'requested' && rejecting === id && <form className="admin-workflow-form" onSubmit={(event) => {
        event.preventDefault();
        const reason = String(new FormData(event.currentTarget).get('reason') || '').trim();
        void run(id, () => adminApi.rejectRefund(id, { rejectionReason: reason }), `Refund ${item.refundNumber} rejected.`);
      }}>
        <label>Reason for rejection<input name="reason" required maxLength={500} /></label>
        <button className="admin-button-secondary" type="submit" disabled={busy === id}>Confirm rejection</button>
        <button className="admin-button-secondary" type="button" onClick={() => setRejecting('')}>Cancel</button>
      </form>}
      {item.status === 'approved' && <button className="admin-button-primary" type="button" disabled={busy === id} onClick={() => {
        const confirmed = manual
          ? window.confirm('This starts an external manual payout workflow. Do not mark the payout complete here; confirm completion only after the transfer is verified.')
          : window.confirm('Submit this real refund to the original payment provider now?');
        if (confirmed) void run(id, () => adminApi.processRefund(id), manual ? 'Manual payout started. Confirm only after external payment is verified.' : 'Refund submitted to payment provider.');
      }}>{manual ? 'Start manual payout' : 'Submit gateway refund'}</button>}
      {item.status === 'processing' && manual && <form className="admin-workflow-form" onSubmit={(event) => { event.preventDefault(); if (!window.confirm('Confirm that the external payout has completed and the reference has been verified.')) return; void run(id, () => adminApi.processRefund(id, { method: draft.method, reference: draft.reference }), 'Verified manual payout recorded.'); }}>
        <label>Payout method<select value={draft.method || ''} onChange={(event) => setDraft(id, 'method', event.target.value)} required><option value="">Select method</option><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cash">Cash</option><option value="other">Other</option></select></label>
        {textField('Verified payout reference', 'reference', draft.reference, (name, value) => setDraft(id, name, value), true)}
        <button className="admin-button-primary" type="submit" disabled={busy === id || !draft.method || !draft.reference?.trim()}>Confirm completed payout</button>
        {textField('Failure reason (only if payout failed)', 'failureReason', draft.failureReason, (name, value) => setDraft(id, name, value))}
        <button className="admin-button-secondary" type="button" disabled={busy === id || !draft.failureReason?.trim()} onClick={() => { if (window.confirm('Record this manual payout as failed?')) void run(id, () => adminApi.processRefund(id, { failureReason: draft.failureReason }), 'Manual payout failure recorded.'); }}>Record payout failure</button>
      </form>}
      {item.status === 'processing' && !manual && <p className="admin-aftercare-note">Gateway refund is processing or awaiting reconciliation. Do not resubmit.</p>}
      {item.failureReason && <p className="admin-inline-error">{item.failureReason}</p>}
      {item.rejectionReason && <p className="admin-aftercare-note">Rejection reason: {item.rejectionReason}</p>}
    </article>;
  };

  const activeTab = tabs.find((item) => item.id === tab);
  return <div className="admin-page">
    <div className="admin-page-heading"><div><span className="eyebrow">Customer care workflows</span><h1>Returns, exchanges &amp; refunds</h1><p>Review requests, progress verified fulfillment steps and reconcile refunds without recording unverified payments.</p></div><div className="admin-heading-actions"><AdminDataTools filename={`nishree-${tab}`} columns={exportColumns} rows={records} loadRows={exportFilteredRecords} disabled={!pagination.total} /><button className="admin-button-secondary" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Refresh</button></div></div>
    <div className="admin-aftercare-tabs" role="tablist" aria-label="Customer care management">
      {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'is-active' : ''} onClick={() => changeTab(item.id)}>{item.label}</button>)}
    </div>
    <div className="admin-toolbar"><label>Status<select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}><option value="">All statuses</option>{activeTab.statuses.map((status) => <option key={status} value={status}>{title(status)}</option>)}</select></label><span className="admin-aftercare-count">{pagination.total} {tab}</span></div>
    {error && <p className="admin-inline-error" role="alert">{error}</p>}
    {loading ? <div className="admin-empty-state">Loading {tab}…</div> : records.length ? <div className="admin-aftercare-list">{records.map((item) => tab === 'returns' ? renderReturn(item) : tab === 'exchanges' ? renderExchange(item) : renderRefund(item))}</div> : <div className="admin-empty-state">No {tab} match this view.</div>}
    {pagination.totalPages > 1 && <div className="admin-pagination"><button className="admin-button-secondary" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span>Page {page} of {pagination.totalPages}</span><button className="admin-button-secondary" type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
  </div>;
}
