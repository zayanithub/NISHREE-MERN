import {
  addHomepageImages as addHomepageImagesService,
  deleteHomepageImage as deleteHomepageImageService,
  listHomepageImages as listHomepageImagesService,
  reorderHomepageImages as reorderHomepageImagesService,
  seedHomepageImages,
  updateHomepageImage as updateHomepageImageService,
} from "../service/homepageImageService.js";

export const getPublicHomepageImages = async (_req, res, next) => {
  try {
    await seedHomepageImages();
    const images = await listHomepageImagesService();
    return res.status(200).json({ success: true, images });
  } catch (error) {
    return next(error);
  }
};

export const getAdminHomepageImages = async (_req, res, next) => {
  try {
    await seedHomepageImages();
    const images = await listHomepageImagesService();
    return res.status(200).json({ success: true, images });
  } catch (error) {
    return next(error);
  }
};

export const addHomepageImages = async (req, res, next) => {
  try {
    const images = await addHomepageImagesService(
      req.body.section,
      req.files,
      req.admin.adminId
    );
    return res.status(201).json({ success: true, images });
  } catch (error) {
    return next(error);
  }
};

export const updateHomepageImage = async (req, res, next) => {
  try {
    const result = await updateHomepageImageService(
      req.params.imageId,
      req.body,
      req.file,
      req.admin.adminId
    );
    return res.status(200).json({
      success: true,
      image: result.image,
      cleanupWarning: result.cleanupWarning,
    });
  } catch (error) {
    return next(error);
  }
};

export const reorderHomepageImages = async (req, res, next) => {
  try {
    const images = await reorderHomepageImagesService(req.body);
    return res.status(200).json({ success: true, images });
  } catch (error) {
    return next(error);
  }
};

export const deleteHomepageImage = async (req, res, next) => {
  try {
    const result = await deleteHomepageImageService(req.params.imageId);
    return res.status(200).json({
      success: true,
      message: result.cleanupWarning || "Homepage image removed.",
      cleanupWarning: result.cleanupWarning || null,
    });
  } catch (error) {
    return next(error);
  }
};
