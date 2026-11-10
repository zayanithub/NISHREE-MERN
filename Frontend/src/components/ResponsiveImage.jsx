import responsiveImageManifest from '../utils/responsiveImageManifest.json';

function normalizeImagePath(value) {
  return String(value || '')
    .replace(/^https?:\/\/[^/]+/i, '')
    .split(/[?#]/, 1)[0];
}

function buildSrcSet(variants = []) {
  return variants.map(({ src, width }) => `${src} ${width}w`).join(', ');
}

export default function ResponsiveImage({
  src,
  responsiveKey = src,
  alt = '',
  sizes = '100vw',
  pictureClassName,
  ...imageProps
}) {
  const variants = responsiveImageManifest[normalizeImagePath(responsiveKey)];
  if (!variants) return <img src={src} alt={alt} sizes={sizes} {...imageProps} />;

  return (
    <picture className={pictureClassName} style={pictureClassName ? undefined : { display: 'contents' }}>
      <source type="image/avif" srcSet={buildSrcSet(variants.avif)} sizes={sizes} />
      <source type="image/webp" srcSet={buildSrcSet(variants.webp)} sizes={sizes} />
      <img src={src} alt={alt} sizes={sizes} {...imageProps} />
    </picture>
  );
}
