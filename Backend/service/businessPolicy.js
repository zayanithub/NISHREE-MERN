export const COD_ORDER_LIMIT = 2000;
export const RETURN_EXCHANGE_WINDOW_DAYS = 5;

export const isCodEligible = (totalAmount) =>
  Number.isFinite(Number(totalAmount)) &&
  Number(totalAmount) <= COD_ORDER_LIMIT;

export const assertCodEligible = (totalAmount) => {
  if (!isCodEligible(totalAmount)) {
    const error = new Error(
      `Cash on Delivery is available only for orders of ₹${COD_ORDER_LIMIT.toLocaleString("en-IN")} or less. Please choose online payment.`
    );
    error.statusCode = 400;
    throw error;
  }
};
