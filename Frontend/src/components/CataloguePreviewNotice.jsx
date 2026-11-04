import { Link } from 'react-router-dom';

export default function CataloguePreviewNotice({ className = '' }) {
  return <aside className={`catalogue-preview-note ${className}`.trim()}>
    <strong>Sample catalogue preview</strong>
    <span>Product images, details and prices are illustrative examples. Seeded stock starts at zero and is unconfirmed; the store must verify each item and update inventory before accepting orders.</span>
    <Link to="/contact">Contact Nishree Attire</Link>
  </aside>;
}
