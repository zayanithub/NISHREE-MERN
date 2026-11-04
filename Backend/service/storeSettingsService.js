import StoreSettings from "../models/StoreSettings.js";
import { COD_ORDER_LIMIT, RETURN_EXCHANGE_WINDOW_DAYS } from "./businessPolicy.js";

export const defaultStoreDetails = Object.freeze({
  storeName: "Nishree Attire",
  supportEmail: "info.nishree@gmail.com",
  supportPhone: "9344901028",
  businessAddress: "44/41, Pillaiyar Kovil 1st Street, Mambakkam, Chennai, Tamil Nadu 600127, India.",
  whatsappNumber: "919344901028",
  whatsappUrl: "https://wa.me/919344901028/?text=Hi,%20Can%20you%20send%20details%20about%20your%20products",
  instagramUrl: "https://www.instagram.com/nishree_fashions/",
  facebookUrl: "https://www.facebook.com/share/19KgfTEgdN/",
});

export const defaultStorePolicies = Object.freeze({
  cod: Object.freeze({
    content: "Cash on Delivery is available for orders with a final total of ₹2,000 or less. COD is unavailable above ₹2,000. If a coupon changes the payable total, eligibility is checked against that final server-calculated total. Checkout prevents COD on an ineligible order.",
    isPublished: true,
  }),
  returns: Object.freeze({
    content: "A return or exchange may be requested within 5 days of the purchase date. Every request is reviewed and must be approved before it is processed. For a damaged or defective item, please send photographs of the issue to us on WhatsApp so the team can review them.",
    isPublished: true,
  }),
  refunds: Object.freeze({
    content: "For an eligible order cancelled before shipping, customers who paid online receive a full refund. When shipping has been initiated, the applicable transportation charges are deducted. Transportation charges are also deducted from applicable refunds for returned or cancelled orders. Refund review and processing depend on approval of the request.",
    isPublished: true,
  }),
  damaged: Object.freeze({
    content: "Before packing, the store will share product images with the customer through WhatsApp. For a damaged or defective product, send clear photographs of the issue through WhatsApp within 5 days of purchase. The request will be reviewed and processed only if approved.",
    isPublished: true,
  }),
  shipping: Object.freeze({
    content: "The public catalogue does not publish a delivery-time estimate or a shipping-fee schedule. The shipping charge recorded for an order is shown in its checkout summary. Please contact the store before placing an order if you need the dispatch or delivery details confirmed.",
    isPublished: true,
  }),
  privacy: Object.freeze({ content: "", isPublished: false }),
  terms: Object.freeze({ content: "", isPublished: false }),
});

const publicFields = (settings = {}) => {
  const configured = settings || {};
  return {
    ...defaultStoreDetails,
    storeName: configured.storeName || defaultStoreDetails.storeName,
    supportEmail: configured.supportEmail || defaultStoreDetails.supportEmail,
    supportPhone: configured.supportPhone || defaultStoreDetails.supportPhone,
    businessAddress: configured.businessAddress || defaultStoreDetails.businessAddress,
    whatsappNumber: configured.whatsappNumber || defaultStoreDetails.whatsappNumber,
    whatsappUrl: configured.whatsappUrl || defaultStoreDetails.whatsappUrl,
    instagramUrl: configured.instagramUrl || defaultStoreDetails.instagramUrl,
    facebookUrl: configured.facebookUrl || defaultStoreDetails.facebookUrl,
    policies: Object.fromEntries(
      Object.entries(defaultStorePolicies).map(([key, fallback]) => [
        key,
        {
          content: configured.policies?.[key]?.content ?? fallback.content,
          isPublished: configured.policies?.[key]?.isPublished ?? fallback.isPublished,
        },
      ])
    ),
    codLimit: COD_ORDER_LIMIT,
    returnWindowDays: RETURN_EXCHANGE_WINDOW_DAYS,
    exchangeWindowDays: RETURN_EXCHANGE_WINDOW_DAYS,
  };
};

export const getPublicStoreDetails = async () =>
  publicFields(await StoreSettings.findOne({ key: "main" }).lean());

export const getAdminStoreDetails = getPublicStoreDetails;

export const updateStoreDetails = async (body, adminId) => {
  const settings = await StoreSettings.findOneAndUpdate(
    { key: "main" },
    { $set: { ...body, updatedBy: adminId } },
    { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  return publicFields(settings);
};
