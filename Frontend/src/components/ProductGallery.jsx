import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import './ProductGallery.css';

export default function ProductGallery({ images = [], activeImage, onSelectImage, productName, imageAltText, imageCredit, imageSourceUrl }) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [loadedImageUrl, setLoadedImageUrl] = useState('');
  const [failedImages, setFailedImages] = useState(() => new Set());
  const dialogRef = useRef(null);
  const stageRef = useRef(null);
  const touchStartRef = useRef(null);
  const ignoreNextClickRef = useRef(false);

  const currentImage = useMemo(
    () => images.find((image) => image.url === activeImage) || images[0],
    [activeImage, images],
  );
  const currentUrl = currentImage?.url || '';
  const imageLoaded = loadedImageUrl === currentUrl;
  const currentAlt = currentImage?.altText || imageAltText || productName || '';
  const currentIndex = images.findIndex((image) => image.url === currentUrl);
  const hasMultiple = images.length > 1;
  const unavailable = !currentUrl || failedImages.has(currentUrl);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (zoomOpen && !dialog.open) {
      dialog.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
        if (dialog.open) dialog.close();
      };
    }
    if (!zoomOpen && dialog.open) dialog.close();
    return undefined;
  }, [zoomOpen]);

  useEffect(() => {
    if (!zoomOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setZoomOpen(false);
        return;
      }
      if (!hasMultiple) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onSelectImage(images[(currentIndex - 1 + images.length) % images.length].url);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onSelectImage(images[(currentIndex + 1) % images.length].url);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, hasMultiple, images, onSelectImage, zoomOpen]);

  const moveImage = (direction) => {
    if (!hasMultiple) return;
    const nextIndex = (currentIndex + direction + images.length) % images.length;
    onSelectImage(images[nextIndex].url);
  };

  const handleTouchStart = (event) => {
    touchStartRef.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    const start = touchStartRef.current;
    const end = event.changedTouches[0]?.clientX;
    touchStartRef.current = null;
    if (start == null || end == null || Math.abs(end - start) < 45 || !hasMultiple) return;
    ignoreNextClickRef.current = true;
    window.setTimeout(() => { ignoreNextClickRef.current = false; }, 350);
    moveImage(end < start ? 1 : -1);
  };

  const renderImage = (className = '', isPreview = false) => unavailable ? (
    <div className="product-gallery-unavailable"><span>N</span><small>Product image unavailable</small></div>
  ) : (
    <img
      className={`${className}${imageLoaded ? ' is-loaded' : ''}`}
      src={currentUrl}
      alt={currentAlt}
      width="950"
      height="1160"
      decoding="async"
      loading={isPreview ? 'lazy' : 'eager'}
      fetchPriority={isPreview ? 'low' : 'high'}
      onLoad={() => setLoadedImageUrl(currentUrl)}
      onError={() => setFailedImages((current) => new Set(current).add(currentUrl))}
    />
  );

  return <section className={`product-gallery${hasMultiple ? ' has-thumbnails' : ''}`} aria-label={`${productName} product images`}>
    <div
      className={`product-gallery-stage${!imageLoaded && !unavailable ? ' is-loading' : ''}`}
      ref={stageRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {unavailable
        ? renderImage()
        : <button
          type="button"
          className="product-gallery-image-trigger"
          onClick={() => {
            if (ignoreNextClickRef.current) {
              ignoreNextClickRef.current = false;
              return;
            }
            setZoomOpen(true);
          }}
          aria-label="Open product image preview"
          aria-haspopup="dialog"
        >
          {renderImage('product-gallery-main-image')}
          <span className="product-gallery-enlarge"><ZoomIn size={15} /> View larger</span>
        </button>}
      {hasMultiple && <>
        <button type="button" className="product-gallery-arrow is-previous" aria-label="Previous product image" onClick={() => moveImage(-1)}><ChevronLeft size={21} /></button>
        <button type="button" className="product-gallery-arrow is-next" aria-label="Next product image" onClick={() => moveImage(1)}><ChevronRight size={21} /></button>
      </>}
    </div>
    {hasMultiple && <div className="product-gallery-thumbnails" aria-label="Choose a product image">
      {images.map((image, index) => <button
        type="button"
        key={image._id || image.url}
        className={image.url === currentUrl ? 'is-active' : ''}
        onClick={() => onSelectImage(image.url)}
        aria-label={`View image ${index + 1}${image.isPrimary ? ', primary image' : ''}`}
        aria-pressed={image.url === currentUrl}
      >
        {failedImages.has(image.url)
          ? <span className="product-gallery-thumb-fallback">N</span>
          : <img src={image.url} alt="" width="110" height="135" loading={image.isPrimary ? 'eager' : 'lazy'} decoding="async" onError={() => setFailedImages((current) => new Set(current).add(image.url))} />}
      </button>)}
    </div>}
    {imageCredit && <p className="product-gallery-credit">Image credit: {imageSourceUrl ? <a href={imageSourceUrl} target="_blank" rel="noopener noreferrer">{imageCredit}</a> : imageCredit}</p>}
    <dialog
      ref={dialogRef}
      className="product-gallery-dialog"
      aria-label={`Image preview: ${productName}`}
      onCancel={() => setZoomOpen(false)}
      onClose={() => setZoomOpen(false)}
    >
      <button type="button" className="product-gallery-dialog-close" onClick={() => setZoomOpen(false)} aria-label="Close image preview"><X size={20} /></button>
      {hasMultiple && <button type="button" className="product-gallery-dialog-arrow is-previous" onClick={() => moveImage(-1)} aria-label="Previous product image"><ChevronLeft size={24} /></button>}
      {renderImage('product-gallery-dialog-image', true)}
      {hasMultiple && <button type="button" className="product-gallery-dialog-arrow is-next" onClick={() => moveImage(1)} aria-label="Next product image"><ChevronRight size={24} /></button>}
    </dialog>
  </section>;
}
