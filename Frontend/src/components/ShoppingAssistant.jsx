import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatPrice } from '../utils/format';
import { useStoreSettings } from '../settings/useStoreSettings';

const suggestions = ['Silk sarees under ₹5,000', 'How do I place an order?', 'Is COD available?', 'Returns & exchanges', 'Track my order'];

export default function ShoppingAssistant({ open, onClose }) {
  const settings = useStoreSettings();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('faq');
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Namaste! I can help you explore sarees, check catalogue details, and understand store policies. What would you like to know?' }]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ block: 'end' }); }, [messages, busy]);

  const ask = async (text = message) => {
    const question = text.trim();
    if (!question || busy) return;
    setMessage(''); setBusy(true);
    setMessages((current) => [...current, { role: 'user', text: question }]);
    try {
      const { data } = await api.post('/chatbot/ask', { message: question });
      setMode(data.mode || 'faq');
      setMessages((current) => [...current, { role: 'assistant', text: data.reply || 'Please contact the store for help.', products: data.products || [] }]);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', text: 'I could not reach the store assistant just now. Please contact the team on WhatsApp for a confirmed answer.', contact: true }]);
    } finally { setBusy(false); }
  };

  return open && <section id="nishree-assistant-panel" className="assistant-panel" role="dialog" aria-label="Nishree Attire shopping assistant"><header className="assistant-header"><span className="assistant-avatar"><Bot size={19} /></span><div><strong>Nishree assistant</strong><small>{mode === 'ai' ? 'AI catalogue assistant' : 'Customer help · catalogue + FAQ'}</small></div><button type="button" className="assistant-close" onClick={onClose} aria-label="Close chat"><X size={18} /></button></header>
      <div className="assistant-messages" aria-live="polite">{messages.map((item, index) => <article className={`assistant-message message-${item.role}`} key={`${item.role}-${index}`}><p>{item.text}</p>{item.contact && <a href={settings.whatsappUrl} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a>}{item.products?.length > 0 && <div className="assistant-products">{item.products.map((product) => <Link to={`/products/${product.slug}`} key={product.slug} onClick={onClose}><strong>{product.name}</strong><span>{product.material || product.category}{product.color ? ` · ${product.color}` : ''}</span><span>{formatPrice(product.price)} · {Number(product.availableQuantity) > 0 ? `${product.availableQuantity} available` : 'Out of stock'}</span></Link>)}</div>}</article>)}{busy && <div className="assistant-message message-assistant assistant-typing" role="status"><span /><span /><span /><small>Finding a helpful answer…</small></div>}<span ref={messagesEndRef} aria-hidden="true" /></div>
      {messages.length < 3 && <div className="assistant-suggestions">{suggestions.map((item) => <button type="button" key={item} onClick={() => void ask(item)} disabled={busy}>{item}</button>)}</div>}
      <form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); void ask(); }}><label className="sr-only" htmlFor="assistant-question">Your question</label><input id="assistant-question" ref={inputRef} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder="Ask about products, orders, or policies" disabled={busy} /><button type="submit" disabled={busy || !message.trim()} aria-label="Send question"><Send size={17} /></button></form><small className="assistant-disclosure">{mode === 'ai' ? 'AI answers use the current catalogue and store information.' : 'Instant answers use the current catalogue and store FAQ.'} Availability is shown only when stock is confirmed.</small>
    </section>;
}
