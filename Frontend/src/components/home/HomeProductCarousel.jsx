import { useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import ProductCard from '../ProductCard';
import { ErrorState, SkeletonGrid } from '../States';

export default function HomeProductCarousel({
  title,
  kicker,
  description,
  products = [],
  status = 'ready',
  onRetry,
  link = '/shop',
  linkText = 'View the collection',
  id,
}) {
  const trackRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const moveTrack = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * Math.max(260, track.clientWidth * 0.82),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <motion.section
      id={id}
      className="home-product-carousel section-shell"
      aria-labelledby={`${id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-title`}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="home-carousel-heading">
        <div>
          <span className="eyebrow">{kicker}</span>
          <h2 id={`${id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-title`}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <div className="home-carousel-actions">
          <Link className="text-link" to={link}>{linkText}<ArrowRight size={15} aria-hidden="true" /></Link>
          <div className="home-carousel-controls" aria-label={`${title} carousel controls`}>
            <button type="button" onClick={() => moveTrack(-1)} aria-label={`Scroll ${title} left`}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => moveTrack(1)} aria-label={`Scroll ${title} right`}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {status === 'loading' ? (
        <div className="home-carousel-loading"><SkeletonGrid count={4} /></div>
      ) : status === 'error' ? (
        <ErrorState message={`We could not load ${title.toLowerCase()} right now.`} onRetry={onRetry} />
      ) : products.length ? (
        <div className="home-carousel-viewport" ref={trackRef} tabIndex={0} role="region" aria-label={`${title} products`}>
          {products.map((product, index) => (
            <motion.div
              className="home-carousel-product min-w-0"
              key={product._id || product.slug}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              transition={{ duration: 0.35, delay: reduceMotion ? 0 : Math.min(index * 0.055, 0.22) }}
            >
              <ProductCard product={product} index={index} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="home-carousel-empty" role="status">
          <span className="eyebrow">A pause in the edit</span>
          <p>There are no pieces to show here yet. Please return soon.</p>
        </div>
      )}
    </motion.section>
  );
}
