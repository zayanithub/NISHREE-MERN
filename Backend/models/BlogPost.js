import mongoose from "mongoose";

const blogContentBlockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["paragraph", "heading", "quote", "image", "video", "link"],
      required: true,
    },
    text: {
      type: String,
      trim: true,
      maxlength: 12000,
      default: "",
    },
    url: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: "",
    },
    altText: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
  },
  { _id: false }
);

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 200 },
    excerpt: { type: String, required: true, trim: true, maxlength: 500 },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    contentType: {
      type: String,
      enum: ["story", "festival", "product", "event", "promotion", "guide", "announcement", "update", "campaign"],
      default: "story",
      index: true,
    },
    contentBlocks: { type: [blogContentBlockSchema], default: [] },
    readingMinutes: { type: Number, min: 1, default: 1 },
    heroImage: { type: String, required: true, trim: true, maxlength: 2048 },
    heroImageAlt: { type: String, required: true, trim: true, maxlength: 200 },
    heroImagePublicId: { type: String, trim: true, default: "" },
    mediaUrl: { type: String, trim: true, maxlength: 2048, default: "" },
    mediaType: { type: String, enum: ["image", "video"], default: "image" },
    author: { type: String, trim: true, maxlength: 100, default: "Nishree Attire" },
    tags: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["draft", "scheduled", "published", "archived"],
      default: "draft",
      index: true,
    },
    isFeatured: { type: Boolean, default: false, index: true },
    publishAt: { type: Date, default: null, index: true },
    expiresAt: { type: Date, default: null, index: true },
    ctaLabel: { type: String, trim: true, maxlength: 80, default: "" },
    ctaUrl: { type: String, trim: true, maxlength: 2048, default: "" },
    eventDate: { type: Date, default: null },
    eventLocation: { type: String, trim: true, maxlength: 200, default: "" },
    eventRegistrationUrl: { type: String, trim: true, maxlength: 2048, default: "" },
    campaignLabel: { type: String, trim: true, maxlength: 120, default: "" },
    views: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  { timestamps: true, versionKey: false }
);

blogPostSchema.pre("validate", function calculateReadingMinutes() {
  const wordCount = this.contentBlocks.reduce((total, block) => (
    total + String(block.text || "").trim().split(/\s+/).filter(Boolean).length
  ), 0);
  this.readingMinutes = Math.max(1, Math.ceil(wordCount / 220));
});

blogPostSchema.index({ status: 1, publishAt: -1, expiresAt: 1 });
blogPostSchema.index({ status: 1, isFeatured: -1, publishAt: -1 });
blogPostSchema.index({ status: 1, views: -1, publishAt: -1 });
blogPostSchema.index({ title: "text", excerpt: "text", category: "text", tags: "text" });

const BlogPost = mongoose.model("BlogPost", blogPostSchema);

export default BlogPost;
