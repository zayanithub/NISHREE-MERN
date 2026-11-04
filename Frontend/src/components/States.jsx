import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react';

export function LoadingState({ label = 'Gathering the collection…', compact = false }) {
  return <div className={`loading-state${compact ? ' is-compact' : ''}`} role="status"><LoaderCircle size={18} aria-hidden="true" /><span>{label}</span></div>;
}

export function ErrorState({ message, onRetry }) {
  return <div className="state-panel" role="alert"><AlertCircle size={22} aria-hidden="true" /><p>{message || 'We could not load this just now.'}</p>{onRetry && <button className="button button-quiet" type="button" onClick={onRetry}><RefreshCw size={15} /> Try again</button>}</div>;
}

export function EmptyState({ title, children, action }) {
  return <div className="state-panel empty-state"><span className="eyebrow">A little pause</span><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}

export function SkeletonGrid({ count = 4 }) {
  return <div className="product-grid" aria-label="Loading pieces">{Array.from({ length: count }, (_, index) => <div className="product-skeleton" key={index}><div /><span /><i /></div>)}</div>;
}
