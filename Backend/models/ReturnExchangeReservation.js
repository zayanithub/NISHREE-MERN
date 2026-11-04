import mongoose from "mongoose";

const returnExchangeReservationSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    purchasedQuantity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isInteger,
    },
    completedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isInteger,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

returnExchangeReservationSchema.index(
  { order: 1, orderItemId: 1 },
  { unique: true }
);

const ReturnExchangeReservation = mongoose.model(
  "ReturnExchangeReservation",
  returnExchangeReservationSchema
);

export default ReturnExchangeReservation;
