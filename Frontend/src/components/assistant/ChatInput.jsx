import { forwardRef, useEffect } from 'react';
import { Send } from 'lucide-react';

const ChatInput = forwardRef(function ChatInput({ value, onChange, onSubmit, disabled }, ref) {
  useEffect(() => {
    if (!ref || typeof ref === 'function' || !ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, 88)}px`;
  }, [ref, value]);

  return (
    <form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <label className="sr-only" htmlFor="assistant-question">Ask Nishree Assistant</label>
      <textarea
        id="assistant-question"
        ref={ref}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          event.target.style.height = 'auto';
          event.target.style.height = `${Math.min(event.target.scrollHeight, 88)}px`;
        }}
        maxLength={500}
        rows={1}
        placeholder="Ask me about sarees, collections, or orders..."
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <button type="submit" disabled={disabled || !value.trim()} aria-label="Send message">
        <Send size={17} aria-hidden="true" />
      </button>
      <small>Enter to send · Shift + Enter for a new line</small>
    </form>
  );
});

export default ChatInput;
