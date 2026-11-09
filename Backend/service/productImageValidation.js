import { createHash } from "node:crypto";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 5;

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidImageBuffer = (buffer, mimeType) => {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      );
  }

  if (mimeType === "image/webp") {
    return buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP";
  }

  return false;
};

export const hashProductImage = (buffer) =>
  createHash("sha256").update(buffer).digest("hex");

export const validateProductImageFiles = (files) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw createError("Please provide at least one image.", 400);
  }

  if (files.length > MAX_IMAGES) {
    throw createError("A maximum of 5 product images are allowed.", 400);
  }

  const hashes = [];
  const seenHashes = new Set();
  for (const file of files) {
    if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw createError("An uploaded image is empty or invalid.", 400);
    }

    if (file.buffer.length > MAX_IMAGE_SIZE) {
      throw createError("Each image must be 5 MB or smaller.", 413);
    }

    if (!isValidImageBuffer(file.buffer, file.mimetype)) {
      throw createError(
        "An uploaded image does not match its declared image format.",
        400
      );
    }

    const hash = hashProductImage(file.buffer);
    if (seenHashes.has(hash)) {
      throw createError("Each product image must be a unique photograph.", 400);
    }
    seenHashes.add(hash);
    hashes.push(hash);
  }

  return hashes;
};
