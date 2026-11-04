import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
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
  return /^[a-f\d]{24}$/i.test(String(value ?? ""));
};

const validateObjectId = (value, fieldName) => {
  if (!isValidObjectId(value)) {
    throw createError(`Invalid ${fieldName}.`, 400);
  }

  return String(value);
};

const validateQuantity = (value) => {
  const quantity = Number(value);

  if (
    value === undefined ||
    value === null ||
    value === "" ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 20
  ) {
    throw createError(
      "Quantity must be a whole number between 1 and 20.",
      400
    );
  }

  return quantity;
};

const roundMoney = (value) => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

/*
|--------------------------------------------------------------------------
| Cart Owner
|--------------------------------------------------------------------------
|
| Logged-in customers are identified by userId.
| Anonymous customers are identified by a server-generated,
| SHA-256 session hash.
|
| Never accept an anonymous session hash directly from the
| request body or query string.
|
*/

const resolveCartOwner = ({
  userId,
  sessionIdHash,
} = {}) => {
  // Authenticated customer takes precedence.
  if (userId !== undefined && userId !== null) {
    const validatedUserId = validateObjectId(
      userId,
      "user ID"
    );

    return {
      filter: {
        user: validatedUserId,
      },
      createFields: {
        user: validatedUserId,
      },
    };
  }

  if (
    typeof sessionIdHash !== "string" ||
    !/^[a-f\d]{64}$/i.test(sessionIdHash)
  ) {
    throw createError(
      "A valid customer identity is required.",
      401
    );
  }

  return {
    filter: {
      sessionIdHash,
    },
    createFields: {
      sessionIdHash,
    },
  };
};

/*
|--------------------------------------------------------------------------
| Find Or Create Cart
|--------------------------------------------------------------------------
*/

const findOrCreateCart = async (owner) => {
  let cart = await Cart.findOne(owner.filter);

  if (cart) {
    return cart;
  }

  try {
    cart = await Cart.create({
      ...owner.createFields,
      items: [],
      currency: "INR",
      lastActivityAt: new Date(),
    });

    return cart;
  } catch (error) {
    // Handle simultaneous requests creating the same cart.
    if (error.code === 11000) {
      cart = await Cart.findOne(owner.filter);

      if (cart) {
        return cart;
      }

      throw createError(
        "Unable to create customer cart. Please retry.",
        409
      );
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Validate Active Product
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
  "_id name slug sku description shortDescription category basePrice salePrice currency primaryImage status"
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
| Validate Variant Selection
|--------------------------------------------------------------------------
|
| If a product has active variants, the customer must select one.
| A variant must belong to the selected product and be active.
|--------------------------------------------------------------------------
*/

const getValidatedVariant = async (
  productId,
  variantId
) => {
  if (
    variantId === undefined ||
    variantId === null ||
    variantId === ""
  ) {
    const hasActiveVariants = await ProductVariant.exists({
      product: productId,
      isActive: true,
    });

    if (hasActiveVariants) {
      throw createError(
        "Please select a product variant.",
        400
      );
    }

    return null;
  }

  const id = validateObjectId(
    variantId,
    "variant ID"
  );

  const variant = await ProductVariant.findOne({
    _id: id,
    product: productId,
    isActive: true,
  })
    .select(
      "_id product name color colorCode blouseOption priceAdjustment image isActive"
    )
    .lean();

  if (!variant) {
    throw createError(
      "Active variant not found for this product.",
      404
    );
  }

  return variant;
};

/*
|--------------------------------------------------------------------------
| Inventory Availability
|--------------------------------------------------------------------------
|
| Cart operations check current available stock.
| They do not reserve or deduct inventory.
|--------------------------------------------------------------------------
*/

const getAvailableStock = async (
  productId,
  variantId = null
) => {
  const filter = variantId
    ? {
        inventoryType: "variant",
        product: productId,
        variant: variantId,
      }
    : {
        inventoryType: "product",
        product: productId,
      };

  const inventory = await Inventory.findOne(filter)
    .select("quantity reservedQuantity")
    .lean();

  if (!inventory) {
    return 0;
  }

  return Math.max(
    0,
    inventory.quantity - inventory.reservedQuantity
  );
};

const assertStockAvailable = async (
  productId,
  variantId,
  requestedQuantity
) => {
  const availableQuantity = await getAvailableStock(
    productId,
    variantId
  );

  if (requestedQuantity > availableQuantity) {
    throw createError(
      `Insufficient stock. Available quantity: ${availableQuantity}.`,
      409
    );
  }

  return availableQuantity;
};

/*
|--------------------------------------------------------------------------
| Cart Item Matching
|--------------------------------------------------------------------------
*/

const findMatchingItem = (
  cart,
  productId,
  variantId
) => {
  return cart.items.find((item) => {
    const sameProduct =
      String(item.product) === String(productId);

    const existingVariantId = item.variant
      ? String(item.variant)
      : null;

    const requestedVariantId = variantId
      ? String(variantId)
      : null;

    return (
      sameProduct &&
      existingVariantId === requestedVariantId
    );
  });
};

/*
|--------------------------------------------------------------------------
| Customer-Facing Cart Response
|--------------------------------------------------------------------------
*/

const getPopulatedCart = async (cartId) => {
  return Cart.findById(cartId)
    .populate({
      path: "items.product",
      select:
  "name slug sku description shortDescription category basePrice salePrice currency primaryImage status",
      populate: {
        path: "category",
        select: "name slug isActive",
      },
    })
    .populate({
      path: "items.variant",
      select:
        "name color colorCode blouseOption priceAdjustment image isActive product",
    })
    .lean();
};

const buildCartResponse = async (cart) => {
  if (!cart) {
    throw createError(
      "Cart not found.",
      404
    );
  }

  const items = await Promise.all(
    cart.items.map(async (item) => {
      const product = item.product;
      const variant = item.variant;

      if (!product) {
        return {
          _id: item._id,
          product: null,
          variant: null,
          quantity: item.quantity,
          unitPrice: 0,
          lineTotal: 0,
          availableQuantity: 0,
          isAvailable: false,
        };
      }

      const categoryIsActive =
        Boolean(product.category?.isActive);

      const isProductActive =
        categoryIsActive &&
        Boolean(product._id) &&
        Boolean(product.status === "active");

      /*
       * A product variant must still be active and belong
       * to the same product.
       */
      const isVariantValid = variant
        ? Boolean(
            variant.isActive &&
            String(variant.product) === String(product._id)
          )
        : true;

      const priceAdjustment = variant
        ? Number(variant.priceAdjustment ?? 0)
        : 0;

      const effectiveProductPrice = Number(
        product.salePrice ?? product.basePrice
      );

      const rawUnitPrice =
        effectiveProductPrice + priceAdjustment;

      const unitPrice = Number.isFinite(rawUnitPrice)
        ? Math.max(0, roundMoney(rawUnitPrice))
        : 0;

      let availableQuantity = 0;

      if (isProductActive && isVariantValid) {
        availableQuantity = await getAvailableStock(
          product._id,
          variant?._id ?? null
        );
      }

      const isAvailable =
        isProductActive &&
        isVariantValid &&
        availableQuantity >= item.quantity;

      const lineTotal = roundMoney(
        unitPrice * item.quantity
      );

      return {
        _id: item._id,

        product: {
          _id: product._id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          description: product.description,
          shortDescription: product.shortDescription,
          category: product.category,
          basePrice: product.basePrice,
          salePrice: product.salePrice ?? null,
          currency: product.currency || "INR",

          primaryImage: {
            url: product.primaryImage?.url || "",
          },
        },

        variant: variant
          ? {
              _id: variant._id,
              name: variant.name,
              color: variant.color || "",
              colorCode: variant.colorCode ?? null,
              blouseOption: variant.blouseOption,
              priceAdjustment,
              image: {
                url: variant.image?.url || "",
              },
            }
          : null,

        quantity: item.quantity,
        unitPrice,
        lineTotal,
        availableQuantity,
        isAvailable,
      };
    })
  );

  const subtotal = roundMoney(
    items.reduce(
      (total, item) => total + item.lineTotal,
      0
    )
  );

  const totalQuantity = items.reduce(
    (total, item) => total + item.quantity,
    0
  );

  return {
    _id: cart._id,
    currency: cart.currency || "INR",
    items,
    itemCount: items.length,
    totalQuantity,
    subtotal,
    canCheckout:
      items.length > 0 &&
      items.every((item) => item.isAvailable),
    lastActivityAt: cart.lastActivityAt,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
};

/*
|--------------------------------------------------------------------------
| 1. Get Customer Cart
|--------------------------------------------------------------------------
*/

export const getCart = async (identity) => {
  const owner = resolveCartOwner(identity);

  const cart = await findOrCreateCart(owner);

  const populatedCart = await getPopulatedCart(
    cart._id
  );

  return buildCartResponse(populatedCart);
};

/*
|--------------------------------------------------------------------------
| 2. Add Item To Cart
|--------------------------------------------------------------------------
|
| If the same product + variant already exists,
| the supplied quantity is added to the existing quantity.
|--------------------------------------------------------------------------
*/

export const addCartItem = async (
  identity,
  {
    product: productId,
    variant: variantId = null,
    quantity = 1,
  } = {}
) => {
  const owner = resolveCartOwner(identity);

  const validatedQuantity = validateQuantity(quantity);

  const product = await getActiveProduct(productId);

  const variant = await getValidatedVariant(
    product._id,
    variantId
  );

  const cart = await findOrCreateCart(owner);

  const matchingItem = findMatchingItem(
    cart,
    product._id,
    variant?._id ?? null
  );

  const finalQuantity = matchingItem
    ? matchingItem.quantity + validatedQuantity
    : validatedQuantity;

  if (finalQuantity > 20) {
    throw createError(
      "Maximum quantity per cart item is 20.",
      400
    );
  }

  await assertStockAvailable(
    product._id,
    variant?._id ?? null,
    finalQuantity
  );

  if (matchingItem) {
    matchingItem.quantity = finalQuantity;
  } else {
    cart.items.push({
      product: product._id,
      variant: variant?._id ?? null,
      quantity: validatedQuantity,
    });
  }

  cart.lastActivityAt = new Date();

  await cart.save();

  return getCart(identity);
};

/*
|--------------------------------------------------------------------------
| 3. Update Cart Item Quantity
|--------------------------------------------------------------------------
*/

export const updateCartItemQuantity = async (
  identity,
  itemId,
  quantity
) => {
  const owner = resolveCartOwner(identity);

  const validatedItemId = validateObjectId(
    itemId,
    "cart item ID"
  );

  const validatedQuantity = validateQuantity(quantity);

  const cart = await Cart.findOne(owner.filter);

  if (!cart) {
    throw createError(
      "Cart not found.",
      404
    );
  }

  const item = cart.items.id(validatedItemId);

  if (!item) {
    throw createError(
      "Cart item not found.",
      404
    );
  }

  const product = await getActiveProduct(
    String(item.product)
  );

  const variant = await getValidatedVariant(
    String(product._id),
    item.variant ? String(item.variant) : null
  );

  await assertStockAvailable(
    product._id,
    variant?._id ?? null,
    validatedQuantity
  );

  item.quantity = validatedQuantity;

  cart.lastActivityAt = new Date();

  await cart.save();

  return getCart(identity);
};

/*
|--------------------------------------------------------------------------
| 4. Remove Item From Cart
|--------------------------------------------------------------------------
*/

export const removeCartItem = async (
  identity,
  itemId
) => {
  const owner = resolveCartOwner(identity);

  const validatedItemId = validateObjectId(
    itemId,
    "cart item ID"
  );

  const cart = await Cart.findOne(owner.filter);

  if (!cart) {
    throw createError(
      "Cart not found.",
      404
    );
  }

  const item = cart.items.id(validatedItemId);

  if (!item) {
    throw createError(
      "Cart item not found.",
      404
    );
  }

  item.deleteOne();

  cart.lastActivityAt = new Date();

  await cart.save();

  return getCart(identity);
};

/*
|--------------------------------------------------------------------------
| 5. Clear Cart
|--------------------------------------------------------------------------
*/

export const clearCart = async (identity) => {
  const owner = resolveCartOwner(identity);

  const cart = await Cart.findOne(owner.filter);

  if (!cart) {
    return getCart(identity);
  }

  cart.items = [];
  cart.lastActivityAt = new Date();

  await cart.save();

  return getCart(identity);
};