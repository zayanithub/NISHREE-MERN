# Store enquiry chatbot

The customer chatbot uses the live catalogue, store settings and approved policy values. With no AI key configured, it uses the server's FAQ and catalogue-matching fallback. The fallback does not promise delivery dates, invent stock, or reveal order information.

The fallback handles greetings, product and fabric searches, listed-price and budget questions, stock, blouse-piece and care details, COD/payment, ordering, account help, order-tracking guidance, delivery questions, returns/exchanges, refunds/cancellations, and store contact details. Customers can ask in common English or simple Tanglish phrasing. It never reads personal order records in the public chat; customers must sign in to view order status. Unverified questions link to official WhatsApp support.

To enable the optional OpenAI response layer, set these variables in the backend's local environment or deployment secret store, then restart the API:

```text
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=gpt-4o-mini
```

`OPENAI_MODEL` is optional; the current default is `gpt-4o-mini`. Keep `OPENAI_API_KEY` on the server. Never use a `VITE_OPENAI_API_KEY` or include the key in frontend code. If the provider is unavailable or returns an error, the chatbot falls back to its verified FAQ responses. Product matches are attached as links when the catalogue matches the question.

The chat header shows **AI catalogue assistant** only after the AI provider returns a usable answer. **Catalogue + FAQ help** indicates that the visitor is receiving the deterministic fallback.
