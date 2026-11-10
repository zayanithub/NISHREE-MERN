import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice, productImage } from '../../utils/format';
import ResponsiveImage from '../ResponsiveImage';

export default function ProductRecommendationCard({ product, onOpen }) {
  const image = productImage(product);
  const price = product.salePrice ?? product.basePrice;
  const hasSale = product.salePrice != null && product.salePrice < product.basePrice;
  const discount = hasSale ? Math.round((1 - product.salePrice / product.basePrice) * 100) : 0;
  const available = Number(product.availableQuantity || 0) > 0;

  return (
    <article className="assistant-product-card">
      <Link to={`/products/${product.slug}`} className="assistant-product-image" onClick={onOpen} aria-label={`View ${product.name}`}>
        {image
          ? <ResponsiveImage src={image} alt={product.imageAltText || product.name} loading="lazy" decoding="async" width="100" height="120" sizes="86px" />
          : <span aria-hidden="true">N</span>}
      </Link>
      <div className="assistant-product-copy">
        <Link to={`/products/${product.slug}`} className="assistant-product-name" onClick={onOpen}>{product.name}</Link>
        <span className="assistant-product-material">{product.material || product.category?.name || 'Nishree Attire'}</span>
        <div className="assistant-product-prices">
          <strong>{formatPrice(price, product.currency)}</strong>
          {hasSale && <><del>{formatPrice(product.basePrice, product.currency)}</del><span>{discount}% off</span></>}
        </div>
        <small className={available ? 'is-available' : 'is-unavailable'}>{available ? 'Available now' : 'Currently unavailable'}</small>
        <Link to={`/products/${product.slug}`} className="assistant-product-link" onClick={onOpen}>View product <ArrowUpRight size={13} aria-hidden="true" /></Link>
      </div>
    </article>
  );
}
