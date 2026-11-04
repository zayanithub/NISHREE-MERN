import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/DBconfig.js';
import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';

await connectDB();
try {
  const products = await Product.find({ sku: /^NIA-SAMPLE-/ })
    .select('sku status primaryImage tags')
    .lean();
  const productIds = products.map((product) => product._id);
  const inventory = await Inventory.find({
    product: { $in: productIds },
    inventoryType: 'product',
  }).select('product quantity reservedQuantity').lean();

  const result = {
    products: products.length,
    active: products.filter((product) => product.status === 'active').length,
    uniqueSkus: new Set(products.map((product) => product.sku)).size,
    imageReferences: products.filter((product) => product.primaryImage?.url).length,
    previewTagged: products.filter((product) => product.tags?.includes('catalogue-preview')).length,
    inventoryRecords: inventory.length,
    allStockUnverifiedAndZero: inventory.length === 50 && inventory.every(
      (record) => record.quantity === 0 && record.reservedQuantity === 0,
    ),
  };
  console.log(JSON.stringify(result, null, 2));

  if (
    result.products !== 50 || result.active !== 50 || result.uniqueSkus !== 50
    || result.imageReferences !== 50 || result.previewTagged !== 50
    || !result.allStockUnverifiedAndZero
  ) {
    process.exitCode = 1;
  }
} finally {
  await mongoose.disconnect();
}
