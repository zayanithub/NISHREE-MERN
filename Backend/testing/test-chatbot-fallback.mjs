import test from 'node:test';
import assert from 'node:assert/strict';
import { answerStoreQuestionFallback } from '../service/chatbotService.js';

const products = [
  {
    name: 'Rose Kanchipuram Silk Saree', slug: 'rose-kanchipuram-silk', basePrice: 6200, salePrice: 4800,
    category: { name: 'Kanchipuram Silk' }, material: 'Pure silk', color: 'Rose pink', availableQuantity: 0,
    blouseIncluded: true, blouseType: 'unstitched', sareeLength: '6.3 metres', fabricCare: 'Dry clean only', occasion: ['Wedding'],
    tags: ['silk', 'traditional'], shortDescription: 'Rose pink silk saree with woven gold border.',
  },
  {
    name: 'Teal Handloom Cotton Saree', slug: 'teal-handloom-cotton', basePrice: 2400,
    category: { name: 'Cotton' }, material: 'Cotton', color: 'Teal', availableQuantity: 3,
    blouseIncluded: false, blouseType: 'none', tags: ['cotton', 'handloom'],
  },
  {
    name: 'Ivory Organza Festive Saree', slug: 'ivory-organza-festive', basePrice: 3800,
    category: { name: 'Organza' }, material: 'Organza', color: 'Ivory', availableQuantity: 1,
    tags: ['organza', 'festive'], occasion: ['Festive'],
  },
];

const answer = (question) => answerStoreQuestionFallback(question, products);

test('greets visitors and explains what the shopping assistant can help with', () => {
  assert.match(answer('Vanakkam!').reply, /help you find sarees/i);
  assert.match(answer('What can you help with?').reply, /COD/i);
});

test('answers catalogue and budget questions with current listed prices and availability', () => {
  const result = answer('Show me silk sarees under ₹5,000');
  assert.match(result.reply, /₹4,800/);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].slug, 'rose-kanchipuram-silk');
  assert.equal(result.products[0].availableQuantity, 0);
});

test('understands common English/Tanglish budget and order phrasing', () => {
  const budget = answer('Silk sarees 5k kulla');
  assert.match(budget.reply, /₹4,800/);
  assert.equal(answer('Order epdi place panrathu?').reply.includes('Add to bag'), true);
});

test('does not call a matching out-of-stock product available', () => {
  const result = answer('Is the rose silk saree available?');
  assert.match(result.reply, /no verified stock/i);
  assert.equal(result.contact, true);
});

test('reports only products whose inventory is positive when asking for in-stock cotton sarees', () => {
  const result = answer('Do you have cotton sarees in stock?');
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].slug, 'teal-handloom-cotton');
  assert.match(result.reply, /currently show stock/i);
});

test('uses product data for blouse, length and care questions', () => {
  const blouse = answer('Does the rose silk saree include a blouse piece?');
  assert.match(blouse.reply, /included \(unstitched\)/i);
  const length = answer('What is the length of the rose silk saree?');
  assert.match(length.reply, /6.3 metres/i);
  const care = answer('How do I wash the rose silk saree?');
  assert.match(care.reply, /Dry clean only/i);
});

test('applies the COD limit and explains purchase flow', () => {
  assert.match(answer('Can I use COD?').reply, /₹2,000 or less/);
  assert.match(answer('How do I place an order?').reply, /Add to bag.*checkout/i);
});

test('directs private order tracking to the signed-in order page', () => {
  const result = answer('Where is my order?');
  assert.match(result.reply, /can’t look up an individual order/i);
  assert.match(result.reply, /sign in and open My account/i);
  assert.equal(result.contact, true);
});

test('explains the seven-day return window and damaged-item reporting requirements', () => {
  assert.match(answer('What is your return and exchange policy?').reply, /within 7 days of receiving/i);
  const damaged = answer('My saree was damaged in transit, can I return it?');
  assert.match(damaged.reply, /within 48 hours of delivery/i);
  assert.equal(damaged.contact, true);
});

test('explains the published shipping estimate and offers support for unknown questions', () => {
  assert.match(answer('How long does delivery take?').reply, /5–10 business days after dispatch/i);
  const unknown = answer('Can you tailor a custom blouse?');
  assert.match(unknown.reply, /verified answer/i);
  assert.equal(unknown.contact, true);
});
