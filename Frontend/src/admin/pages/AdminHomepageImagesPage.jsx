import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Eye, ImagePlus, Images, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../adminApi';

const SECTIONS = [
  { value: 'hero', label: 'Hero carousel' },
  { value: 'category', label: 'Collection fallbacks' },
  { value: 'editorial', label: 'Editorial feature' },
  { value: 'atelier', label: 'Atelier feature' },
  { value: 'social', label: 'Social gallery' },
];
const SECTION_ORDER = Object.fromEntries(SECTIONS.map(({ value }, index) => [value, index]));
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const readableError = (error, fallback) => error.response?.data?.message || fallback;
const sortImages = (items) => [...items].sort((a, b) => SECTION_ORDER[a.section] - SECTION_ORDER[b.section] || a.sortOrder - b.sortOrder);

export default function AdminHomepageImagesPage() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadSection, setUploadSection] = useState('hero');
  const [uploadFiles, setUploadFiles] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editFields, setEditFields] = useState({ title: '', description: '', altText: '' });
  const [replacement, setReplacement] = useState(null);
  const [replacementPreview, setReplacementPreview] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draggedId, setDraggedId] = useState('');
  const uploadInputRef = useRef(null);
  const replacementInputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const result = await adminApi.homepageImages();
      setImages(sortImages(result || []));
      setError('');
    } catch (requestError) {
      setError(readableError(requestError, 'Homepage images could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => () => {
    uploadFiles.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
  }, [uploadFiles]);

  useEffect(() => () => {
    if (replacementPreview) URL.revokeObjectURL(replacementPreview);
  }, [replacementPreview]);

  const visibleImages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return images.filter((image) =>
      (section === 'all' || image.section === section) &&
      (!needle || `${image.title} ${image.description} ${image.altText} ${image.section}`.toLowerCase().includes(needle))
    );
  }, [images, query, section]);

  const sectionCounts = useMemo(() => images.reduce((counts, image) => {
    counts[image.section] = (counts[image.section] || 0) + 1;
    return counts;
  }, {}), [images]);

  const releaseUploadFiles = () => {
    uploadFiles.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
    setUploadFiles([]);
  };

  const chooseUploadFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected.length) return;
    if (selected.length > 8) {
      toast.error('Choose up to 8 images per upload.');
      return;
    }
    const invalid = selected.find((file) => !allowedTypes.includes(file.type) || file.size > MAX_FILE_SIZE);
    if (invalid) {
      toast.error(`${invalid.name}: choose a JPG, PNG or WEBP image up to 5 MB.`);
      return;
    }
    releaseUploadFiles();
    setUploadFiles(selected.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
    })));
    setUploadOpen(true);
  };

  const closeUpload = () => {
    if (busy) return;
    setUploadOpen(false);
    releaseUploadFiles();
  };

  const saveUpload = async (event) => {
    event.preventDefault();
    if (!uploadFiles.length || busy) return;
    setBusy(true);
    const body = new FormData();
    body.append('section', uploadSection);
    uploadFiles.forEach(({ file }) => body.append('images', file));
    try {
      const added = await adminApi.uploadHomepageImages(body);
      toast.success(`${added.length} image${added.length === 1 ? '' : 's'} published to the homepage.`);
      setUploadOpen(false);
      releaseUploadFiles();
      await load();
    } catch (requestError) {
      toast.error(readableError(requestError, 'The images could not be uploaded.'));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (image) => {
    setEditing(image);
    setEditFields({
      title: image.title || '',
      description: image.description || '',
      altText: image.altText || '',
    });
    setReplacement(null);
    setReplacementPreview('');
  };

  const closeEdit = () => {
    if (busy) return;
    setEditing(null);
    setReplacement(null);
    setReplacementPreview('');
  };

  const chooseReplacement = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    if (!allowedTypes.includes(file.type) || file.size > MAX_FILE_SIZE) {
      toast.error('Choose a JPG, PNG or WEBP image up to 5 MB.');
      return;
    }
    if (replacementPreview) URL.revokeObjectURL(replacementPreview);
    setReplacement(file);
    setReplacementPreview(URL.createObjectURL(file));
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editing || busy) return;
    setBusy(true);
    const body = new FormData();
    body.append('title', editFields.title);
    body.append('description', editFields.description);
    body.append('altText', editFields.altText);
    if (replacement) body.append('image', replacement);
    try {
      const result = await adminApi.updateHomepageImage(editing._id, body);
      if (result.cleanupWarning) toast.warning(result.cleanupWarning);
      else toast.success('Image details saved and published.');
      setEditing(null);
      setReplacement(null);
      setReplacementPreview('');
      await load();
    } catch (requestError) {
      toast.error(readableError(requestError, 'The image could not be updated.'));
    } finally {
      setBusy(false);
    }
  };

  const removeImage = async (image) => {
    if (!window.confirm(`Remove "${image.title}" from the homepage? This cannot be undone.`)) return;
    try {
      const result = await adminApi.deleteHomepageImage(image._id);
      if (result.cleanupWarning) toast.warning(result.cleanupWarning);
      else toast.success('Image removed from the homepage.');
      await load();
    } catch (requestError) {
      toast.error(readableError(requestError, 'The image could not be removed.'));
    }
  };

  const persistOrder = async (image, targetId) => {
    if (!image || !targetId || targetId === image._id || busy) return;
    const inSection = sortImages(images.filter((item) => item.section === image.section));
    const from = inSection.findIndex((item) => item._id === image._id);
    const to = inSection.findIndex((item) => item._id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = inSection.splice(from, 1);
    inSection.splice(to, 0, moved);
    setBusy(true);
    try {
      const result = await adminApi.reorderHomepageImages({
        section: image.section,
        imageIds: inSection.map((item) => item._id),
      });
      setImages(sortImages(result || []));
      toast.success('Homepage image order saved.');
    } catch (requestError) {
      toast.error(readableError(requestError, 'The image order could not be saved.'));
      await load();
    } finally {
      setBusy(false);
      setDraggedId('');
    }
  };

  const moveBy = (image, offset) => {
    const inSection = sortImages(images.filter((item) => item.section === image.section));
    const index = inSection.findIndex((item) => item._id === image._id);
    const target = inSection[index + offset];
    if (target) void persistOrder(image, target._id);
  };

  const canReorder = section !== 'all' && !query.trim();

  return <div className="admin-page admin-homepage-images-page">
    <div className="admin-page-heading">
      <div>
        <span className="eyebrow">Storefront imagery</span>
        <h1>Homepage images</h1>
        <p>Manage the hero carousel and collection, editorial, atelier and social gallery images shown on the homepage. Saved changes publish immediately.</p>
      </div>
      <button className="admin-button-primary" type="button" onClick={() => uploadInputRef.current?.click()}>
        <Plus size={17} /> Add images
      </button>
      <input ref={uploadInputRef} className="admin-image-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseUploadFiles} />
    </div>

    <div className="admin-image-summary">
      <span><Images size={17} /> <strong>{images.length}</strong> published images</span>
      <span><Check size={16} /> Homepage updates automatically when you save</span>
      <small>JPG, PNG or WEBP · up to 5 MB each · 8 files per upload</small>
    </div>

    <section className="admin-toolbar admin-image-toolbar" aria-label="Filter homepage images">
      <label className="admin-search"><Search size={17} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, description or alt text" aria-label="Search homepage images" /></label>
      <label>Section<select value={section} onChange={(event) => setSection(event.target.value)}><option value="all">All sections ({images.length})</option>{SECTIONS.map((item) => <option key={item.value} value={item.value}>{item.label} ({sectionCounts[item.value] || 0})</option>)}</select></label>
      {canReorder && <span className="admin-image-reorder-hint">Drag cards or use the arrow buttons to reorder.</span>}
    </section>

    {error && <div className="admin-image-error" role="alert"><span>{error}</span><button className="admin-button-secondary" type="button" onClick={() => void load()}>Try again</button></div>}
    {loading ? <div className="admin-empty-state">Loading homepage images…</div> : visibleImages.length ? (
      <div className="admin-homepage-image-grid">
        {visibleImages.map((image) => {
          const sectionIndex = sortImages(images.filter((item) => item.section === image.section)).findIndex((item) => item._id === image._id);
          const sectionTotal = sectionCounts[image.section] || 0;
          return <article
            className={`admin-homepage-image-card${draggedId === image._id ? ' is-dragged' : ''}`}
            key={image._id}
            draggable={canReorder && !busy}
            onDragStart={(event) => { setDraggedId(image._id); event.dataTransfer.effectAllowed = 'move'; }}
            onDragEnd={() => setDraggedId('')}
            onDragOver={(event) => { if (canReorder) event.preventDefault(); }}
            onDrop={(event) => { event.preventDefault(); if (canReorder) void persistOrder(images.find((item) => item._id === draggedId), image._id); }}
          >
            <button className="admin-homepage-image-preview" type="button" onClick={() => setPreviewImage(image)} aria-label={`Preview ${image.title}`}>
              <img src={image.url} alt={image.altText} loading="lazy" />
              <span><Eye size={16} /> Preview</span>
            </button>
            <div className="admin-homepage-image-details">
              <div className="admin-homepage-image-title"><strong title={image.title}>{image.title}</strong><span>Live</span></div>
              <small>{SECTIONS.find((item) => item.value === image.section)?.label}</small>
              {image.description && <p>{image.description}</p>}
              <small className="admin-homepage-image-alt">Alt: {image.altText}</small>
            </div>
            <footer className="admin-homepage-image-actions">
              {canReorder && <div className="admin-image-order-controls" aria-label={`Reorder ${image.title}`}>
                <button className="admin-image-icon-button" type="button" disabled={busy || sectionIndex === 0} onClick={() => moveBy(image, -1)} aria-label={`Move ${image.title} earlier`}><ArrowUp size={16} /></button>
                <button className="admin-image-icon-button" type="button" disabled={busy || sectionIndex === sectionTotal - 1} onClick={() => moveBy(image, 1)} aria-label={`Move ${image.title} later`}><ArrowDown size={16} /></button>
              </div>}
              <button className="admin-image-action" type="button" onClick={() => openEdit(image)}><Pencil size={14} /> Edit</button>
              <button className="admin-image-action is-danger" type="button" onClick={() => void removeImage(image)} aria-label={`Delete ${image.title}`}><Trash2 size={14} /></button>
            </footer>
          </article>;
        })}
      </div>
    ) : !error && <div className="admin-empty-state">{images.length ? 'No homepage images match this search.' : 'No homepage images are available yet. Add an image to get started.'}</div>}

    {uploadOpen && <div className="admin-modal-backdrop admin-image-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeUpload(); }}>
      <form className="admin-modal admin-image-modal" role="dialog" aria-modal="true" aria-labelledby="homepage-upload-title" onSubmit={saveUpload}>
        <header><div><span className="eyebrow">Preview before publishing</span><h2 id="homepage-upload-title">Add homepage images</h2></div><button className="admin-image-icon-button" type="button" disabled={busy} onClick={closeUpload} aria-label="Close upload preview"><X size={18} /></button></header>
        <p className="admin-image-modal-copy">Review the selected images and choose where they appear. Uploading saves them to permanent image storage and publishes them immediately.</p>
        <label className="admin-image-modal-section">Homepage section<select value={uploadSection} onChange={(event) => setUploadSection(event.target.value)}>{SECTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <div className="admin-upload-preview-grid">{uploadFiles.map(({ file, previewUrl, title }) => <article key={`${file.name}-${file.lastModified}`}><img src={previewUrl} alt={`Preview of ${title}`} /><strong>{title}</strong><small>{(file.size / (1024 * 1024)).toFixed(2)} MB</small></article>)}</div>
        <footer className="admin-image-modal-actions"><button className="admin-button-secondary" type="button" disabled={busy} onClick={closeUpload}>Cancel</button><button className="admin-button-primary" type="submit" disabled={busy || uploadFiles.length === 0}><Upload size={15} /> {busy ? 'Uploading…' : `Upload ${uploadFiles.length} image${uploadFiles.length === 1 ? '' : 's'}`}</button></footer>
      </form>
    </div>}

    {editing && <div className="admin-modal-backdrop admin-image-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEdit(); }}>
      <form className="admin-modal admin-image-modal" role="dialog" aria-modal="true" aria-labelledby="homepage-edit-title" onSubmit={saveEdit}>
        <header><div><span className="eyebrow">{SECTIONS.find((item) => item.value === editing.section)?.label}</span><h2 id="homepage-edit-title">Edit homepage image</h2></div><button className="admin-image-icon-button" type="button" disabled={busy} onClick={closeEdit} aria-label="Close image editor"><X size={18} /></button></header>
        <div className="admin-image-edit-preview"><img src={replacementPreview || editing.url} alt={editFields.altText || editing.altText} /><button className="admin-button-secondary" type="button" onClick={() => replacementInputRef.current?.click()}><ImagePlus size={15} /> Replace image</button><input ref={replacementInputRef} className="admin-image-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseReplacement} /></div>
        {replacement && <p className="admin-image-replacement-note">Previewing replacement: {replacement.name}</p>}
        <div className="admin-image-edit-fields">
          <label>Image title<input value={editFields.title} onChange={(event) => setEditFields((current) => ({ ...current, title: event.target.value }))} maxLength={120} required /></label>
          <label>Description<textarea value={editFields.description} onChange={(event) => setEditFields((current) => ({ ...current, description: event.target.value }))} maxLength={500} rows={3} /></label>
          <label>Alt text<input value={editFields.altText} onChange={(event) => setEditFields((current) => ({ ...current, altText: event.target.value }))} maxLength={200} required /></label>
        </div>
        <footer className="admin-image-modal-actions"><button className="admin-button-secondary" type="button" disabled={busy} onClick={closeEdit}>Cancel</button><button className="admin-button-primary" type="submit" disabled={busy}><Check size={15} /> {busy ? 'Saving…' : 'Save and publish'}</button></footer>
      </form>
    </div>}

    {previewImage && <div className="admin-modal-backdrop admin-image-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewImage(null); }}>
      <section className="admin-modal admin-image-preview-modal" role="dialog" aria-modal="true" aria-label={`Preview ${previewImage.title}`}>
        <header><div><span className="eyebrow">Homepage preview</span><h2>{previewImage.title}</h2></div><button className="admin-image-icon-button" type="button" onClick={() => setPreviewImage(null)} aria-label="Close image preview"><X size={18} /></button></header>
        <img src={previewImage.url} alt={previewImage.altText} />
        {previewImage.description && <p>{previewImage.description}</p>}
        <small>Alt text: {previewImage.altText}</small>
      </section>
    </div>}
  </div>;
}
