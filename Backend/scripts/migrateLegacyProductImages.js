import mongoose from "mongoose";
import connectDB from "../config/DBconfig.js";
import Product from "../models/Product.js";
import ProductImage from "../models/ProductImage.js";

const migrateLegacyProductImages = async () => {
  await connectDB();

  const products = await Product.find({
    "primaryImage.url": { $exists: true, $nin: ["", null] },
  })
    .select("_id name primaryImage imageAltText")
    .lean();

  let migrated = 0;
  for (const product of products) {
    const imageCount = await ProductImage.countDocuments({ product: product._id });
    if (imageCount > 0) continue;

    await ProductImage.create({
      product: product._id,
      url: product.primaryImage.url,
      publicId: product.primaryImage.publicId || `legacy:${product._id}`,
      contentHash: "",
      altText: product.imageAltText || product.name || "",
      sortOrder: 0,
      isPrimary: true,
    });
    migrated += 1;
  }

  const [counts = { products: 0, withFourImages: 0, withFiveImages: 0, needingImages: 0 }] =
    await Product.aggregate([
      {
        $lookup: {
          from: ProductImage.collection.name,
          localField: "_id",
          foreignField: "product",
          as: "gallery",
        },
      },
      {
        $addFields: {
          imageCount: { $size: "$gallery" },
          uniqueImageCount: {
            $size: {
              $setUnion: [
                { $map: { input: "$gallery", as: "image", in: "$$image.url" } },
                [],
              ],
            },
          },
          primaryImageCount: {
            $size: {
              $filter: {
                input: "$gallery",
                as: "image",
                cond: { $eq: ["$$image.isPrimary", true] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          products: { $sum: 1 },
          withFourImages: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$imageCount", 4] },
                    { $eq: ["$uniqueImageCount", 4] },
                    { $eq: ["$primaryImageCount", 1] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          withFiveImages: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$imageCount", 5] },
                    { $eq: ["$uniqueImageCount", 5] },
                    { $eq: ["$primaryImageCount", 1] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          needingImages: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $lt: ["$imageCount", 4] },
                    { $gt: ["$imageCount", 5] },
                    { $ne: ["$imageCount", "$uniqueImageCount"] },
                    { $ne: ["$primaryImageCount", 1] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          products: 1,
          withFourImages: 1,
          withFiveImages: 1,
          needingImages: 1,
        },
      },
    ]);

  console.log(JSON.stringify({ migratedLegacyImages: migrated, ...counts }, null, 2));
};

try {
  await migrateLegacyProductImages();
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
