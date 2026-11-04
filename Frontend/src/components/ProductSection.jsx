import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';
import { EmptyState, ErrorState, SkeletonGrid } from './States';

export default function ProductSection({ title, kicker, products, loading, error, onRetry, link = '/shop', linkText = 'View the collection' }) {
  return <section className="section-shell product-section">
    <div className="section-heading-row"><div><span className="eyebrow">{kicker}</span><h2>{title}</h2></div><Link className="text-link" to={link}>{linkText}<ArrowRight size={15} /></Link></div>
    {loading ? <SkeletonGrid count={4} /> : error ? <ErrorState message={error} onRetry={onRetry} /> : products?.length ? <div className="product-grid">{products.map((product, index) => <ProductCard key={product._id} product={product} index={index} />)}</div> : <EmptyState title="The next pieces are being prepared." ><span>There are no pieces to show here yet. Please return soon.</span></EmptyState>}
  </section>;
}
