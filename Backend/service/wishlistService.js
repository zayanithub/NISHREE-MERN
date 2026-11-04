import Wishlist from "../models/Wishlist.js";
import Product from "../models/Product.js";
import ProductVariant from "../models/ProductVariant.js";
import Inventory from "../models/Inventory.js";

/*
|--------------------------------------------------------------------------
| Common Helpers
|--------------------------------------------------------------------------
*/

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (value) => {
  return (
    typeof value === "string" &&
    /^[a-f\d]{24}$/i.test(value)
  );
};

const validateObjectId = (value, fieldName) => {
  if (!isValidObjectId(String(value ?? ""))) {
    throw createError(
      `Invalid ${fieldName}.`,
      400
    );
  }

  return String(value);
};

/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
*/

const handleWishlistError = (error) => {
  if (error.statusCode) {
    throw error;
  }

  if (error.code === 11000) {
    throw createError(
      "Wishlist already exists. Please retry the request.",
      409
    );
  }

  if (error.name === "ValidationError") {
    throw createError(
      error.message,
      400
    );
  }

  throw error;
};

/*
|--------------------------------------------------------------------------
| Validate Customer
|--------------------------------------------------------------------------
*/

const getValidatedUserId = (userId) => {
  return validateObjectId(
    userId,
    "customer ID"
  );
};

/*
|--------------------------------------------------------------------------
| Validate Public Product
|--------------------------------------------------------------------------
|
| Only active products belonging to active categories
| can be newly added to a wishlist.
|--------------------------------------------------------------------------
*/

const getActiveProduct = async (productId) => {
  const id = validateObjectId(
    productId,
    "product ID"
  );

  const product = await Product.findOne({
    _id: id,
    status: "active",
  })
    .select(
      "_id name slug status category basePrice salePrice currency primaryImage"
    )
    .populate(
      "category",
      "name slug isActive"
    )
    .lean();

  if (
    !product ||
    !product.category ||
    !product.category.isActive
  ) {
    throw createError(
      "Active product not found.",
      404
    );
  }

  return product;
};

/*
|--------------------------------------------------------------------------
| Find Or Create Wishlist
|--------------------------------------------------------------------------
*/

const findOrCreateWishlist = async (userId) => {
  let wishlist = await Wishlist.findOne({
    user: userId,
  });

  if (wishlist) {
    return wishlist;
  }

  try {
    wishlist = await Wishlist.create({
      user: userId,
      products: [],
    });

    return wishlist;
  } catch (error) {
    /*
     * Another request may have created the wishlist
     * simultaneously. Reuse that record when possible.
     */
    if (error.code === 11000) {
      wishlist = await Wishlist.findOne({
        user: userId,
      });

      if (wishlist) {
        return wishlist;
      }
    }

    handleWishlistError(error);
  }
};

/*
|--------------------------------------------------------------------------
| Populate Wishlist Products
|--------------------------------------------------------------------------
*/

const getPopulatedWishlist = async (userId) => {
  return Wishlist.findOne({
    user: userId,
  })
    .populate({
      path: "products.product",
      select:
        "name slug status category basePrice salePrice currency primaryImage material color imageAltText",
      populate: {
        path: "category",
        select: "name slug isActive",
      },
    })
    .lean();
};

/*
|--------------------------------------------------------------------------
| Format Customer-Facing Wishlist
|--------------------------------------------------------------------------
|
| Inactive or deleted products are excluded from the
| customer-facing response. Existing references are preserved
| in the database rather than silently deleted.
|--------------------------------------------------------------------------
*/

const formatWishlist = async (wishlist, userId) => {
  if (!wishlist) {
    return {
      user: userId,
      products: [],
      itemCount: 0,
      createdAt: null,
      updatedAt: null,
    };
  }

  const products = wishlist.products
    .filter((item) => {
      const product = item.product;

      return Boolean(
        product &&
        product.status === "active" &&
        product.category &&
        product.category.isActive
      );
    })
    .map((item) => {
      return {
        _id: item._id,
        addedAt: item.addedAt,
        source: item.product,
      };
    });

  const productIds = products.map(({ source }) => source._id);
  const [variants, inventory] = productIds.length
    ? await Promise.all([
      ProductVariant.find({ product: { $in: productIds }, isActive: true })
        .select("_id product sku name color colorCode blouseOption priceAdjustment image")
        .sort({ createdAt: 1, _id: 1 })
        .lean(),
      Inventory.find({ product: { $in: productIds } })
        .select("product variant inventoryType quantity reservedQuantity")
        .lean(),
    ])
    : [[], []];
  const variantsByProduct = new Map();
  for (const variant of variants) {
    const key = String(variant.product);
    if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
    variantsByProduct.get(key).push(variant);
  }
  const inventoryByProduct = new Map();
  for (const stock of inventory) {
    const key = String(stock.product);
    if (!inventoryByProduct.has(key)) inventoryByProduct.set(key, []);
    inventoryByProduct.get(key).push(stock);
  }

  const formattedProducts = products.map(({ _id, addedAt, source: product }) => {
    const productVariants = variantsByProduct.get(String(product._id)) || [];
    const productInventory = inventoryByProduct.get(String(product._id)) || [];
    const available = (stock) => Math.max(0, stock.quantity - stock.reservedQuantity);
    const saleBase = Number(product.salePrice ?? product.basePrice);
    const basePrice = Number(product.basePrice);
    const formattedVariants = productVariants.map((variant) => {
      const variantStock = productInventory.find(
        (stock) => stock.inventoryType === "variant" && String(stock.variant) === String(variant._id)
      );
      const adjustment = Number(variant.priceAdjustment || 0);
      return {
        ...variant,
        finalPrice: saleBase + adjustment,
        availableQuantity: variantStock ? available(variantStock) : 0,
      };
    });
    const stockQuantity = productVariants.length
      ? formattedVariants.reduce((total, variant) => total + variant.availableQuantity, 0)
      : available(productInventory.find((stock) => stock.inventoryType === "product") || { quantity: 0, reservedQuantity: 0 });

    return {
      _id,
      addedAt,
      product: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        material: product.material,
        color: product.color,
        imageAltText: product.imageAltText,
        category: {
          _id: product.category._id,
          name: product.category.name,
          slug: product.category.slug,
        },
        basePrice: basePrice,
        salePrice: product.salePrice ?? null,
        currency: product.currency || "INR",
        primaryImage: { url: product.primaryImage?.url || "" },
        availableQuantity: stockQuantity,
        discountPercent: basePrice > saleBase ? Math.round((basePrice - saleBase) / basePrice * 100) : 0,
        variants: formattedVariants,
      },
    };
  });

  return {
    _id: wishlist._id,
    user: wishlist.user,
    products: formattedProducts,
    itemCount: formattedProducts.length,
    createdAt: wishlist.createdAt,
    updatedAt: wishlist.updatedAt,
  };
};

/*
|--------------------------------------------------------------------------
| 1. Get Customer Wishlist
|--------------------------------------------------------------------------
|
| If a wishlist does not exist, return an empty wishlist
| without creating a database record.
|--------------------------------------------------------------------------
*/

export const getWishlist = async (userId) => {
  const validatedUserId =
    getValidatedUserId(userId);

  const wishlist = await getPopulatedWishlist(
    validatedUserId
  );

  return formatWishlist(
    wishlist,
    validatedUserId
  );
};

/*
|--------------------------------------------------------------------------
| 2. Add Product To Wishlist
|--------------------------------------------------------------------------
|
| Duplicate products are not added twice.
|--------------------------------------------------------------------------
*/

export const addWishlistProduct = async (
  userId,
  productId
) => {
  const validatedUserId =
    getValidatedUserId(userId);

  try {
    // Validate that the product is currently available publicly.
    const product = await getActiveProduct(
      productId
    );

    const wishlist = await findOrCreateWishlist(
      validatedUserId
    );

    const alreadyExists =
      wishlist.products.some((item) => {
        return (
          String(item.product) ===
          String(product._id)
        );
      });

    if (!alreadyExists) {
      wishlist.products.push({
        product: product._id,
        addedAt: new Date(),
      });

      await wishlist.save();
    }

    return getWishlist(validatedUserId);
  } catch (error) {
    handleWishlistError(error);
  }
};

/*
|--------------------------------------------------------------------------
| 3. Remove Product From Wishlist
|--------------------------------------------------------------------------
|
| productId refers to the Product document ID,
| not the wishlist subdocument ID.
|--------------------------------------------------------------------------
*/

export const removeWishlistProduct = async (
  userId,
  productId
) => {
  const validatedUserId =
    getValidatedUserId(userId);

  const validatedProductId =
    validateObjectId(
      productId,
      "product ID"
    );

  const wishlist = await Wishlist.findOne({
    user: validatedUserId,
  });

  if (!wishlist) {
    throw createError(
      "Wishlist not found.",
      404
    );
  }

  const existingProduct =
    wishlist.products.some((item) => {
      return (
        String(item.product) ===
        validatedProductId
      );
    });

  if (!existingProduct) {
    throw createError(
      "Product not found in wishlist.",
      404
    );
  }

  wishlist.products =
    wishlist.products.filter((item) => {
      return (
        String(item.product) !==
        validatedProductId
      );
    });

  await wishlist.save();

  return getWishlist(validatedUserId);
};

/*
|--------------------------------------------------------------------------
| 4. Clear Customer Wishlist
|--------------------------------------------------------------------------
*/

export const clearWishlist = async (userId) => {
  const validatedUserId =
    getValidatedUserId(userId);

  const wishlist = await Wishlist.findOne({
    user: validatedUserId,
  });

  if (!wishlist) {
    return getWishlist(validatedUserId);
  }

  wishlist.products = [];

  await wishlist.save();

  return getWishlist(validatedUserId);
};