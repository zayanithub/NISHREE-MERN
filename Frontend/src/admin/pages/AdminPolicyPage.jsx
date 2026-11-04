import { useEffect, useState } from 'react';
import { Eye, EyeOff, FileText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../adminApi';

const sections = [
  { key: 'shipping', title: 'Shipping policy' },
  { key: 'returns', title: 'Return policy' },
  { key: 'refunds', title: 'Refund policy' },
  { key: 'damaged', title: 'Damaged products' },
  { key: 'cod', title: 'Cash on delivery' },
  { key: 'privacy', title: 'Privacy policy' },
  { key: 'terms', title: 'Terms and conditions' },
];

const emptyPolicies = () => Object.fromEntries(
  sections.map(({ key }) => [key, { content: '', isPublished: false }]),
);

export default function AdminPolicyPage() {
  const [policies, setPolicies] = useState(emptyPolicies);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState(sections[0].key);

  useEffect(() => {
    let active = true;
    adminApi.settings()
      .then((settings) => {
        if (active) setPolicies({ ...emptyPolicies(), ...settings.policies });
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Policy content could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const updatePolicy = (key, updates) => {
    setPolicies((current) => ({ ...current, [key]: { ...current[key], ...updates } }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const settings = await adminApi.updateSettings({ policies });
      setPolicies({ ...emptyPolicies(), ...settings.policies });
      toast.success('Store policies saved.');
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Policy content could not be saved.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const selectedSection = sections.find(({ key }) => key === selectedKey) || sections[0];
  const selectedPolicy = policies[selectedSection.key] || { content: '', isPublished: false };

  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">Customer information</span>
          <h1>Store policies</h1>
          <p>Shape how customers understand delivery, payment and aftercare. Save drafts privately or publish each policy to the storefront.</p>
        </div>
      </div>
      {error && <p className="admin-inline-error" role="alert">{error}</p>}
      {loading ? <div className="admin-empty-state">Loading policies…</div> : (
        <form className="admin-policy-workspace" onSubmit={save}>
          <nav className="admin-panel admin-policy-index" aria-label="Choose a store policy">
            <div className="admin-policy-index-heading"><FileText size={17} /><div><strong>Policy library</strong><span>{sections.length} customer topics</span></div></div>
            {sections.map(({ key, title }) => (
              <button key={key} type="button" className={`admin-policy-index-item${selectedKey === key ? ' is-active' : ''}`} aria-current={selectedKey === key ? 'page' : undefined} onClick={() => setSelectedKey(key)}>
                <span>{title}</span>
                <small className={policies[key]?.isPublished ? 'is-published' : ''}>{policies[key]?.isPublished ? 'Published' : 'Draft'}</small>
              </button>
            ))}
            <p className="admin-policy-index-note">Drafts are private. Publishing makes the current text visible to customers.</p>
          </nav>
          <section className="admin-panel admin-policy-editor">
            <div className="admin-policy-editor-heading"><div><span className="eyebrow">Editing policy</span><h2>{selectedSection.title}</h2><p>Write clear, accurate information customers can rely on.</p></div><span className={`admin-policy-status${selectedPolicy.isPublished ? ' is-published' : ''}`}>{selectedPolicy.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}{selectedPolicy.isPublished ? 'Live on storefront' : 'Private draft'}</span></div>
            <label className="admin-policy-content"><span>Policy text</span><textarea value={selectedPolicy.content} onChange={(event) => updatePolicy(selectedSection.key, { content: event.target.value })} maxLength={12000} rows={14} placeholder={`Write the ${selectedSection.title.toLowerCase()} for customers.`} /><small>{selectedPolicy.content.length.toLocaleString()} / 12,000 characters</small></label>
            <div className="admin-policy-editor-footer"><label className="admin-policy-publish"><input type="checkbox" checked={Boolean(selectedPolicy.isPublished)} onChange={(event) => updatePolicy(selectedSection.key, { isPublished: event.target.checked })} /><span><strong>Publish this policy</strong><small>Visible on the customer policy page after saving.</small></span></label><button className="admin-button-primary" type="submit" disabled={saving}><Save size={15} /> {saving ? 'Saving policies…' : 'Save policy changes'}</button></div>
          </section>
        </form>
      )}
    </div>
  );
}
