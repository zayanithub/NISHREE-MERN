import { useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import ProductCard from './ProductCard';

export default function ShopProductRail({
  id,
  title,
  kicker,
  description,
  products = [],
  status = 'ready',
  onRetry,
  to = '/shop',
  linkLabel = 'View all pieces',
  compact = false,
}) {
  const trackRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const move = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * Math.max(240, track.clientWidth * 0.82),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  if (status === 'ready' && products.length === 0) return null;

  return (
    <motion.section
      className={`shop-product-rail${compact ? ' is-compact' : ''}`}
      aria-labelledby={`${id}-title`}
      initial={reduceMotion ? false : { opacity: 0, y: 15 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="shop-rail-heading">
        <div>
          <span className="eyebrow">{kicker}</span>
          <h2 id={`${id}-title`}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <div className="shop-rail-actions">
          <Link to={to} className="text-link">{linkLabel}<ArrowRight size={15} aria-hidden="true" /></Link>
          {products.length > 2 && (
            <div className="shop-rail-controls" role="group" aria-label={`${title} carousel controls`}>
              <button type="button" onClick={() => move(-1)} aria-label={`Scroll ${title} left`}><ChevronLeft size={17} aria-hidden="true" /></button>
              <button type="button" onClick={() => move(1)} aria-label={`Scroll ${title} right`}><ChevronRight size={17} aria-hidden="true" /></button>
            </div>
          )}
        </div>
      </div>

      {status === 'loading' ? (
        <div className="shop-rail-loading" role="status" aria-label={`Loading ${title}`}>
          {[0, 1, 2, 3].map((index) => (
            <div className="shop-rail-skeleton" key={index}>
              <div />
              <span />
              <i />
            </div>
          ))}
        </div>
      ) : status === 'error' ? (
        <div className="shop-rail-error" role="alert">
          <span>{title} could not be loaded just now.</span>
          {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
        </div>
      ) : (
        <div className="shop-rail-track" ref={trackRef} role="region" aria-label={`${title} products`} tabIndex={0}>
          {products.map((product, index) => (
            <div className="shop-rail-item" key={product._id || product.slug}>
              <ProductCard product={product} index={index} />
            </div>
          ))}
        </div>
      )}
    </motion.section>
  );
}
