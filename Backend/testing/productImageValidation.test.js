import assert from "node:assert/strict";
import test from "node:test";
import { validateProductImageFiles } from "../service/productImageValidation.js";

const imageFile = (mimetype, bytes) => ({
  mimetype,
  buffer: Buffer.from(bytes),
});

test("accepts supported image signatures and returns their hashes", () => {
  const files = [
    imageFile("image/jpeg", [0xff, 0xd8, 0xff, 0x00]),
    imageFile("image/png", [137, 80, 78, 71, 13, 10, 26, 10]),
    imageFile("image/webp", [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]),
  ];

  assert.equal(validateProductImageFiles(files).length, 3);
});

test("rejects empty, oversized, unsupported, or mislabeled image files", () => {
  assert.throws(() => validateProductImageFiles([]), { statusCode: 400 });
  assert.throws(
    () => validateProductImageFiles([imageFile("image/jpeg", [])]),
    { statusCode: 400 },
  );
  assert.throws(
    () => validateProductImageFiles([imageFile("image/jpeg", Buffer.alloc(5 * 1024 * 1024 + 1))]),
    { statusCode: 413 },
  );
  assert.throws(
    () => validateProductImageFiles([imageFile("image/gif", Buffer.from("GIF89a"))]),
    { statusCode: 400 },
  );
  assert.throws(
    () => validateProductImageFiles([imageFile("image/png", [0xff, 0xd8, 0xff])]),
    { statusCode: 400 },
  );
});

test("rejects repeated photo content and more than five images", () => {
  const photograph = imageFile("image/jpeg", [0xff, 0xd8, 0xff, 0x01]);
  assert.throws(
    () => validateProductImageFiles([photograph, photograph]),
    /unique photograph/,
  );
  assert.throws(
    () => validateProductImageFiles(Array.from({ length: 6 }, (_, index) =>
      imageFile("image/jpeg", [0xff, 0xd8, 0xff, index])
    )),
    { statusCode: 400 },
  );
});
