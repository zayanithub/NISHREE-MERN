import { sareeProductImageSources } from '../seed/sareeCatalogue.js';

const origin = (process.env.STOREFRONT_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const results = await Promise.all(sareeProductImageSources.map(async (image) => {
  const response = await fetch(`${origin}${image.storefrontUrl}`);
  const contentType = response.headers.get('content-type') || '';
  const bytes = await response.arrayBuffer();
  return {
    fileName: image.fileName,
    status: response.status,
    contentType,
    bytes: bytes.byteLength,
    valid: response.ok && contentType.startsWith('image/') && bytes.byteLength > 5000,
  };
}));

const failed = results.filter((result) => !result.valid);
console.log(JSON.stringify({ checked: results.length, failed: failed.length, failures: failed }, null, 2));
if (failed.length) process.exitCode = 1;
