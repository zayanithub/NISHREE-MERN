export const eligibleSalesMatch = (start, end) => ({
  ...(start && end ? { createdAt: { $gte: start, $lte: end } } : {}),
  $or: [
    { paymentStatus: { $in: ["paid", "partially_refunded"] } },
    { paymentMethod: "cod", orderStatus: "delivered" },
  ],
});
