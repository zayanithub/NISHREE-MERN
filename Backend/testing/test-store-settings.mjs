import test from 'node:test';
import assert from 'node:assert/strict';
import StoreSettings from '../models/StoreSettings.js';
import { getPublicStoreDetails } from '../service/storeSettingsService.js';

test('public store settings use official defaults when no settings record exists', async (t) => {
  t.mock.method(StoreSettings, 'findOne', () => ({ lean: async () => null }));
  const settings = await getPublicStoreDetails();

  assert.equal(settings.storeName, 'Nishree Attire');
  assert.equal(settings.supportEmail, 'info.nishree@gmail.com');
  assert.equal(settings.supportPhone, '9344901028');
  assert.equal(settings.businessAddress, '44/41, Pillaiyar Kovil 1st Street, Mambakkam, Chennai, Tamil Nadu 600127, India.');
  assert.equal(settings.whatsappUrl, 'https://wa.me/919344901028/?text=Hi,%20Can%20you%20send%20details%20about%20your%20products');
  assert.equal(settings.instagramUrl, 'https://www.instagram.com/nishree_fashions/');
  assert.equal(settings.facebookUrl, 'https://www.facebook.com/share/19KgfTEgdN/');
  assert.equal(settings.codLimit, 2000);
  assert.deepEqual(Object.keys(settings.policies), ['terms', 'privacy', 'returns', 'shipping']);
  assert.equal(settings.policies.terms.isPublished, true);
  assert.equal(settings.policies.privacy.isPublished, true);
  assert.match(settings.policies.returns.content, /within 7 days of receiving the product/i);
  assert.match(settings.policies.shipping.content, /5–10 business days after dispatch/i);
});

test('public store settings overlay configured values while keeping business rules fixed', async (t) => {
  t.mock.method(StoreSettings, 'findOne', () => ({
    lean: async () => ({ storeName: 'Nishree Attire', supportPhone: '9444000000', codLimit: 9000 }),
  }));
  const settings = await getPublicStoreDetails();

  assert.equal(settings.supportPhone, '9444000000');
  assert.equal(settings.supportEmail, 'info.nishree@gmail.com');
  assert.equal(settings.codLimit, 2000);
  assert.equal(settings.policies.terms.isPublished, true);
  assert.equal(settings.policies.returns.isPublished, true);
});

test('public policies upgrade built-in drafts and preserve customized content', async (t) => {
  t.mock.method(StoreSettings, 'findOne', () => ({
    lean: async () => ({
      policies: {
        terms: { content: '', isPublished: false },
        privacy: { content: '', isPublished: false },
        returns: {
          content: 'A return or exchange may be requested within 5 days of the purchase date. Every request is reviewed and must be approved before it is processed. For a damaged or defective item, please send photographs of the issue to us on WhatsApp so the team can review them.',
          isPublished: true,
        },
        shipping: {
          content: 'The public catalogue does not publish a delivery-time estimate or a shipping-fee schedule. The shipping charge recorded for an order is shown in its checkout summary. Please contact the store before placing an order if you need the dispatch or delivery details confirmed.',
          isPublished: true,
        },
      },
    }),
  }));
  const settings = await getPublicStoreDetails();

  assert.equal(settings.policies.terms.isPublished, true);
  assert.equal(settings.policies.privacy.isPublished, true);
  assert.match(settings.policies.returns.content, /within 7 days of receiving the product/i);
  assert.match(settings.policies.shipping.content, /5–10 business days after dispatch/i);
});

test('public store settings keep explicitly customized policy content', async (t) => {
  t.mock.method(StoreSettings, 'findOne', () => ({
    lean: async () => ({
      policies: { terms: { content: 'Custom terms.', isPublished: true } },
    }),
  }));
  const settings = await getPublicStoreDetails();

  assert.equal(settings.policies.terms.content, 'Custom terms.');
});
