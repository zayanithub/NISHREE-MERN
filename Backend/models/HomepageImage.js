import mongoose from "mongoose";

const homepageImageSchema = new mongoose.Schema(
  {
    section: {
      type: String,
      enum: ["hero", "category", "editorial", "atelier", "social"],
      required: true,
      index: true,
    },
    seedKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
    },
    cloudinaryPublicId: {
      type: String,
      default: "",
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    altText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    sortOrder: {
      type: Number,
      required: true,
      min: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

homepageImageSchema.index({ section: 1, isDeleted: 1, sortOrder: 1 });

const HomepageImage = mongoose.model("HomepageImage", homepageImageSchema);

export default HomepageImage;
