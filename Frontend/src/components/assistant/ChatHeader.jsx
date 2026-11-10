import { ChevronDown, RotateCcw, X } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../../chatbot/faqDatabase';

export default function ChatHeader({ language, onLanguageChange, onReset, onMinimize, onClose }) {
  return (
    <header className="assistant-header">
      <div className="assistant-brand-mark" aria-hidden="true">N</div>
      <div className="assistant-header-copy">
        <span className="assistant-brand-name">NISHREE ATTIRE</span>
        <strong>Nishree Assistant</strong>
        <small><span className="assistant-online-dot" /> Your Personal Saree Shopping Companion</small>
      </div>
      <label className="assistant-language">
        <span className="sr-only">Chat language</span>
        <select value={language} onChange={(event) => onLanguageChange(event.target.value)} aria-label="Chat language">
          {SUPPORTED_LANGUAGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <div className="assistant-header-actions">
        <button type="button" className="assistant-icon-button" onClick={onReset} aria-label="Reset conversation" title="Reset conversation"><RotateCcw size={16} aria-hidden="true" /></button>
        <button type="button" className="assistant-icon-button assistant-minimize" onClick={onMinimize} aria-label="Minimize assistant" title="Minimize"><ChevronDown size={18} aria-hidden="true" /></button>
        <button type="button" className="assistant-icon-button" onClick={onClose} aria-label="Close assistant" title="Close"><X size={18} aria-hidden="true" /></button>
      </div>
    </header>
  );
}
