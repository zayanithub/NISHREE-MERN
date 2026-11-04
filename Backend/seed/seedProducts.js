import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/DBconfig.js';
import Category from '../models/Category.js';
import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';
import { sareeCatalogueProducts, sareeCategories, validateSareeCatalogue } from './sareeCatalogue.js';

export const seedSareeCatalogue = async ({ dryRun = false, refreshImages = false, refreshProducts = false } = {}) => {
  validateSareeCatalogue();
  if (dryRun) {
    return { dryRun: true, categories: sareeCategories.length, products: sareeCatalogueProducts.length, initialStock: 0, refreshImages, refreshProducts };
  }
  if (!process.env.MONGO_URL) throw new Error('MONGO_URL is missing from the backend environment.');

  await connectDB();
  const categoryIds = new Map();

  for (const category of sareeCategories) {
    const savedCategory = await Category.findOneAndUpdate(
      { slug: category.slug },
      {
        $set: { isActive: true },
        $setOnInsert: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          sortOrder: category.sortOrder,
          isFeatured: false,
        },
      },
      { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).select('_id slug').lean();
    categoryIds.set(category.slug, savedCategory._id);
  }

  let insertedProducts = 0;
  let existingProducts = 0;
  for (const sample of sareeCatalogueProducts) {
    const image = {
      url: sample.imageUrl,
      publicId: '',
    };
    const productData = {
      name: sample.name,
      slug: sample.slug,
      sku: sample.sku,
      description: sample.description,
      shortDescription: sample.shortDescription,
      category: categoryIds.get(sample.categorySlug),
      brand: sample.brand,
      material: sample.material,
      color: sample.color,
      sareeLength: sample.sareeLength,
      blouseIncluded: sample.blouseIncluded,
      blouseType: sample.blouseType,
      basePrice: sample.basePrice,
      salePrice: sample.salePrice,
      currency: 'INR',
      primaryImage: image,
      imageAltText: sample.imageAltText,
      imageCredit: sample.imageCredit,
      imageLicense: sample.imageLicense,
      imageSourceUrl: sample.imageSourceUrl,
      tags: sample.tags,
      fabricCare: sample.fabricCare,
      occasion: sample.occasion,
      isFeatured: sample.isFeatured,
      status: sample.status,
      seoTitle: sample.name.slice(0, 70),
      seoDescription: sample.shortDescription.slice(0, 200),
    };

    let product = await Product.findOne({ sku: sample.sku }).select('_id').lean();
    if (product) {
      existingProducts += 1;
    } else {
      try {
        const created = await Product.create(productData);
        product = { _id: created._id };
        insertedProducts += 1;
      } catch (error) {
        if (error.code !== 11000) throw error;
        product = await Product.findOne({ sku: sample.sku }).select('_id').lean();
        if (!product) throw error;
        existingProducts += 1;
      }
    }
    if (!product) throw new Error(`Could not load seeded product ${sample.sku} after upsert.`);

    if (refreshProducts) {
      const productDocument = await Product.findById(product._id);
      if (!productDocument) throw new Error(`Could not load seeded product ${sample.sku} for refresh.`);
      Object.assign(productDocument, productData);
      await productDocument.save();
    }

    if (refreshImages && !refreshProducts) {
      const imageProduct = await Product.findById(product._id);
      if (!imageProduct) throw new Error(`Could not load seeded product ${sample.sku} for image refresh.`);
      imageProduct.primaryImage = image;
      imageProduct.imageAltText = sample.imageAltText;
      imageProduct.imageCredit = sample.imageCredit;
      imageProduct.imageLicense = sample.imageLicense;
      imageProduct.imageSourceUrl = sample.imageSourceUrl;
      await imageProduct.save();
    }

    await Inventory.updateOne(
      { product: product._id, inventoryType: 'product' },
      { $setOnInsert: { quantity: 0, reservedQuantity: 0, lowStockThreshold: 5 } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  return {
    dryRun: false,
    categories: sareeCategories.length,
    productsInserted: insertedProducts,
    productsAlreadyPresent: existingProducts,
    initialStock: 0,
    imagesRefreshed: refreshImages ? sareeCatalogueProducts.length : 0,
    productsRefreshed: refreshProducts ? sareeCatalogueProducts.length : 0,
  };
};

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href;
if (isDirectRun) {
  const dryRun = process.argv.includes('--dry-run');
  try {
    const result = await seedSareeCatalogue({
      dryRun,
      refreshImages: process.argv.includes('--refresh-images'),
      refreshProducts: process.argv.includes('--refresh-sample-catalogue'),
    });
    console.log(JSON.stringify(result, null, 2));
    if (!dryRun) console.log('Sample listings use illustrative images and unverified details. Every new inventory record starts at zero.');
  } catch (error) {
    console.error('Saree catalogue seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}
