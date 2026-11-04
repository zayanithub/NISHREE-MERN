import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const isCloudinaryConfigured = Boolean(
  cloudName && apiKey && apiSecret
);

// Configure the Cloudinary SDK.
cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

export const assertCloudinaryConfigured = () => {
  if (!isCloudinaryConfigured) {
    throw new Error(
      "Cloudinary is not configured. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in your .env file."
    );
  }
};

export const getCloudinaryConfigStatus = () => ({
  configured: isCloudinaryConfigured,
});

export default cloudinary;