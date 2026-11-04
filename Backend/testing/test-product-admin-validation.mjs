import assert from "node:assert/strict";
import test from "node:test";
import { createProductSchema } from "../validations/productValidation.js";

test("admin product metadata can be omitted", () => {
  assert.equal(createProductSchema.safeParse({}).success, true);
});

test("empty optional product fields remain valid", () => {
  const result = createProductSchema.safeParse({
    name: "",
    slug: "",
    sku: "",
    description: "",
    category: null,
  });
  assert.equal(result.success, true);
});

test("provided prices retain non-negative and discount validation", () => {
  assert.equal(createProductSchema.safeParse({ basePrice: -1 }).success, false);
  assert.equal(createProductSchema.safeParse({ basePrice: 100, salePrice: 101 }).success, false);
  assert.equal(createProductSchema.safeParse({ basePrice: 100, salePrice: 99 }).success, true);
});
