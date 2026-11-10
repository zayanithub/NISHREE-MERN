import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalogApi } from '../api/catalogApi';
import { processAssistantMessage, getMainMenuMessage } from '../chatbot/chatbotEngine.js';
import { QUICK_ACTIONS } from '../chatbot/faqDatabase.js';
import { formatDate, formatPrice } from '../utils/format';
import { useStoreSettings } from '../settings/useStoreSettings';
import ChatHeader from './assistant/ChatHeader';
import ChatInput from './assistant/ChatInput';
import ProductRecommendationCard from './assistant/ProductRecommendationCard';
import QuickActionGrid from './assistant/QuickActionGrid';
import TypingIndicator from './assistant/TypingIndicator';
import './ShoppingAssistant.css';

let nextMessageId = 0;
const createMessage = (role, data) => ({ id: ++nextMessageId, role, ...data });

export default function ShoppingAssistant({ open, onClose }) {
  const settings = useStoreSettings();
  const [language, setLanguage] = useState('en');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState('');
  const [messages, setMessages] = useState(() => [createMessage('assistant', getMainMenuMessage('en'))]);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const messageEndRef = useRef(null);
  const previousMessageCountRef = useRef(0);
  const requestRef = useRef(null);
  const responseTimerRef = useRef(null);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    const mobile = window.matchMedia('(max-width: 600px)').matches;
    const previousOverflow = document.body.style.overflow;
    if (mobile) document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const viewport = window.visualViewport;
    const updateViewport = () => {
      if (panel && viewport && mobile) panel.style.setProperty('--assistant-viewport-height', `${viewport.height}px`);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !mobile || !panel) return;
      const focusable = [...panel.querySelectorAll('button:not(:disabled), a[href], select, textarea:not(:disabled)')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      if (mobile) document.body.style.overflow = previousOverflow;
      viewport?.removeEventListener('resize', updateViewport);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    if (previousMessageCountRef.current && messages.length !== previousMessageCountRef.current) {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    previousMessageCountRef.current = messages.length;
  }, [messages, open]);

  useEffect(() => () => {
    requestRef.current?.abort();
    window.clearTimeout(responseTimerRef.current);
  }, []);

  const reset = () => {
    requestRef.current?.abort();
    setBusy(false);
    setFlow('');
    setMessage('');
    setMessages([createMessage('assistant', getMainMenuMessage(language))]);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const updateLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    if (messages.length === 1) setMessages([createMessage('assistant', getMainMenuMessage(nextLanguage))]);
  };

  const submit = async (text = message, engineInput = text) => {
    const question = String(text || '').trim();
    if (!question || busy) return;
    setMessage('');
    setBusy(true);
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setMessages((current) => [...current.slice(-47), createMessage('user', { text: question, engineInput })]);

    const response = processAssistantMessage(engineInput, { language, flow, codLimit: settings.codLimit });
    setFlow(response.flow || '');
    const requests = [];
    if (response.productQuery) {
      requests.push({
        type: 'products',
        promise: catalogApi.products({ page: 1, limit: 4, ...response.productQuery }, controller.signal)
          .then((result) => result.products || []),
      });
    }
    if (response.offerQuery) {
      requests.push({
        type: 'offers',
        promise: catalogApi.offers(controller.signal)
          .then((result) => Array.isArray(result?.offers) ? result.offers : []),
      });
    }

    try {
      const results = await Promise.allSettled(requests.map((request) => request.promise));
      if (controller.signal.aborted) return;
      let nextResponse = { ...response };
      results.forEach((result, index) => {
        const request = requests[index];
        if (result.status === 'rejected') {
          if (result.reason?.name === 'CanceledError' || result.reason?.name === 'AbortError' || result.reason?.code === 'ERR_CANCELED') return;
          if (request.type === 'products') {
            nextResponse.text = 'I could not load the live catalogue just now. You can still browse the collection directly, or ask our team for help.';
            nextResponse.links = [...(nextResponse.links || []), { label: 'Browse sarees', to: '/shop' }];
          } else {
            nextResponse.text = 'I could not check the current offers just now. Please view the collection or contact our team to confirm any active offer.';
            nextResponse.links = [...(nextResponse.links || []), { label: 'Contact support', to: '/contact' }];
          }
          nextResponse.contact = true;
          return;
        }
        if (request.type === 'products') {
          nextResponse.products = result.value;
          if (!result.value.length) {
            nextResponse.text = 'I could not find a matching currently listed piece. Try another colour, fabric or budget, or browse the full collection.';
            nextResponse.links = [...(nextResponse.links || []), { label: 'Browse all sarees', to: '/shop' }];
          }
        } else {
          nextResponse.offers = result.value;
          if (!result.value.length) {
            nextResponse.text = 'There are no active public offers to show right now. Product prices below are the current listed prices.';
            nextResponse.products = nextResponse.products || [];
          }
        }
      });

      await new Promise((resolve) => { responseTimerRef.current = window.setTimeout(resolve, 260); });
      if (controller.signal.aborted) return;
      setMessages((current) => [...current.slice(-48), createMessage('assistant', nextResponse)]);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const selectAction = (action) => {
    const label = action.label[language] || action.label.en;
    void submit(label, action.id);
  };

  const selectReply = (reply) => {
    const action = QUICK_ACTIONS.find((item) => item.id === reply);
    if (action) {
      selectAction(action);
      return;
    }
    void submit(reply);
  };

  if (!open) return null;

  return (
    <section
      id="nishree-assistant-panel"
      className="assistant-panel"
      ref={panelRef}
      role="dialog"
      aria-modal={window.matchMedia('(max-width: 600px)').matches}
      aria-label="Nishree Attire shopping assistant"
      aria-describedby="assistant-description"
    >
      <ChatHeader language={language} onLanguageChange={updateLanguage} onReset={reset} onMinimize={close} onClose={close} />
      <p className="sr-only" id="assistant-description">A rule-based shopping assistant. Messages are handled on this device using predefined answers and current public catalogue data. Do not share passwords, OTPs, or payment details.</p>
      <div className="assistant-messages" aria-live="polite" aria-relevant="additions text">
        <div className="assistant-date-divider"><span>YOUR NISHREE SHOPPING COMPANION</span></div>
        {messages.map((item) => (
          <article className={`assistant-message message-${item.role}`} key={item.id}>
            {item.role === 'assistant' && <span className="assistant-message-avatar" aria-hidden="true">N</span>}
            <div className="assistant-message-content">
              <p>{item.text}</p>
              {item.role === 'user' && <button className="assistant-repeat-question" type="button" disabled={busy} onClick={() => void submit(item.text, item.engineInput || item.text)}>Ask again</button>}
              {item.quickActions && <QuickActionGrid language={language} onSelect={selectAction} />}
              {item.suggestions?.length > 0 && <div className="assistant-replies">{item.suggestions.map((reply) => <button key={reply} type="button" disabled={busy} onClick={() => selectReply(reply)}>{reply}</button>)}</div>}
              {item.faqItems?.length > 0 && <div className="assistant-faq-list">{item.faqItems.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div>}
              {item.products?.length > 0 && <div className="assistant-products">{item.products.map((product) => <ProductRecommendationCard key={product._id || product.slug} product={product} onOpen={onClose} />)}</div>}
              {item.offers?.length > 0 && <div className="assistant-offers">{item.offers.map((offer) => <article className="assistant-offer-card" key={offer._id || offer.code || offer.description}>
                <strong>{offer.discountType === 'percentage' ? `${offer.discountValue}% off` : `${formatPrice(offer.discountValue)} off`}</strong>
                <span>{offer.description || 'A special offer from Nishree Attire'}</span>
                {offer.maxDiscount ? <small>Up to {formatPrice(offer.maxDiscount)}</small> : null}
                {offer.code ? <small>Code: {offer.code}</small> : null}
                {offer.minimumOrderValue ? <small>On orders over {formatPrice(offer.minimumOrderValue)}</small> : null}
                {offer.expiresAt ? <small>Until {formatDate(offer.expiresAt)}</small> : null}
              </article>)}</div>}
              {item.links?.length > 0 && <div className="assistant-link-row">{item.links.map((link) => <Link key={`${link.to}-${link.label}`} to={link.to} onClick={onClose}>{link.label}</Link>)}</div>}
              {item.contact && <div className="assistant-contact-actions">
                {settings.whatsappUrl && <a href={settings.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                {settings.supportEmail && <a href={`mailto:${settings.supportEmail}`}>Email our team</a>}
                <Link to="/contact" onClick={onClose}>Contact page</Link>
              </div>}
              {item.role === 'assistant' && !item.quickActions && <button className="assistant-back-menu" type="button" disabled={busy} onClick={() => void submit('Main menu', 'menu')}>Back to main menu</button>}
            </div>
          </article>
        ))}
        {busy && <TypingIndicator />}
        <span ref={messageEndRef} aria-hidden="true" />
      </div>
      <ChatInput ref={inputRef} value={message} onChange={setMessage} onSubmit={() => void submit()} disabled={busy} />
      <small className="assistant-disclosure">Rule-based help · Product details and prices come from the live catalogue. Never share passwords or OTPs.</small>
    </section>
  );
}
