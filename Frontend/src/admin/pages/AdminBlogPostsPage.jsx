import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, ImagePlus, Pencil, Plus, Search, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../adminApi';
import { formatDate } from '../../utils/format';
import './AdminBlogPostsPage.css';

const EMPTY_FIELDS = {
  title: '', slug: '', excerpt: '', category: '', contentType: 'story', contentBlocks: [],
  heroImage: '', heroImageAlt: '', mediaUrl: '', mediaType: 'image', author: 'Nishree Attire',
  tags: [], status: 'draft', isFeatured: false, publishAt: '', expiresAt: '', ctaLabel: '',
  ctaUrl: '', eventDate: '', eventLocation: '', eventRegistrationUrl: '', campaignLabel: '',
};
const CONTENT_TYPES = ['story', 'festival', 'product', 'event', 'promotion', 'guide', 'announcement', 'update', 'campaign'];
const BLOCK_TYPES = ['paragraph', 'heading', 'quote', 'image', 'video', 'link'];
const localDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const isoDateTime = (value) => value ? new Date(value).toISOString() : '';
const errorMessage = (error, fallback) => {
  const message = error.response?.data?.message;
  if (!message) return fallback;
  try {
    const issues = JSON.parse(message);
    if (Array.isArray(issues)) return issues.map((issue) => issue.message).filter(Boolean).join(' ');
  } catch {
    return message;
  }
  return message;
};

export default function AdminBlogPostsPage() {
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const editorRef = useRef(null);
  const savingRef = useRef(false);
  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingId('');
    setFields(EMPTY_FIELDS);
    setCoverFile(null);
    setCoverPreview('');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminApi.blogPosts({ page, limit: 20, search: query || undefined, status: statusFilter || undefined });
      setPosts(result.posts || []);
      setPagination(result.pagination || { page: 1, totalPages: 1, total: 0 });
      setError('');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Journal posts could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [page, query, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => () => { if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview); }, [coverPreview]);
  useEffect(() => {
    if (!editorOpen) return undefined;
    const dialog = editorRef.current;
    const focusable = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]';
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const focusFirst = () => dialog?.querySelector(focusable)?.focus();
    document.body.style.overflow = 'hidden';
    focusFirst();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !savingRef.current) {
        closeEditor();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const items = [...dialog.querySelectorAll(focusable)].filter((item) => item.offsetParent !== null);
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0].focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [closeEditor, editorOpen]);
  const categories = useMemo(() => [...new Set(posts.map((post) => post.category))].sort((a, b) => a.localeCompare(b)), [posts]);

  const statusCounts = useMemo(() => posts.reduce((counts, post) => {
    counts[post.status] = (counts[post.status] || 0) + 1;
    return counts;
  }, {}), [posts]);

  const openNew = () => {
    setEditingId('');
    setFields(EMPTY_FIELDS);
    setCoverFile(null);
    setCoverPreview('');
    setEditorOpen(true);
  };
  const editPost = async (id) => {
    setBusyId(id);
    try {
      const post = await adminApi.blogPost(id);
      setFields({
        ...EMPTY_FIELDS,
        ...post,
        publishAt: localDateTime(post.publishAt),
        expiresAt: localDateTime(post.expiresAt),
        eventDate: localDateTime(post.eventDate),
        tags: Array.isArray(post.tags) ? post.tags : [],
        contentBlocks: Array.isArray(post.contentBlocks) ? post.contentBlocks : [],
      });
      setCoverFile(null);
      setCoverPreview('');
      setEditingId(id);
      setEditorOpen(true);
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'This post could not be opened.'));
    } finally {
      setBusyId('');
    }
  };
  const updateField = (key, value) => setFields((current) => ({ ...current, [key]: value }));
  const chooseCover = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error('Choose a JPG, PNG or WEBP cover image up to 5 MB.');
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };
  const uploadContentImage = async (index, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error('Choose a JPG, PNG or WEBP image up to 5 MB.');
      return;
    }
    setMediaUploading(true);
    try {
      const image = await adminApi.uploadBlogMedia(file);
      setFields((current) => ({
        ...current,
        contentBlocks: current.contentBlocks.map((block, blockIndex) => blockIndex === index && block.type === 'image' ? { ...block, url: image.url } : block),
      }));
      toast.success('Article image uploaded.');
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Article image could not be uploaded.'));
    } finally {
      setMediaUploading(false);
    }
  };
  const updateBlock = (index, updates) => updateField('contentBlocks', fields.contentBlocks.map((block, blockIndex) => blockIndex === index ? { ...block, ...updates } : block));
  const addBlock = (type) => updateField('contentBlocks', [...fields.contentBlocks, { type, text: '', url: '', altText: '' }]);
  const removeBlock = (index) => updateField('contentBlocks', fields.contentBlocks.filter((_, blockIndex) => blockIndex !== index));

  const save = async (event) => {
    event.preventDefault();
    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        ...fields,
        publishAt: isoDateTime(fields.publishAt),
        expiresAt: isoDateTime(fields.expiresAt),
        eventDate: isoDateTime(fields.eventDate),
        tags: typeof fields.tags === 'string' ? fields.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : fields.tags,
      };
      if (editingId) {
        const result = await adminApi.updateBlogPost(editingId, payload, coverFile);
        if (result.cleanupWarning) toast.warning(result.cleanupWarning);
        toast.success('Journal post saved.');
      } else {
        await adminApi.createBlogPost(payload, coverFile);
        toast.success('Journal post created.');
      }
      closeEditor();
      await load();
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Journal post could not be saved.'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const deletePost = async (post) => {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    setBusyId(post._id);
    try {
      const result = await adminApi.deleteBlogPost(post._id);
      if (result.cleanupWarning) toast.warning(result.cleanupWarning);
      else toast.success('Journal post deleted.');
      await load();
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Journal post could not be deleted.'));
    } finally {
      setBusyId('');
    }
  };
  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  };

  return (
    <div className="admin-page admin-blog-page">
      <header className="admin-page-heading admin-blog-heading">
        <div><span className="eyebrow">Storefront content</span><h1>Journal studio</h1><p>Create and schedule flexible stories, launches, events, guides and campaigns. Drafts remain private until they are published.</p></div>
        <button className="admin-button-primary" type="button" onClick={openNew}><Plus size={16} /> New story</button>
      </header>

      <section className="admin-blog-summary" aria-label="Journal post counts">
        <div><strong>{pagination.total}</strong><span>All posts</span></div>
        <div><strong>{statusCounts.published || 0}</strong><span>Published on this page</span></div>
        <div><strong>{statusCounts.draft || 0}</strong><span>Drafts on this page</span></div>
        <div><strong>{statusCounts.scheduled || 0}</strong><span>Scheduled on this page</span></div>
      </section>

      <section className="admin-panel admin-blog-library">
        <div className="admin-blog-toolbar">
          <div><h2>All stories</h2><span>Manage the journal’s content and publishing schedule.</span></div>
          <form className="admin-blog-search" role="search" onSubmit={submitSearch}><Search size={16} aria-hidden="true" /><label className="sr-only" htmlFor="admin-blog-search">Search journal posts</label><input id="admin-blog-search" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Search title, category or slug" /><button className="admin-button-secondary" type="submit">Search</button></form>
          <label className="admin-blog-status-filter"><span>Status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
        </div>
        {error && <div className="admin-inline-error" role="alert">{error} <button type="button" onClick={() => void load()}>Try again</button></div>}
        {loading ? <div className="admin-empty-state" role="status">Loading journal posts…</div> : posts.length ? (
          <div className="admin-blog-list">
            {posts.map((post) => <article className="admin-blog-row" key={post._id}>
              <img src={post.heroImage} alt="" loading="lazy" />
              <div className="admin-blog-row-copy"><div><span className={`admin-blog-status-chip is-${post.status}`}>{post.status}</span><span className="admin-blog-category">{post.category} · {post.contentType}</span>{post.isFeatured && <span className="admin-blog-featured">Featured</span>}</div><h3>{post.title}</h3><p>{post.excerpt}</p><small>{post.status === 'scheduled' ? 'Scheduled for' : post.status === 'published' ? 'Published' : 'Updated'} · {formatDate(post.publishAt || post.updatedAt)}{post.expiresAt ? ` · Expires ${formatDate(post.expiresAt)}` : ''}</small></div>
              <div className="admin-blog-row-actions">{post.status === 'published' && <a className="admin-button-secondary" href={`/blogs/${post.slug}`} target="_blank" rel="noreferrer"><Eye size={14} /> View</a>}<button type="button" className="admin-button-secondary" disabled={busyId === post._id} onClick={() => void editPost(post._id)}><Pencil size={14} /> Edit</button><button type="button" className="admin-button-danger" disabled={busyId === post._id} onClick={() => void deletePost(post)} aria-label={`Delete ${post.title}`}><Trash2 size={14} /></button></div>
            </article>)}
          </div>
        ) : !error ? <div className="admin-empty-state">No posts match this view. Create a story to begin your journal.</div> : null}
        {pagination.totalPages > 1 && <nav className="admin-blog-pagination" aria-label="Journal admin pages"><button className="admin-button-secondary" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}><ArrowLeft size={14} /> Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button className="admin-button-secondary" type="button" onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={page >= pagination.totalPages}>Next <ArrowRight size={14} /></button></nav>}
      </section>

      {editorOpen && <div className="admin-blog-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) closeEditor(); }}>
        <section ref={editorRef} className="admin-blog-editor" role="dialog" aria-modal="true" aria-labelledby="admin-blog-editor-title">
          <header><div><span className="eyebrow">{editingId ? 'Edit journal post' : 'New journal post'}</span><h2 id="admin-blog-editor-title">{editingId ? fields.title || 'Edit story' : 'Shape a new story'}</h2></div><button type="button" className="admin-blog-close" aria-label="Close editor" onClick={closeEditor} disabled={saving}><X size={20} /></button></header>
          <form onSubmit={save}>
            <div className="admin-blog-editor-grid">
              <div className="admin-blog-editor-main">
                <fieldset><legend>Story details</legend>
                  <label>Title<input required maxLength={180} value={fields.title} onChange={(event) => updateField('title', event.target.value)} placeholder="A thoughtful title" /></label>
                  <label>URL slug <input maxLength={200} value={fields.slug} onChange={(event) => updateField('slug', event.target.value)} placeholder="Leave blank to create from title" /></label>
                  <label>Short description<textarea required maxLength={500} rows={3} value={fields.excerpt} onChange={(event) => updateField('excerpt', event.target.value)} placeholder="A short introduction shown on story cards." /></label>
                  <div className="admin-blog-two-fields"><label>Category<input required list="admin-blog-categories" maxLength={80} value={fields.category} onChange={(event) => updateField('category', event.target.value)} placeholder="Create or choose a category" /><datalist id="admin-blog-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist></label><label>Content type<select value={fields.contentType} onChange={(event) => updateField('contentType', event.target.value)}>{CONTENT_TYPES.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select></label></div>
                  <div className="admin-blog-two-fields"><label>Author<input maxLength={100} value={fields.author} onChange={(event) => updateField('author', event.target.value)} /></label><label>Tags <input value={Array.isArray(fields.tags) ? fields.tags.join(', ') : fields.tags} onChange={(event) => updateField('tags', event.target.value)} placeholder="Use commas between tags" /></label></div>
                </fieldset>

                <fieldset><legend>Article content</legend><p className="admin-blog-help">Add text, headings, quotes, and media in the order readers should see them. Content is rendered safely as text.</p>
                  {fields.contentBlocks.map((block, index) => <div className="admin-blog-block" key={`${index}-${block.type}`}><div className="admin-blog-block-heading"><strong>{block.type[0].toUpperCase() + block.type.slice(1)} block</strong><button type="button" className="admin-blog-remove-block" disabled={mediaUploading} onClick={() => removeBlock(index)} aria-label={`Remove ${block.type} block`}><X size={15} /></button></div>
                    {['paragraph', 'heading', 'quote'].includes(block.type) && <label>{block.type === 'paragraph' ? 'Text' : block.type === 'heading' ? 'Section heading' : 'Quote'}<textarea rows={block.type === 'paragraph' ? 5 : 2} maxLength={12000} value={block.text} onChange={(event) => updateBlock(index, { text: event.target.value })} /></label>}
                    {['image', 'video', 'link'].includes(block.type) && <div className="admin-blog-two-fields"><label>{block.type === 'link' ? 'Destination URL' : `${block.type} URL`}<input required maxLength={2048} value={block.url} onChange={(event) => updateBlock(index, { url: event.target.value })} placeholder="https://… or /path" />{block.type === 'image' && <span className="admin-blog-inline-upload"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={mediaUploading} onChange={(event) => void uploadContentImage(index, event)} /><ImagePlus size={14} />{mediaUploading ? 'Uploading image…' : 'Upload image (JPG, PNG, WEBP · 5 MB)'}</span>}</label><label>{block.type === 'link' ? 'Link label' : 'Accessible description'}<input maxLength={200} value={block.type === 'link' ? block.text : block.altText} onChange={(event) => updateBlock(index, block.type === 'link' ? { text: event.target.value } : { altText: event.target.value })} /></label></div>}
                  </div>)}
                  <div className="admin-blog-add-blocks">{BLOCK_TYPES.map((type) => <button key={type} className="admin-button-secondary" type="button" disabled={mediaUploading} onClick={() => addBlock(type)}><Plus size={13} /> {type}</button>)}</div>
                </fieldset>
                <fieldset><legend>Story call to action</legend><div className="admin-blog-two-fields"><label>Button label<input maxLength={80} value={fields.ctaLabel} onChange={(event) => updateField('ctaLabel', event.target.value)} placeholder="Explore the collection" /></label><label>Button URL<input maxLength={2048} value={fields.ctaUrl} onChange={(event) => updateField('ctaUrl', event.target.value)} placeholder="/shop or https://…" /></label></div></fieldset>
              </div>

              <aside className="admin-blog-editor-side">
                <fieldset><legend>Cover image & media</legend><label>Featured image URL<input maxLength={2048} value={fields.heroImage} onChange={(event) => { updateField('heroImage', event.target.value); setCoverFile(null); setCoverPreview(''); }} placeholder="https://… or /blog-media/…" /></label>
                  <label className="admin-blog-upload-cover"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseCover} /><ImagePlus size={17} /><span><strong>Upload a cover</strong><small>JPG, PNG or WEBP, up to 5 MB</small></span></label>
                  {(coverPreview || fields.heroImage) && <img className="admin-blog-cover-preview" src={coverPreview || fields.heroImage} alt="Cover preview" />}
                  <label>Image description<input required maxLength={200} value={fields.heroImageAlt} onChange={(event) => updateField('heroImageAlt', event.target.value)} placeholder="Describe the image for accessibility" /></label>
                  <div className="admin-blog-two-fields"><label>Featured media type<select value={fields.mediaType} onChange={(event) => updateField('mediaType', event.target.value)}><option value="image">Image</option><option value="video">Video</option></select></label><label>Featured video URL<input maxLength={2048} value={fields.mediaUrl} onChange={(event) => updateField('mediaUrl', event.target.value)} placeholder="Optional" /></label></div>
                </fieldset>
                <fieldset><legend>Publishing</legend><label>Status<select value={fields.status} onChange={(event) => updateField('status', event.target.value)}><option value="draft">Draft — private</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                  <label>Publish date & time<input type="datetime-local" value={fields.publishAt} onChange={(event) => updateField('publishAt', event.target.value)} /><small>Leave blank to publish immediately when status is Published.</small></label>
                  <label>Expiry date & time<input type="datetime-local" value={fields.expiresAt} onChange={(event) => updateField('expiresAt', event.target.value)} /><small>Optional. The post is hidden after this time.</small></label>
                  <label className="admin-blog-feature-toggle"><input type="checkbox" checked={Boolean(fields.isFeatured)} onChange={(event) => updateField('isFeatured', event.target.checked)} /><span><strong>Feature this story</strong><small>Show it in the journal’s featured areas.</small></span></label>
                </fieldset>
                <fieldset><legend>Event & campaign details</legend><label>Campaign or collection label<input maxLength={120} value={fields.campaignLabel} onChange={(event) => updateField('campaignLabel', event.target.value)} placeholder="Optional campaign name" /></label><label>Event date & time<input type="datetime-local" value={fields.eventDate} onChange={(event) => updateField('eventDate', event.target.value)} /></label><label>Event location<input maxLength={200} value={fields.eventLocation} onChange={(event) => updateField('eventLocation', event.target.value)} placeholder="Optional location" /></label><label>Registration URL<input maxLength={2048} value={fields.eventRegistrationUrl} onChange={(event) => updateField('eventRegistrationUrl', event.target.value)} placeholder="Optional" /></label></fieldset>
              </aside>
            </div>
            <footer className="admin-blog-editor-footer"><button type="button" className="admin-button-secondary" onClick={closeEditor} disabled={saving || mediaUploading}>Cancel</button><button type="submit" className="admin-button-primary" disabled={saving || mediaUploading}><Send size={15} />{mediaUploading ? 'Uploading article image…' : saving ? 'Saving story…' : editingId ? 'Save changes' : fields.status === 'published' ? 'Publish story' : 'Save story'}</button></footer>
          </form>
        </section>
      </div>}
    </div>
  );
}
