import test from "node:test";
import assert from "node:assert/strict";

import Inventory from "../models/Inventory.js";
import ProductVariant from "../models/ProductVariant.js";
import Wishlist from "../models/Wishlist.js";
import { getWishlist } from "../service/wishlistService.js";

const USER_ID = "507f1f77bcf86cd799439011";
const PRODUCT_ID = "507f1f77bcf86cd799439012";
const VARIANT_ID = "507f1f77bcf86cd799439013";
const CATEGORY_ID = "507f1f77bcf86cd799439014";

const makeWishlistQuery = (wishlist) => ({
  populate() { return this; },
  async lean() { return wishlist; },
});

test("wishlist includes variant prices and reserved-stock availability for cart actions", async (t) => {
  const wishlist = {
    _id: "507f1f77bcf86cd799439015",
    user: USER_ID,
    products: [{
      _id: "507f1f77bcf86cd799439016",
      addedAt: new Date("2026-01-01T00:00:00.000Z"),
      product: {
        _id: PRODUCT_ID,
        name: "Silk Saree",
        slug: "silk-saree",
        status: "active",
        category: { _id: CATEGORY_ID, name: "Sarees", slug: "sarees", isActive: true },
        basePrice: 100,
        salePrice: 80,
        currency: "INR",
        primaryImage: { url: "https://example.test/saree.jpg" },
      },
    }],
  };
  t.mock.method(Wishlist, "findOne", () => makeWishlistQuery(wishlist));
  t.mock.method(ProductVariant, "find", () => ({
    select() { return this; },
    sort() { return this; },
    async lean() {
      return [{
        _id: VARIANT_ID,
        product: PRODUCT_ID,
        sku: "SAREE-RED",
        name: "Red",
        color: "Red",
        colorCode: "#990000",
        blouseOption: "with_blouse",
        priceAdjustment: -5,
      }];
    },
  }));
  t.mock.method(Inventory, "find", () => ({
    select() { return this; },
    async lean() {
      return [{
        product: PRODUCT_ID,
        variant: VARIANT_ID,
        inventoryType: "variant",
        quantity: 6,
        reservedQuantity: 2,
      }];
    },
  }));

  const result = await getWishlist(USER_ID);
  const product = result.products[0].product;
  assert.equal(product.availableQuantity, 4);
  assert.equal(product.discountPercent, 20);
  assert.equal(product.variants[0].finalPrice, 75);
  assert.equal(product.variants[0].availableQuantity, 4);
});

test("wishlist reports product-level availability when no variants exist", async (t) => {
  const wishlist = {
    _id: "507f1f77bcf86cd799439015",
    user: USER_ID,
    products: [{
      _id: "507f1f77bcf86cd799439016",
      product: {
        _id: PRODUCT_ID,
        name: "Classic Saree",
        slug: "classic-saree",
        status: "active",
        category: { _id: CATEGORY_ID, name: "Sarees", slug: "sarees", isActive: true },
        basePrice: 100,
        salePrice: null,
        currency: "INR",
        primaryImage: { url: "" },
      },
    }],
  };
  t.mock.method(Wishlist, "findOne", () => makeWishlistQuery(wishlist));
  t.mock.method(ProductVariant, "find", () => ({
    select() { return this; },
    sort() { return this; },
    async lean() { return []; },
  }));
  t.mock.method(Inventory, "find", () => ({
    select() { return this; },
    async lean() {
      return [{
        product: PRODUCT_ID,
        variant: null,
        inventoryType: "product",
        quantity: 5,
        reservedQuantity: 1,
      }];
    },
  }));

  const result = await getWishlist(USER_ID);
  assert.equal(result.products[0].product.availableQuantity, 4);
  assert.deepEqual(result.products[0].product.variants, []);
});
