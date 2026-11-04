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
  assert.equal(settings.policies.cod.isPublished, true);
  assert.equal(settings.policies.privacy.isPublished, false);
});

test('public store settings overlay configured values while keeping business rules fixed', async (t) => {
  t.mock.method(StoreSettings, 'findOne', () => ({
    lean: async () => ({ storeName: 'Nishree Attire', supportPhone: '9444000000', codLimit: 9000 }),
  }));
  const settings = await getPublicStoreDetails();

  assert.equal(settings.supportPhone, '9444000000');
  assert.equal(settings.supportEmail, 'info.nishree@gmail.com');
  assert.equal(settings.codLimit, 2000);
  assert.equal(settings.policies.cod.isPublished, true);
});
