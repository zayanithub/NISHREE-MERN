import ExchangeRequest from "../models/ExchangeRequest.js";
import ReturnExchangeReservation from "../models/ReturnExchangeReservation.js";
import ReturnRequest from "../models/ReturnRequest.js";

const activeReturnStatuses = [
  "requested",
  "under_review",
  "approved",
  "pickup_scheduled",
  "in_transit",
  "received",
  "inspection_passed",
  "refund_pending",
];

const activeExchangeStatuses = [
  "requested",
  "under_review",
  "approved",
  "pickup_scheduled",
  "original_in_transit",
  "original_received",
  "inspection_passed",
  "replacement_pending",
  "replacement_shipped",
];

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getLegacyQuantities = async (
  orderId,
  orderItemId,
  session
) => {
  const [returns, exchanges] = await Promise.all([
    ReturnRequest.find({
      order: orderId,
      orderItemId,
      status: {
        $in: [...activeReturnStatuses, "completed"],
      },
    })
      .select("quantity status")
      .session(session)
      .lean(),
    ExchangeRequest.find({
      order: orderId,
      orderItemId,
      status: {
        $in: [...activeExchangeStatuses, "completed"],
      },
    })
      .select("quantity status")
      .session(session)
      .lean(),
  ]);

  return [...returns, ...exchanges].reduce(
    (totals, request) => {
      if (request.status === "completed") {
        totals.completedQuantity += request.quantity;
      } else {
        totals.reservedQuantity += request.quantity;
      }

      return totals;
    },
    {
      reservedQuantity: 0,
      completedQuantity: 0,
    }
  );
};

const ensureReservation = async ({
  orderId,
  orderItemId,
  purchasedQuantity,
  session,
}) => {
  let reservation = await ReturnExchangeReservation.findOne({
    order: orderId,
    orderItemId,
  })
    .session(session)
    .lean();

  if (!reservation) {
    const legacyQuantities = await getLegacyQuantities(
      orderId,
      orderItemId,
      session
    );

    try {
      reservation = await ReturnExchangeReservation.findOneAndUpdate(
        {
          order: orderId,
          orderItemId,
        },
        {
          $setOnInsert: {
            purchasedQuantity,
            ...legacyQuantities,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          setDefaultsOnInsert: true,
          session,
        }
      ).lean();
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }

      reservation = await ReturnExchangeReservation.findOne({
        order: orderId,
        orderItemId,
      })
        .session(session)
        .lean();
    }
  }

  if (
    !reservation ||
    reservation.purchasedQuantity !== purchasedQuantity
  ) {
    throw createError(
      "The order item quantity reservation is inconsistent. Manual reconciliation is required.",
      409
    );
  }
};

export const reserveReturnExchangeQuantity = async ({
  orderId,
  orderItemId,
  purchasedQuantity,
  quantity,
  session,
}) => {
  await ensureReservation({
    orderId,
    orderItemId,
    purchasedQuantity,
    session,
  });

  const reservation = await ReturnExchangeReservation.findOneAndUpdate(
    {
      order: orderId,
      orderItemId,
      $expr: {
        $lte: [
          {
            $add: [
              {
                $add: [
                  { $ifNull: ["$reservedQuantity", 0] },
                  { $ifNull: ["$completedQuantity", 0] },
                ],
              },
              quantity,
            ],
          },
          "$purchasedQuantity",
        ],
      },
    },
    {
      $inc: {
        reservedQuantity: quantity,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
      session,
    }
  ).lean();

  if (!reservation) {
    throw createError(
      "The requested return/exchange quantity exceeds the remaining eligible quantity.",
      409
    );
  }

  return reservation;
};

const moveReservedQuantity = async ({
  orderId,
  orderItemId,
  quantity,
  completed,
  session,
}) => {
  const update = {
    $inc: {
      reservedQuantity: -quantity,
    },
  };

  if (completed) {
    update.$inc.completedQuantity = quantity;
  }

  const result = await ReturnExchangeReservation.updateOne(
    {
      order: orderId,
      orderItemId,
      reservedQuantity: { $gte: quantity },
    },
    update,
    { session, runValidators: true }
  );

  if (result.modifiedCount !== 1) {
    throw createError(
      "The return/exchange quantity reservation could not be reconciled.",
      409
    );
  }
};

export const releaseReturnExchangeQuantity = (options) =>
  moveReservedQuantity({
    ...options,
    completed: false,
  });

export const completeReturnExchangeQuantity = (options) =>
  moveReservedQuantity({
    ...options,
    completed: true,
  });
