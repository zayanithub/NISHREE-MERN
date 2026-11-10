import { Heart, MessageCircle, Package, Search, Sparkles, Tag, Truck, RefreshCw } from 'lucide-react';
import { QUICK_ACTIONS } from '../../chatbot/faqDatabase';

const icons = { sparkles: Sparkles, heart: Heart, fabric: Search, tag: Tag, truck: Truck, return: RefreshCw, package: Package, message: MessageCircle };

export default function QuickActionGrid({ language, onSelect, compact = false }) {
  return (
    <div className={`assistant-quick-grid${compact ? ' is-compact' : ''}`} aria-label="Shopping assistant topics">
      {QUICK_ACTIONS.map((action) => {
        const Icon = icons[action.icon];
        return (
          <button type="button" className="assistant-quick-card" key={action.id} onClick={() => onSelect(action)}>
            <span className="assistant-quick-icon"><Icon size={16} aria-hidden="true" /></span>
            <span>{action.label[language] || action.label.en}</span>
          </button>
        );
      })}
    </div>
  );
}
