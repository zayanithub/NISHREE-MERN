import { useCallback, useEffect, useState } from 'react';
import { Pencil, RefreshCw, Save, Tag, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../adminApi';
import { formatPrice } from '../../utils/format';

const currentDateTime = (value) => {
  const date = value ? new Date(value) : new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const makeDraft = () => ({
  code: '',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  maxDiscount: '',
  minimumOrderValue: '0',
  startsAt: currentDateTime(),
  expiresAt: currentDateTime(Date.now() + 30 * 24 * 60 * 60 * 1000),
  usageLimit: '',
  perUserLimit: '1',
  applicableCategories: [],
  applicableProducts: [],
});

const populatedIds = (values = []) => values.map((value) => String(value?._id || value));

export default function AdminCouponPage() {
  const [coupons, setCoupons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [draft, setDraft] = useState(makeDraft);
  const [editingId, setEditingId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await adminApi.coupons({ page: 1, limit: 100, search: search.trim() || undefined });
      setCoupons(result.coupons || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Coupons could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let active = true;
    Promise.all([
      adminApi.categories({ page: 1, limit: 100 }),
      adminApi.products({ page: 1, limit: 100 }),
    ]).then(([categoryResult, productResult]) => {
      if (!active) return;
      setCategories(categoryResult.categories || []);
      setProducts(productResult.products || []);
    }).catch((error) => {
      if (active) toast.error(error.response?.data?.message || 'Coupon restrictions could not be loaded.');
    });
    return () => { active = false; };
  }, []);

  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const resetForm = () => { setDraft(makeDraft()); setEditingId(''); };
  const edit = (coupon) => {
    setDraft({
      code: coupon.code || '',
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      maxDiscount: coupon.maxDiscount == null ? '' : String(coupon.maxDiscount),
      minimumOrderValue: String(coupon.minimumOrderValue || 0),
      startsAt: currentDateTime(coupon.startsAt),
      expiresAt: currentDateTime(coupon.expiresAt),
      usageLimit: coupon.usageLimit == null ? '' : String(coupon.usageLimit),
      perUserLimit: String(coupon.perUserLimit || 1),
      applicableCategories: populatedIds(coupon.applicableCategories),
      applicableProducts: populatedIds(coupon.applicableProducts),
    });
    setEditingId(coupon._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      code: draft.code.trim().toUpperCase(),
      description: draft.description.trim(),
      discountType: draft.discountType,
      discountValue: Number(draft.discountValue),
      maxDiscount: draft.discountType === 'percentage' && draft.maxDiscount !== '' ? Number(draft.maxDiscount) : null,
      minimumOrderValue: Number(draft.minimumOrderValue || 0),
      startsAt: new Date(draft.startsAt).toISOString(),
      expiresAt: new Date(draft.expiresAt).toISOString(),
      usageLimit: draft.usageLimit === '' ? null : Number(draft.usageLimit),
      perUserLimit: Number(draft.perUserLimit),
      applicableCategories: draft.applicableCategories,
      applicableProducts: draft.applicableProducts,
    };
    try {
      if (editingId) {
        await adminApi.updateCoupon(editingId, payload);
        toast.success('Coupon updated.');
      } else {
        await adminApi.createCoupon(payload);
        toast.success('Coupon created.');
      }
      resetForm();
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'The coupon could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const setReferences = (key, event) => {
    updateDraft(key, Array.from(event.target.selectedOptions, (option) => option.value));
  };

  const toggleStatus = async (coupon) => {
    try {
      await adminApi.updateCouponStatus(coupon._id, !coupon.isActive);
      toast.success(`Coupon ${coupon.isActive ? 'deactivated' : 'activated'}.`);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Coupon status could not be changed.');
    }
  };

  const remove = async (coupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}? Used coupons cannot be removed.`)) return;
    try {
      await adminApi.deleteCoupon(coupon._id);
      toast.success('Coupon deleted.');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Coupon could not be deleted.');
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div><span className="eyebrow">Offers and promotions</span><h1>Coupons</h1><p>Manage active codes and checkout eligibility. Discounts are validated and calculated by the server.</p></div>
      </div>
      <form className="admin-panel admin-coupon-form" onSubmit={save}>
        <div className="admin-panel-heading"><h2><Tag size={18} /> {editingId ? 'Edit coupon' : 'Create a coupon'}</h2></div>
        <div className="admin-form-grid">
          <label>Coupon code<input value={draft.code} onChange={(event) => updateDraft('code', event.target.value)} minLength={3} maxLength={50} pattern="[A-Za-z0-9][A-Za-z0-9_-]*" required /></label>
          <label>Description<input value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} maxLength={500} /></label>
          <label>Discount type<select value={draft.discountType} onChange={(event) => updateDraft('discountType', event.target.value)}><option value="percentage">Percentage</option><option value="fixed">Fixed amount (INR)</option></select></label>
          <label>Discount value<input type="number" min="0.01" max={draft.discountType === 'percentage' ? 100 : undefined} step="0.01" value={draft.discountValue} onChange={(event) => updateDraft('discountValue', event.target.value)} required /></label>
          <label>Maximum percentage discount<input type="number" min="0.01" step="0.01" value={draft.maxDiscount} onChange={(event) => updateDraft('maxDiscount', event.target.value)} disabled={draft.discountType !== 'percentage'} /></label>
          <label>Minimum order value (INR)<input type="number" min="0" step="0.01" value={draft.minimumOrderValue} onChange={(event) => updateDraft('minimumOrderValue', event.target.value)} required /></label>
          <label>Starts at<input type="datetime-local" value={draft.startsAt} onChange={(event) => updateDraft('startsAt', event.target.value)} required /></label>
          <label>Expires at<input type="datetime-local" value={draft.expiresAt} onChange={(event) => updateDraft('expiresAt', event.target.value)} required /></label>
          <label>Total usage limit<input type="number" min="1" step="1" value={draft.usageLimit} onChange={(event) => updateDraft('usageLimit', event.target.value)} placeholder="No limit" /></label>
          <label>Uses per customer<input type="number" min="1" step="1" value={draft.perUserLimit} onChange={(event) => updateDraft('perUserLimit', event.target.value)} required /></label>
          <label>Applicable categories<select multiple value={draft.applicableCategories} onChange={(event) => setReferences('applicableCategories', event)}>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select><small>Leave empty to allow all categories.</small></label>
          <label>Applicable products<select multiple value={draft.applicableProducts} onChange={(event) => setReferences('applicableProducts', event)}>{products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}</select><small>Leave empty to allow all products.</small></label>
        </div>
        <div className="admin-form-actions"><button className="admin-button-primary" type="submit" disabled={saving}><Save size={15} /> {saving ? 'Saving…' : editingId ? 'Save coupon' : 'Create coupon'}</button>{editingId && <button className="admin-button-secondary" type="button" onClick={resetForm}><X size={15} /> Cancel</button>}</div>
      </form>
      <section className="admin-panel">
        <div className="admin-panel-heading"><h2>Existing coupons</h2><button className="admin-button-secondary" type="button" onClick={() => void load()}><RefreshCw size={15} /> Refresh</button></div>
        <input className="admin-category-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search coupon codes" aria-label="Search coupon codes" />
        {loading ? <div className="admin-empty-state">Loading coupons…</div> : coupons.length ? (
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Code</th><th>Offer</th><th>Validity</th><th>Usage</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {coupons.map((coupon) => <tr key={coupon._id}>
              <td><strong>{coupon.code}</strong><small>{coupon.description}</small></td>
              <td>{coupon.discountType === 'percentage' ? `${coupon.discountValue}%${coupon.maxDiscount ? ` up to ${formatPrice(coupon.maxDiscount)}` : ''}` : formatPrice(coupon.discountValue)}<small>Minimum {formatPrice(coupon.minimumOrderValue || 0)}</small></td>
              <td>{new Date(coupon.startsAt).toLocaleDateString()} – {new Date(coupon.expiresAt).toLocaleDateString()}</td>
              <td>{coupon.usageCount || 0}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ' / unlimited'}<small>{coupon.perUserLimit} per customer</small></td>
              <td><span className={`admin-status ${coupon.isActive ? 'status-active' : 'status-draft'}`}>{coupon.isActive ? 'Active' : 'Inactive'}</span></td>
              <td><div className="admin-row-actions"><button type="button" onClick={() => edit(coupon)} aria-label={`Edit ${coupon.code}`}><Pencil size={14} /></button><button type="button" onClick={() => void toggleStatus(coupon)}>{coupon.isActive ? 'Pause' : 'Activate'}</button><button type="button" onClick={() => void remove(coupon)} aria-label={`Delete ${coupon.code}`}><Trash2 size={14} /></button></div></td>
            </tr>)}
          </tbody></table></div>
        ) : <div className="admin-empty-state">No coupons match this search.</div>}
      </section>
    </div>
  );
}
