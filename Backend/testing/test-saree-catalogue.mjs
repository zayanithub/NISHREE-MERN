import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  modelSareeImageSources,
  sareeCatalogueProducts,
  sareeModelProducts,
  sareeProductImageSources,
  validateSareeCatalogue,
} from '../seed/sareeCatalogue.js';
import { seedSareeCatalogue } from '../seed/seedProducts.js';

const publicImageDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../Frontend/public/catalogue-preview');
const publicModelImageDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../Frontend/public/catalogue-models');

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

test('model saree photos are grouped into ten zero-stock draft products', () => {
  assert.equal(sareeModelProducts.length, 10);
  assert.equal(modelSareeImageSources.length, 30);
  assert.equal(new Set(sareeModelProducts.map((product) => product.sku)).size, 10);
  for (const product of sareeModelProducts) {
    assert.equal(product.status, 'draft');
    assert.equal(product.basePrice, 0);
    assert.equal(product.availableQuantity, 0);
    assert.equal(product.galleryImages.length, 3);
    assert.match(product.description, /not been verified/i);
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

test('all 30 model saree photos are copied to the public product image directory', () => {
  for (const image of modelSareeImageSources) {
    const path = join(publicModelImageDirectory, image.fileName);
    const bytes = readFileSync(path);
    assert.ok(statSync(path).size > 5000, `${image.fileName} should not be empty`);
    assert.ok(bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff, `${image.fileName} should be a valid JPEG`);
  }
});

test('catalogue seed dry run validates the dataset without connecting to MongoDB', async () => {
  const result = await seedSareeCatalogue({ dryRun: true });
  assert.deepEqual(result, {
    dryRun: true,
    categories: 9,
    products: 60,
    modelProducts: 10,
    modelImages: 30,
    initialStock: 0,
    refreshImages: false,
    refreshProducts: false,
  });
});
