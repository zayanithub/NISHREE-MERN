import assert from 'node:assert/strict';
import test from 'node:test';
import { getMainMenuMessage, normalizeAssistantText, processAssistantMessage, RULE_PATTERN_COUNT } from './chatbotEngine.js';
import { QUICK_ACTIONS } from './faqDatabase.js';

test('the rule database includes broad predefined question coverage', () => {
  assert.ok(RULE_PATTERN_COUNT >= 60);
});

test('the first conversation offers the eight shopping topics', () => {
  assert.equal(getMainMenuMessage('en').quickActions, true);
  assert.equal(QUICK_ACTIONS.length, 8);
});

test('bridal queries return a live product filter rather than an invented product', () => {
  const response = processAssistantMessage('Show me bridal sarees');
  assert.equal(response.productQuery.occasion, 'bridal');
  assert.equal(response.products, undefined);
});

test('Tamil-English wedding queries start the guided occasion flow', () => {
  const response = processAssistantMessage('Wedding sarees venum');
  assert.equal(response.flow, 'wedding-look');
  assert.ok(response.suggestions.includes('Traditional bridal'));
});

test('Tamil-English material queries use the catalogue material filter', () => {
  const response = processAssistantMessage('Silk saree iruka?');
  assert.equal(response.productQuery.material, 'silk');
});

test('Tamil-English budget queries preserve the complete rupee amount', () => {
  const response = processAssistantMessage('Budget 5000 kulla saree iruka?');
  assert.equal(response.productQuery.maxPrice, 5000);
});

test('colour requests map to current catalogue filters', () => {
  const response = processAssistantMessage('Red colour saree venum');
  assert.equal(response.productQuery.color, 'red');
});

test('combined bridal and budget requests keep both catalogue filters', () => {
  const response = processAssistantMessage('Bridal sarees under ₹10,000');
  assert.equal(response.productQuery.occasion, 'bridal');
  assert.equal(response.productQuery.maxPrice, 10000);
});

test('Tamil text is matched to a predefined response', () => {
  assert.match(normalizeAssistantText('விநியோகம் எத்தனை நாட்கள்?'), /விநியோகம்/);
  const response = processAssistantMessage('விநியோகம் எத்தனை நாட்கள்?', { language: 'ta' });
  assert.match(response.text, /1–3 வேலை நாட்களில்/);
  assert.ok(response.links.some((link) => link.to === '/policies/shipping'));
});

test('Tamil saree requests are filtered through the live catalogue', () => {
  const response = processAssistantMessage('சிவப்பு சேலை வேண்டும்', { language: 'ta' });
  assert.equal(response.productQuery.color, 'red');
  assert.equal(response.text.includes('தற்போதைய பட்டியலில்'), true);
});

test('returns answers use the published return window and policy links', () => {
  const response = processAssistantMessage('Return panna mudiyuma?');
  assert.match(response.text, /7 days/);
  assert.ok(response.links.some((link) => link.to === '/policies/returns'));
});

test('unknown questions receive the explicit fallback and support options', () => {
  const response = processAssistantMessage('Can you write a poem about the moon?');
  assert.match(response.text, /couldn’t find an exact answer/i);
  assert.equal(response.contact, true);
});

test('COD answers use the configured limit without requesting payment credentials', () => {
  const response = processAssistantMessage('Is COD available?', { codLimit: 2000 });
  assert.match(response.text, /₹2,000/);
  assert.match(response.text, /do not share payment credentials/);
});
