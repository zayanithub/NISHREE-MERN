import {
  createBlogPost as createBlogPostService,
  deleteBlogPost as deleteBlogPostService,
  getAdminBlogPost as getAdminBlogPostService,
  getPublicBlogPost as getPublicBlogPostService,
  listAdminBlogPosts as listAdminBlogPostsService,
  listPublicBlogPosts as listPublicBlogPostsService,
  updateBlogPost as updateBlogPostService,
} from "../service/blogPostService.js";
import { Readable } from "node:stream";
import cloudinary, { assertCloudinaryConfigured } from "../config/cloudinary.js";

const sendError = (next, error) => {
  if (error.statusCode) return next(error);
  return next(error);
};

export const listPublicBlogPosts = async (req, res, next) => {
  try {
    const result = await listPublicBlogPostsService(req.query);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(next, error);
  }
};

export const getPublicBlogPost = async (req, res, next) => {
  try {
    const result = await getPublicBlogPostService(req.params.slug);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(next, error);
  }
};

export const listAdminBlogPosts = async (req, res, next) => {
  try {
    const result = await listAdminBlogPostsService(req.query);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(next, error);
  }
};

export const getAdminBlogPost = async (req, res, next) => {
  try {
    const post = await getAdminBlogPostService(req.params.postId);
    return res.status(200).json({ success: true, post });
  } catch (error) {
    return sendError(next, error);
  }
};

export const createBlogPost = async (req, res, next) => {
  try {
    const post = await createBlogPostService(req.body, req.file, req.admin.adminId);
    return res.status(201).json({ success: true, post });
  } catch (error) {
    return sendError(next, error);
  }
};

export const updateBlogPost = async (req, res, next) => {
  try {
    const result = await updateBlogPostService(req.params.postId, req.body, req.file, req.admin.adminId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(next, error);
  }
};

export const deleteBlogPost = async (req, res, next) => {
  try {
    const result = await deleteBlogPostService(req.params.postId);
    return res.status(200).json({
      success: true,
      message: result.cleanupWarning || "Post deleted.",
      cleanupWarning: result.cleanupWarning,
    });
  } catch (error) {
    return sendError(next, error);
  }
};

export const uploadBlogMedia = async (req, res, next) => {
  try {
    if (!req.file || !Buffer.isBuffer(req.file.buffer) || req.file.buffer.length === 0) {
      return res.status(400).json({ success: false, message: "Choose an image to upload." });
    }
    assertCloudinaryConfigured();
    const image = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "nishree-attaire/blogs/content", resource_type: "image", allowed_formats: ["jpg", "jpeg", "png", "webp"], unique_filename: true, overwrite: false },
        (error, result) => {
          if (error) return reject(error);
          if (!result?.secure_url || !result?.public_id) return reject(new Error("Image storage did not return valid image details."));
          return resolve({ url: result.secure_url, publicId: result.public_id });
        }
      );
      Readable.from([req.file.buffer]).pipe(stream);
    });
    return res.status(201).json({ success: true, image });
  } catch (error) {
    return sendError(next, error);
  }
};
