import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sareeCatalogueProducts, sareeProductImageSources, validateSareeCatalogue } from '../seed/sareeCatalogue.js';
import { seedSareeCatalogue } from '../seed/seedProducts.js';

const publicImageDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../Frontend/public/catalogue-preview');

test('sample saree catalogue contains 50 unique, richly described product records', () => {
  assert.equal(validateSareeCatalogue(), true);
  assert.equal(sareeCatalogueProducts.length, 50);
  assert.equal(sareeProductImageSources.length, 50);
  assert.equal(new Set(sareeCatalogueProducts.map((product) => product.sku)).size, 50);
  assert.equal(new Set(sareeCatalogueProducts.map((product) => product.slug)).size, 50);
  assert.equal(new Set(sareeCatalogueProducts.map((product) => product.imageUrl)).size, 50);
  for (const product of sareeCatalogueProducts) {
    assert.ok(product.description.length > 120, `${product.sku} should have a detailed description`);
    assert.ok(product.shortDescription.length > 40, `${product.sku} should have a short description`);
    assert.ok(product.imageCredit);
    assert.ok(product.imageAltText);
    assert.equal(product.currency, 'INR');
    assert.equal(product.availableQuantity, 0);
    assert.equal(product.tags.includes('catalogue-preview'), true);
  }
});

test('all 50 seeded product image files exist and have a supported image signature', () => {
  for (const image of sareeProductImageSources) {
    const path = join(publicImageDirectory, image.fileName);
    const bytes = readFileSync(path);
    assert.ok(statSync(path).size > 5000, `${image.fileName} should not be empty or a broken placeholder`);
    const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isWebp = bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    assert.ok(isJpeg || isWebp, `${image.fileName} should be a valid JPEG or WebP file`);
  }
});

test('catalogue seed dry run validates the dataset without connecting to MongoDB', async () => {
  const result = await seedSareeCatalogue({ dryRun: true });
  assert.deepEqual(result, { dryRun: true, categories: 9, products: 50, initialStock: 0, refreshImages: false, refreshProducts: false });
});
