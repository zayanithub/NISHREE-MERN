import Newsletter from "../models/Newsletter.js";

export const subscribeToNewsletter = async (email) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  const subscriptionFields = {
    status: "subscribed",
    consentAt: new Date(),
    unsubscribedAt: null,
    verificationTokenHash: null,
    source: "website",
  };

  try {
    await Newsletter.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $set: subscriptionFields,
        $setOnInsert: { email: normalizedEmail },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    await Newsletter.updateOne({ email: normalizedEmail }, { $set: subscriptionFields });
  }

  return { subscribed: true };
};
